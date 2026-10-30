// 把「Get clips in 1 click」接到真正的高光剪辑服务上。
//
// 浏览器拿不出服务端要的能被阿里云直接下载的文件，这一层负责上传和任务编排：
//
//   POST /api/upload        原始字节 + x-file-name 头，落盘，返回可下载的 URL
//   GET  /uploads/<name>    把落盘的文件（和加好字幕的成片）发出去，支持 Range
//   POST /api/clip          建任务，立刻返回 jobId；真正的流水线在后台跑
//   GET  /api/clip/<jobId>  轮询状态 / 进度 / 结果
//   POST /api/session       登录后写用户档案，返回账户和余额
//   GET  /api/account       读某个邮箱的余额和流水
//   GET  /api/assets        读某个邮箱剪出来的全部成片
//   POST /api/topup         记一笔充值
//
// 用户、充值、消费、资产四份文件在 scripts/store.mjs。
//
// 后台流水线：提交 /v1/seo 并轮询（服务端内部完成下载和腾讯 ASR）→ 烧字幕（可选）。
//
// 零依赖，只用 node 内置模块 + ffmpeg。
//
//   node scripts/clip-api.mjs          # 独立跑（preview 用，auth-proxy 会转发过来）
//
// dev 下不用单独启动：vite.config.ts 把同一个 handler 挂进了 dev server。
//
// 环境变量：
//   CLIP_API_PORT   独立模式监听端口        默认 10051
//   PUBLIC_BASE     给浏览器用的地址前缀      默认 http://127.0.0.1:10050（vite dev）
//                   成片链接拿它拼。
//   SOURCE_PUBLIC_BASE 阿里云下载源视频的地址前缀，默认跟 PUBLIC_BASE 一样
//   SEO_URL         旧 direct 模式地址      生产中不使用
//   SEO_PATH        接口路径                默认 /v1/seo
//   SEO_TOKEN       旧 direct 模式令牌      生产中由阿里云 Worker 使用
//   SEO_POLL_INTERVAL_MS   轮询间隔         默认 5000
//   SEO_REQUEST_TIMEOUT_MS 单次请求超时     默认 30000
//   SEO_TASK_TIMEOUT_MS    整个任务的上限   默认 2 小时
//   SEO_POLL_MAX_ERRORS    连续查询失败多少次才算任务断了 默认 10
//   DESUB_URL       去字幕服务（没设就跳过这一步）
//   DESUB_TOKEN     去字幕鉴权
//   UPLOAD_DIR      落盘目录                默认 <repo>/.uploads
//
// 腾讯云 ASR 由 SEO 服务负责，需要在 SEO 服务进程中配置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY。
//
// 本地上传先落在 AWS，再把可访问 URL 交给阿里云；YouTube/TikTok URL 直接交给阿里云。

import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  addAssets,
  addConsumption,
  addRecharge,
  creditsForSeconds,
  describeStore,
  findUserByEmail,
  getAccount,
  listAssetsByEmail,
  upsertUser,
} from './store.mjs'
import { env } from './env.mjs'
import {
  applyWorkerEvent,
  claimNextJob,
  createRelayJob,
  finalizeRelayJob,
  getRelayJob,
  initializeRelay,
  waitForWork,
} from './relay-store.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const CLIP_API_PORT = Number(env('CLIP_API_PORT', 10051))
// 留空等于没设，用默认值——.env 里 `PUBLIC_BASE=` 这一行不该把默认值废掉，见 env.mjs。
const PUBLIC_BASE = String(env('PUBLIC_BASE', 'http://127.0.0.1:10050')).replace(/\/+$/, '')
// 这个地址必须能被阿里云直接 GET，不能只是浏览器能访问的 localhost 或 Basic Auth 页面。
const SOURCE_PUBLIC_BASE = String(env('SOURCE_PUBLIC_BASE', PUBLIC_BASE)).replace(/\/+$/, '')
// Production traffic goes through the worker relay. SEO_URL is retained only for
// old local code below; the public AWS process never connects to the GPU host.
const SEO_URL = String(env('SEO_URL', 'http://127.0.0.1:8649')).replace(/\/+$/, '')
const SEO_PATH = env('SEO_PATH', '/v1/seo')
// Legacy direct-mode token. Production requests carry the local SEO token only
// from the Aliyun worker; AWS itself never sends this token to a GPU host.
const SEO_TOKEN = env('SEO_TOKEN', '').trim()
// 轮询参数。跨境链路上单次请求必须短，任务总时长才可以很长。
const SEO_POLL_INTERVAL_MS = Number(env('SEO_POLL_INTERVAL_MS', 5000))
const SEO_REQUEST_TIMEOUT_MS = Number(env('SEO_REQUEST_TIMEOUT_MS', 30000))
const SEO_TASK_TIMEOUT_MS = Number(env('SEO_TASK_TIMEOUT_MS', 2 * 60 * 60 * 1000))
// 丢几次轮询是跨境链路的常态，连续失败这么多次才判定任务真的断了。
const SEO_POLL_MAX_ERRORS = Number(env('SEO_POLL_MAX_ERRORS', 10))
const DESUB_URL = env('DESUB_URL', '')
const DESUB_TOKEN = env('DESUB_TOKEN', '')
const UPLOAD_DIR = path.resolve(env('UPLOAD_DIR', path.join(REPO_ROOT, '.uploads')))
const WORKER_TOKEN = env('WORKER_TOKEN', '').trim()
const WORKER_POLL_MAX_WAIT_MS = Math.min(30_000, Math.max(1_000, Number(env('WORKER_POLL_MAX_WAIT_MS', 25_000))))

/** 上传文件保留多久，超过就在下次上传时顺手清掉。 */
const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000
/** 成片（.uploads/clips/<jobId>/）保留多久。账户页要一直能播，所以比源文件留得久得多。 */
const CLIP_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** 任务结果在内存里留多久。 */
const JOB_TTL_MS = 2 * 60 * 60 * 1000

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi', '.flv', '.ts'])

const MIME = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
  '.ts': 'video/mp2t',
}

// ---------------------------------------------------------------------- 日志
//
// 整条流水线跑在后台（createJob 不 await runJob），失败也只是收进 job.error 等前端
// 来轮询，不会冒到 console 上；加上 dev 下是以中间件形式挂进 vite 的，独立模式那段
// 启动横幅也不会执行。两件事凑在一起，终端里就一行输出都没有。下面这几行就是为了
// 让「现在跑到哪一步、哪一步断了」在 dev 终端里直接能看见。

function stamp() {
  return new Date().toTimeString().slice(0, 8)
}

function log(...parts) {
  console.log(`[clip-api ${stamp()}]`, ...parts)
}

/** 日志里只用 jobId 的头 8 位，整条 UUID 太占地方还不好扫。 */
function shortId(id) {
  return String(id).slice(0, 8)
}

/** 启动时把接到哪些下游、文件落在哪打一遍，省得猜配置有没有生效。 */
function printBanner() {
  log(`任务中继:      ${WORKER_TOKEN ? '已启用 Worker 长轮询' : '未配置 WORKER_TOKEN，Worker API 不可用'}`)
  log(`下游剪辑服务:  由阿里云 Worker 访问本机服务（AWS 不直连 SEO_URL）`)
  log(`去字幕服务:   ${DESUB_URL || '(未接入，开关打开也会跳过)'}`)
  log(`下载地址前缀: ${PUBLIC_BASE}`)
  log(`源视频地址前缀: ${SOURCE_PUBLIC_BASE}`)
  log(`落盘目录:     ${UPLOAD_DIR}`)
  const store = describeStore()
  log(`用户档案:     ${store.users}`)
  log(`充值记录:     ${store.recharges}`)
  log(`消费记录:     ${store.consumptions}`)
  log(`成片记录:     ${store.assets}`)
  // 腾讯 MPS 要这两个才能跑 ASR，少了的话等跑到一半才报错，不如开机就讲清楚。
  const credentials = process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY
  log(`腾讯云凭证:   ${credentials ? '已设置' : '缺失！jogg ASR 会失败，用 bash.sh 带上环境变量启动'}`)
}

/** 日志里的文件大小，MB 够用了。 */
function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/** 流水线各步骤在整条进度条上占的区间，纯粹是给用户看的。 */
// label 会直接显示在按钮上，跟页面其它文案一样用英文。
const STAGES = {
  fetch: { label: 'Fetching your video…', from: 2, to: 8 },
  transfer: { label: 'Sending your video to the processing server…', from: 8, to: 18 },
  desub: { label: 'Removing burned-in subtitles…', from: 18, to: 22 },
  asr: { label: 'Transcribing speech…', from: 22, to: 30 },
  clip: { label: 'Finding and cutting highlights…', from: 30, to: 90 },
  subtitles: { label: 'Burning in subtitles…', from: 90, to: 99 },
}

/**
 * 带状态码的错误。
 *
 * message 是写给日志和消费记录的，多细都行；user 是页面上要显示的那一句。
 * 只有我们确认用户看得懂、也知道下一步该干什么的错才填 user，其余一律留空，
 * 由 userFacingError() 按失败时跑到哪一步给一句兜底的话。
 */
class ApiError extends Error {
  constructor(message, status = 400, user = '') {
    super(message)
    this.status = status
    this.user = user
  }
}

/**
 * 各步骤失败时给用户看的那一句。
 *
 * 页面上不该出现 "127.0.0.1:8649 返回 HTTP 500：task failed" 这种东西——用户既看不懂，
 * 也没法照着做什么。所以这里按阶段说清楚两件事：哪一步没成，以及下一步可以试什么。
 */
const STAGE_FAILURES = {
  fetch: "We couldn't fetch that video. Check the link still opens, or upload the file again.",
  transfer: 'Sending your video to the processing server was interrupted. Please try again.',
  desub: "Removing the burned-in subtitles didn't work. Turn that switch off and try again.",
  asr: "We couldn't find any speech in this video. Try a clip where someone is talking.",
  clip: "We couldn't find any highlights in this video. Try a different clip, or come back in a bit.",
  subtitles: 'Your clips were cut, but burning in the subtitles failed. Please try again.',
}

const GENERIC_FAILURE = "That didn't go through. Please try again."

function userFacingError(error, stage) {
  return error?.user || STAGE_FAILURES[stage] || GENERIC_FAILURE
}

const jobs = new Map()
let relayReady = null
const finalizingJobs = new Set()

function ensureRelay() {
  if (!relayReady) {
    relayReady = initializeRelay().then((records) => {
      for (const record of records) {
        if (record.status === 'finalizing' && record.result) resumeFinalization(record)
      }
    })
  }
  return relayReady
}

// ---------------------------------------------------------------- HTTP 小工具

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

/**
 * JSON over http(s)。
 *
 * timeoutMs 传 0 表示不限时；提交和轮询剪辑任务都要传一个几十秒的值。
 * 以前这里写死不限时，是因为 /v1/seo 当年是同步接口，一跑几十分钟。现在它改成了
 * 提交 + 轮询，每个请求都该很快回来——真的卡住就是链路断了，早点报比吊着强。
 */
function requestJson(url, payload, { token = '', method = 'POST', timeoutMs = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const body = payload === undefined ? null : Buffer.from(JSON.stringify(payload), 'utf8')
    const headers = { Accept: 'application/json' }
    if (body) {
      headers['Content-Type'] = 'application/json; charset=utf-8'
      headers['Content-Length'] = body.length
    }
    if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`

    const transport = target.protocol === 'https:' ? https : http
    const request = transport.request(target, { method, headers, timeout: timeoutMs }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let parsed = null
        try {
          parsed = text ? JSON.parse(text) : null
        } catch {
          parsed = null
        }
        const status = response.statusCode ?? 0
        if (status < 200 || status >= 300) {
          // falcon 那边顶层 message 永远是 "task failed"，真正的原因在 data.error_message 里。
          const detail = parsed?.data?.error_message || parsed?.message || text.slice(0, 300) || '无响应体'
          const error = new ApiError(`${target.host} 返回 HTTP ${status}：${detail}`, 502)
          // 留着上游状态码：轮询那边要靠它把"配置错了"和"链路抖了"分开。
          error.upstreamStatus = status
          reject(error)
          return
        }
        if (parsed === null) {
          reject(new ApiError(`${target.host} 返回的不是 JSON：${text.slice(0, 200)}`, 502))
          return
        }
        resolve(parsed)
      })
    })
    request.setTimeout(timeoutMs)
    if (timeoutMs > 0) {
      // 'timeout' 不会自己中断请求，得手动销毁，否则连接会一直挂着。
      request.on('timeout', () => {
        request.destroy(new Error(`等待响应超过 ${Math.round(timeoutMs / 1000)}s`))
      })
    }
    request.on('error', (err) => reject(new ApiError(`连接 ${target.host} 失败：${err.message}`, 502)))
    if (body) request.write(body)
    request.end()
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function downloadToFile(url, destination) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const transport = target.protocol === 'https:' ? https : http
    const request = transport.get(target, { timeout: 0 }, (response) => {
      const status = response.statusCode ?? 0
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        downloadToFile(new URL(response.headers.location, target).toString(), destination).then(resolve, reject)
        return
      }
      if (status !== 200) {
        response.resume()
        reject(new ApiError(`下载 ${target.href} 失败：HTTP ${status}`, 502))
        return
      }
      const file = fs.createWriteStream(destination)
      response.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', reject)
    })
    request.setTimeout(0)
    request.on('error', (err) => reject(new ApiError(`下载 ${target.href} 失败：${err.message}`, 502)))
  })
}

function readJsonBody(req, limitBytes = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        reject(new ApiError('That file is too large to upload.', 413))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      try {
        resolve(text ? JSON.parse(text) : {})
      } catch {
        reject(new ApiError("That request didn't come through. Please try again."))
      }
    })
    req.on('error', reject)
  })
}

// ------------------------------------------------------------------ 上传与静态

async function pruneUploads() {
  const now = Date.now()
  let entries = []
  try {
    entries = await fsp.readdir(UPLOAD_DIR, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(UPLOAD_DIR, entry.name)
    // clips/ 装的是用户的成片，账户页还要播，按更长的 TTL 逐个任务目录清。
    if (entry.name === 'clips' && entry.isDirectory()) {
      await pruneDirectory(full, CLIP_TTL_MS, now)
      continue
    }
    try {
      const stat = await fsp.stat(full)
      if (now - stat.mtimeMs < UPLOAD_TTL_MS) continue
      await fsp.rm(full, { recursive: true, force: true })
    } catch {
      /* 清理是尽力而为，失败不影响本次上传 */
    }
  }
}

/** 删掉目录下超过 ttl 的直接子项，目录本身留着。 */
async function pruneDirectory(directory, ttl, now) {
  let entries = []
  try {
    entries = await fsp.readdir(directory, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    try {
      const stat = await fsp.stat(full)
      if (now - stat.mtimeMs < ttl) continue
      await fsp.rm(full, { recursive: true, force: true })
    } catch {
      /* 同上 */
    }
  }
}

/** 只留扩展名，文件名自己生成：用户传什么名字都不该影响落盘路径。 */
function storedName(originalName) {
  const ext = path.extname(String(originalName || '')).toLowerCase()
  const safeExt = VIDEO_EXTENSIONS.has(ext) ? ext : '.mp4'
  return `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${safeExt}`
}

async function handleUpload(req, res) {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true })
  pruneUploads()

  const name = storedName(req.headers['x-file-name'])
  const destination = path.join(UPLOAD_DIR, name)
  try {
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination)
      let finished = false
      const fail = (error) => {
        if (finished) return
        finished = true
        reject(error)
      }
      req.pipe(file)
      file.on('finish', () => {
        finished = true
        resolve()
      })
      file.on('error', fail)
      req.on('error', fail)
      req.on('aborted', () => fail(new ApiError('The upload connection was interrupted.', 499)))
    })
  } catch (error) {
    await fsp.rm(destination, { force: true }).catch(() => {})
    throw error
  }

  const stat = await fsp.stat(destination)
  if (stat.size < 1) {
    await fsp.rm(destination, { force: true })
    // 这句会被 /api/upload 的调用方原样显示，所以是英文。
    throw new ApiError('That upload came through empty. Please pick the file again.')
  }
  log(`上传完成 ${name}（${mb(stat.size)}）`)
  sendJson(res, 200, { name, bytes: stat.size, url: `${SOURCE_PUBLIC_BASE}/uploads/${name}` })
}

/** 发静态文件，带 Range：下游服务只用整段下载，但浏览器播放成片需要它。 */
async function serveUpload(req, res, relativePath) {
  const full = path.resolve(UPLOAD_DIR, relativePath)
  if (full !== UPLOAD_DIR && !full.startsWith(UPLOAD_DIR + path.sep)) throw new ApiError('路径不合法', 403)

  let stat
  try {
    stat = await fsp.stat(full)
  } catch {
    throw new ApiError('文件不存在', 404)
  }
  if (!stat.isFile()) throw new ApiError('文件不存在', 404)

  const type = MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream'
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (range) {
    const start = range[1] ? Number(range[1]) : 0
    const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1
    if (start >= stat.size || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` })
      res.end()
      return
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
    })
    fs.createReadStream(full, { start, end }).pipe(res)
    return
  }

  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(full).pipe(res)
}

// ------------------------------------------------------------------ 流水线步骤

async function runDesub(videoUrl) {
  if (!DESUB_URL) {
    throw new ApiError(
      '去字幕服务还没配：设好 DESUB_URL 再开这个开关，或者先把开关关掉。',
      400,
      'Subtitle removal is not available right now. Turn that switch off to continue.',
    )
  }
  const response = await requestJson(DESUB_URL, { video_url: videoUrl }, { token: DESUB_TOKEN })
  const next =
    response?.video_url ?? response?.data?.video_url ?? response?.data?.url ?? response?.url ?? response?.data?.output
  if (typeof next !== 'string' || !/^https?:\/\//.test(next)) {
    throw new ApiError(`去字幕服务没返回可用的 video_url：${JSON.stringify(response).slice(0, 200)}`, 502)
  }
  return next
}

/** `[url](url)` 是下游当前的返回格式，取括号里的那个。 */
function unwrapUrl(value) {
  const text = String(value ?? '').trim()
  const markdown = /^\[.*\]\((.+)\)$/.exec(text)
  return markdown ? markdown[1].trim() : text
}

/**
 * 提交高光剪辑任务，然后轮询到出结果。
 *
 * 剪辑服务接收 video_url，下载、ASR 和剪辑都在阿里云完成。
 *
 * 这里以前是一个同步长请求：POST 出去，几分钟到几十分钟后才回来。两个服务同机
 * 跑没问题，一旦分处两地（前端在海外、GPU 留在国内），这种长时间不出流量的连接
 * 会被沿途的 NAT 和中间设备静默掐断，表现成"偶发失败、重试有时又好了"。
 * 改成提交 + 轮询之后，跨境链路上每个请求都只有几秒，断一次也只是丢一轮轮询。
 *
 * onProgress 收到的是服务端的任务状态（task_id / progress / current_stage）。
 */
/** 401/403 是令牌配错了，不是链路抖动——再问一百遍也是同一个结果。 */
function isAuthFailure(error) {
  return error?.upstreamStatus === 401 || error?.upstreamStatus === 403
}

/** 把上游的 401 换成一句能直接照着改配置的话。 */
function describeAuthFailure(error) {
  const hint = SEO_TOKEN
    ? '本地 SEO_TOKEN 和剪辑服务那边配的不一致'
    : '本地没配 SEO_TOKEN，但剪辑服务已经开了鉴权'
  return new ApiError(`剪辑服务拒绝了请求（${hint}）：${error.message}`, 502)
}

async function runHighlightCut(videoUrl, onProgress) {
  let submitted
  try {
    submitted = await requestJson(
      `${SEO_URL}${SEO_PATH}`,
      { video_url: videoUrl },
      { token: SEO_TOKEN, timeoutMs: SEO_REQUEST_TIMEOUT_MS },
    )
  } catch (error) {
    throw isAuthFailure(error) ? describeAuthFailure(error) : error
  }
  const taskId = submitted?.data?.task_id
  if (!taskId) {
    throw new ApiError(`提交剪辑任务失败，响应里没有 task_id：${JSON.stringify(submitted).slice(0, 200)}`, 502)
  }
  onProgress?.({ task_id: taskId, status: 'queued', progress: 0 })

  const statusUrl = `${SEO_URL}${SEO_PATH}/${encodeURIComponent(taskId)}`
  const deadline = Date.now() + SEO_TASK_TIMEOUT_MS
  let failures = 0

  while (true) {
    await sleep(SEO_POLL_INTERVAL_MS)
    if (Date.now() > deadline) {
      throw new ApiError(`剪辑任务 ${taskId} 超过 ${Math.round(SEO_TASK_TIMEOUT_MS / 60000)} 分钟仍未完成`, 504)
    }

    let payload
    try {
      payload = await requestJson(statusUrl, undefined, {
        method: 'GET',
        token: SEO_TOKEN,
        timeoutMs: SEO_REQUEST_TIMEOUT_MS,
      })
      failures = 0
    } catch (error) {
      // 令牌不对就别耗着了，重试十次也是同一个 401，而且会把真正的原因埋掉。
      if (isAuthFailure(error)) throw describeAuthFailure(error)
      // 单次查询失败不代表任务没了——任务还在国内那台机器上跑着，这边接着问就行。
      failures += 1
      if (failures >= SEO_POLL_MAX_ERRORS) {
        throw new ApiError(`查询剪辑任务 ${taskId} 连续 ${failures} 次失败：${error.message}`, 502)
      }
      continue
    }

    const data = payload?.data ?? {}
    if (data.status === 'failed') {
      throw new ApiError(`剪辑失败：${data.error_message || data.error_code || '未知原因'}`, 502)
    }
    if (data.status === 'completed') {
      const highlights = Array.isArray(data.highlights) ? data.highlights : []
      const segments = Array.isArray(data.asr?.segments) ? data.asr.segments : []
      return {
        highlights: highlights.map((item) => ({ ...item, video_url: unwrapUrl(item.video_url) })),
        segments,
      }
    }
    // queued / processing，以及任何还没见过的中间状态，都继续等。
    onProgress?.(data)
  }
}

// -------------------------------------------------------------------- 烧字幕

function hasCjk(text) {
  return /[㐀-鿿぀-ヿ가-힯]/.test(text)
}

/**
 * 跑一个子进程，只收 stderr。
 * onLine 给调用方一个机会把子进程的进度打到终端上——不给的话 stderr 只在失败时
 * 才随异常抛出来，成功的那次（含中途的重试提示）等于石沉大海。
 */
function run(command, args, options = {}) {
  const { onLine, ...spawnOptions } = options
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], ...spawnOptions })
    let stderr = ''
    let pending = ''
    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString()
      stderr = (stderr + text).slice(-2000)
      if (!onLine) return
      // 按行喂出去，省得半行半行地打。
      pending += text
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) onLine(line.trim())
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (onLine && pending.trim()) onLine(pending.trim())
      code === 0 ? resolve() : reject(new Error(`${command} 退出码 ${code}：${stderr}`))
    })
  })
}

function hasCjkFont() {
  return new Promise((resolve) => {
    const child = spawn('fc-list', [':lang=zh'], { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    child.stdout.on('data', (chunk) => (out += chunk.toString()))
    child.on('close', () => resolve(out.trim().length > 0))
    child.on('error', () => resolve(false))
  })
}

function srtTime(seconds) {
  const total = Math.max(0, seconds)
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(Math.floor(total % 60)).padStart(2, '0')
  const ms = String(Math.round((total % 1) * 1000)).padStart(3, '0')
  return `${h}:${m}:${s},${ms}`
}

/** ASR 片段里落在 [start,end] 内的部分，时间轴挪到从 0 开始。 */
function buildSrt(segments, start, end) {
  const lines = []
  let index = 0
  for (const segment of segments) {
    const from = Math.max(segment.start, start)
    const to = Math.min(segment.end, end)
    if (to - from < 0.08) continue
    index += 1
    lines.push(String(index), `${srtTime(from - start)} --> ${srtTime(to - start)}`, segment.text, '')
  }
  return lines.join('\n')
}

/**
 * 把 ASR 字幕压进成片。下游服务不做字幕，所以在这一层做：
 * 下载成片 → 切出对应时间段的 srt → ffmpeg 烧进去 → 换成本地 URL。
 */
async function burnSubtitles(highlights, segments, jobId, warnings) {
  if (!highlights.length) return highlights
  if (segments.some((segment) => hasCjk(segment.text)) && !(await hasCjkFont())) {
    // 提示语给用户看，所以是英文；装字体的命令只对部署这台机器的人有意义，留在日志里。
    warnings.push('Subtitles were skipped: this server has no Chinese font installed.')
    log(`${shortId(jobId)}   缺中文字体，已跳过烧字幕（装一个 fonts-noto-cjk 再试）`)
    return highlights
  }

  const workDir = path.join(UPLOAD_DIR, 'clips', jobId)
  await fsp.mkdir(workDir, { recursive: true })

  const output = []
  for (const [index, highlight] of highlights.entries()) {
    const srt = buildSrt(segments, Number(highlight.start) || 0, Number(highlight.end) || 0)
    if (!srt.trim()) {
      output.push(highlight)
      continue
    }
    const base = `h${String(index + 1).padStart(2, '0')}`
    const sourcePath = path.join(workDir, `${base}.src.mp4`)
    const srtPath = path.join(workDir, `${base}.srt`)
    const targetPath = path.join(workDir, `${base}.mp4`)
    try {
      await downloadToFile(highlight.video_url, sourcePath)
      await fsp.writeFile(srtPath, srt, 'utf8')
      // cwd 设成 workDir，这样 subtitles= 里只写文件名，不用跟 ffmpeg 的转义规则较劲。
      await run(
        'ffmpeg',
        [
          '-y',
          '-i',
          `${base}.src.mp4`,
          '-vf',
          `subtitles=${base}.srt:force_style='FontSize=18,Outline=1,Shadow=0,MarginV=28'`,
          '-c:a',
          'copy',
          '-movflags',
          '+faststart',
          `${base}.mp4`,
        ],
        { cwd: workDir },
      )
      await fsp.rm(sourcePath, { force: true })
      output.push({ ...highlight, video_url: `${PUBLIC_BASE}/uploads/clips/${jobId}/${base}.mp4` })
    } catch (error) {
      // 单条失败不拖垮整趟：页面上说一句，ffmpeg 的报错留给日志。
      warnings.push(`Clip ${index + 1} is without subtitles — burning them in failed.`)
      log(`${shortId(jobId)}   第 ${index + 1} 条压字幕失败：${error.message.slice(0, 160)}`)
      output.push(highlight)
    }
  }
  return output
}

/**
 * Normalize worker-produced MP4s for browser streaming.
 *
 * The worker may return a valid MP4 whose moov atom is at the end of the file.
 * ffprobe and desktop players can read that layout, but browser previews can
 * remain at 0:00 while waiting for metadata. A stream-copy remux moves the
 * index to the front without re-encoding the clip.
 */
async function normalizeClipVideos(highlights, jobId, warnings) {
  if (!highlights.length) return highlights

  const workDir = path.join(UPLOAD_DIR, 'clips', jobId)
  await fsp.mkdir(workDir, { recursive: true })

  const output = []
  for (const [index, highlight] of highlights.entries()) {
    const base = `h${String(index + 1).padStart(2, '0')}`
    const sourcePath = path.join(workDir, `${base}.src.mp4`)
    try {
      await downloadToFile(highlight.video_url, sourcePath)
      await run(
        'ffmpeg',
        [
          '-y',
          '-i',
          `${base}.src.mp4`,
          '-map',
          '0',
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          `${base}.mp4`,
        ],
        { cwd: workDir },
      )
      await fsp.rm(sourcePath, { force: true })
      output.push({ ...highlight, video_url: `${PUBLIC_BASE}/uploads/clips/${jobId}/${base}.mp4` })
    } catch (error) {
      warnings.push(`Clip ${index + 1} was kept on the source CDN because browser normalization failed.`)
      log(`${shortId(jobId)}   第 ${index + 1} 条视频标准化失败：${error.message.slice(0, 160)}`)
      output.push(highlight)
    }
  }
  return output
}

// ---------------------------------------------------------------------- 任务

function pruneJobs() {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > JOB_TTL_MS) jobs.delete(id)
  }
}

function setStage(job, stage, ratio = 0) {
  const { label, from, to } = STAGES[stage]
  // clipProgress 每 2 秒就会调一次，只有真换了步骤才值得打一行。
  if (job.stage !== stage) {
    const elapsed = Math.round((Date.now() - job.startedAt) / 1000)
    log(`${shortId(job.id)} → ${stage}（${label}，已用 ${elapsed}s）`)
  }
  job.stage = stage
  job.label = label
  job.progress = Math.round(from + (to - from) * Math.min(1, Math.max(0, ratio)))
  job.updatedAt = Date.now()
}

/**
 * clip 这一步的进度。
 *
 * 服务端现在会报真实进度，但它要等任务真的被 worker 领走才有第一个数，在那之前
 * 还是按经验时长（源视频时长的一半，夹在 2–20 分钟之间）往前爬。真实进度一到就
 * 停掉爬行，之后只认服务端的数。
 *
 * 两者都经过 advance()，只进不退：真实进度刚接上时可能比爬出来的低，那就先停在
 * 原地等它追上来，免得进度条当着用户的面倒退。
 */
function clipProgress(job, seconds) {
  const span = Math.min(20 * 60, Math.max(2 * 60, (seconds || 600) / 2)) * 1000
  const startedAt = Date.now()
  let ratio = 0

  const advance = (next) => {
    const bounded = Math.min(1, Math.max(0, next))
    if (bounded <= ratio) return
    ratio = bounded
    setStage(job, 'clip', ratio)
  }

  const timer = setInterval(() => {
    if (job.stage !== 'clip') return
    advance(Math.min(0.95, (Date.now() - startedAt) / span))
  }, 2000)

  return {
    report(next) {
      // 有真数就不用再猜了。
      clearInterval(timer)
      advance(next)
    },
    stop() {
      clearInterval(timer)
    },
  }
}

// Legacy direct-mode pipeline retained for local code archaeology. Production
// jobs are finalized from worker events and never enter this function.
async function runJob(job) {
  let clip = null
  const user = job.input.email ? await findUserByEmail(job.input.email) : null
  try {
    // 本地上传在 /api/upload 时已经落到 AWS；外部 URL 不在 AWS 下载，统一交给阿里云。
    setStage(job, 'fetch', 0.3)
    log(`${shortId(job.id)}   把源 URL 交给阿里云下载：${job.input.videoUrl}`)

    setStage(job, 'asr', 0.3)
    setStage(job, 'clip', 0)
    clip = clipProgress(job, job.input.duration)
    let lastStage = ''
    const result = await runHighlightCut(job.input.videoUrl, (status) => {
      if (status.task_id && status.task_id !== job.taskId) {
        job.taskId = status.task_id
        // 跨境排查全靠这个 id 把两边的日志对上。
        log(`${shortId(job.id)}   剪辑任务 ${status.task_id}`)
      }
      if (typeof status.progress === 'number') clip.report(status.progress / 100)
      if (status.current_stage && status.current_stage !== lastStage) {
        lastStage = status.current_stage
        log(`${shortId(job.id)}   ${status.current_stage}（${status.progress ?? 0}%）`)
      }
    })
    let highlights = result.highlights
    const segments = result.segments
    clip.stop()
    clip = null

    if (job.input.addSubtitles) {
      setStage(job, 'subtitles', 0.2)
      highlights = await burnSubtitles(highlights, segments, job.id, job.warnings)
    } else {
      highlights = await normalizeClipVideos(highlights, job.id, job.warnings)
    }

    job.status = 'done'
    job.label = 'Done'
    job.progress = 100
    job.highlights = highlights
    job.updatedAt = Date.now()
    const seconds = Math.round((Date.now() - job.startedAt) / 1000)
    log(`${shortId(job.id)} ✓ 完成：${highlights.length} 个片段，耗时 ${seconds}s`)
    for (const warning of job.warnings) log(`${shortId(job.id)}   注意：${warning}`)
    await recordConsumption(job, user, 'done', creditsForSeconds(job.input.duration), highlights.length, '')
    await recordAssets(job, user, highlights)
  } catch (error) {
    if (clip) clip.stop()
    // 页面上只给一句人话，排查要用的那串细节留给日志和消费记录。
    const detail = error instanceof ApiError ? error.message : `${error.message}`
    job.status = 'error'
    job.error = userFacingError(error, job.stage)
    job.updatedAt = Date.now()
    const seconds = Math.round((Date.now() - job.startedAt) / 1000)
    // 后台任务的异常不会冒到中间件的 catch 里，这里不打就彻底没人知道。
    log(`${shortId(job.id)} ✗ 失败于 ${job.stage}（耗时 ${seconds}s）：${detail}`)
    if (!(error instanceof ApiError)) console.error(error)
    // 失败不扣积分，但照样留一条记录，方便对着看是哪一步断的。
    await recordConsumption(job, user, 'error', 0, 0, detail)
  }
}

/** 消费流水写失败不该影响已经跑完的任务，记个日志就算了。 */
async function recordConsumption(job, user, status, credits, clips, error) {
  try {
    await addConsumption({
      user,
      jobId: job.id,
      credits,
      status,
      durationSeconds: job.input.duration,
      // 成片固定竖屏，页面上已经没有比例选项了。
      aspect: '9:16',
      clips,
      error,
    })
  } catch (writeError) {
    console.error('[clip-api] 写消费记录失败：', writeError)
  }
}

/**
 * 把这趟剪出来的片子记到账户下，账户页就是读这份文件。
 * 和消费流水一样，写失败不该影响已经跑完的任务。
 */
async function recordAssets(job, user, highlights) {
  if (!user || !highlights.length) return
  try {
    await addAssets({
      user,
      jobId: job.id,
      sourceName: job.input.sourceName || job.input.videoUrl,
      sourceUrl: job.input.videoUrl,
      highlights,
    })
  } catch (writeError) {
    console.error('[clip-api] 写成片记录失败：', writeError)
  }
}

function relayRuntimeJob(record) {
  return {
    ...record,
    id: record.jobId,
    startedAt: record.startedAt || record.createdAt,
    warnings: Array.isArray(record.warnings) ? record.warnings : [],
  }
}

async function finalizeWorkerResult(record) {
  if (!record?.result || finalizingJobs.has(record.jobId)) return
  finalizingJobs.add(record.jobId)
  const job = relayRuntimeJob(record)
  const user = job.input.email ? await findUserByEmail(job.input.email) : null
  try {
    let highlights = Array.isArray(record.result.highlights) ? record.result.highlights : []
    const segments = Array.isArray(record.result.segments) ? record.result.segments : []
    if (job.input.addSubtitles) {
      // The worker returns the raw OSS clip URLs. Subtitle burning remains on AWS
      // so the browser still sees the same /uploads URL contract as before.
      highlights = await burnSubtitles(highlights, segments, job.id, job.warnings)
    }
    await finalizeRelayJob(job.id, {
      status: 'done',
      label: 'Done',
      progress: 100,
      highlights,
      warnings: job.warnings,
      result: null,
      leaseId: '',
      leaseUntil: 0,
    })
    const seconds = Math.round((Date.now() - job.startedAt) / 1000)
    log(`${shortId(job.id)} ✓ 完成：${highlights.length} 个片段，耗时 ${seconds}s`)
    for (const warning of job.warnings) log(`${shortId(job.id)}   注意：${warning}`)
    await recordConsumption(job, user, 'done', creditsForSeconds(job.input.duration), highlights.length, '')
    await recordAssets(job, user, highlights)
  } catch (error) {
    const detail = error instanceof ApiError ? error.message : String(error?.message || error)
    await finalizeRelayJob(job.id, {
      status: 'error',
      label: 'Something went wrong',
      error: userFacingError(error, job.stage),
      progress: Math.min(99, Number(job.progress) || 0),
      result: null,
      leaseId: '',
      leaseUntil: 0,
    })
    log(`${shortId(job.id)} ✗ 失败于 ${job.stage}：${detail}`)
    await recordConsumption(job, user, 'error', 0, 0, detail)
  } finally {
    finalizingJobs.delete(job.id)
  }
}

function resumeFinalization(record) {
  finalizeWorkerResult(record).catch((error) => {
    console.error('[clip-api] 恢复中继任务失败：', error)
  })
}

async function createJob(input) {
  const job = await createRelayJob(input)
  const options = [
    input.duration ? `${Math.round(input.duration)}s` : '时长未知',
    input.removeSubtitles ? '去字幕' : null,
    input.addSubtitles ? '压字幕' : null,
  ].filter(Boolean)
  log(`${shortId(job.jobId)} 新任务 ${input.email || '(未登录)'} ${options.join(' · ')}`)
  log(`${shortId(job.jobId)}   源：${input.videoUrl}`)
  // Worker 会通过出站长轮询领取任务，接口本身只负责入队。
  return job
}

function workerTokenFromRequest(req) {
  const header = String(req.headers['x-worker-token'] || '').trim()
  if (header) return header
  const authorization = String(req.headers.authorization || '').trim()
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim()
  return authorization
}

function workerAuthorized(req) {
  if (!WORKER_TOKEN) return false
  const supplied = workerTokenFromRequest(req)
  const expected = Buffer.from(WORKER_TOKEN)
  const actual = Buffer.from(supplied)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

function requireWorker(req) {
  if (!WORKER_TOKEN) throw new ApiError('Worker relay is not configured.', 503)
  if (!workerAuthorized(req)) throw new ApiError('Unauthorized worker.', 401)
}

async function handleWorkerNext(req, res, url) {
  requireWorker(req)
  const waitMs = Math.min(WORKER_POLL_MAX_WAIT_MS, Math.max(0, Number(url.searchParams.get('wait') || 0) * 1000))
  const workerId = String(req.headers['x-worker-id'] || '').trim()
  let job = await claimNextJob(workerId)
  if (!job && waitMs > 0) {
    await waitForWork(waitMs)
    job = await claimNextJob(workerId)
  }
  sendJson(res, 200, { job: job || null, retryAfterMs: job ? 0 : 1000 })
}

async function recordWorkerFailure(record, detail) {
  if (!record) return
  const user = record.input?.email ? await findUserByEmail(record.input.email) : null
  await recordConsumption(relayRuntimeJob(record), user, 'error', 0, 0, detail)
}

async function handleWorkerEvent(req, res, jobId) {
  requireWorker(req)
  const body = await readJsonBody(req, 512 * 1024)
  const type = String(body.type || body.event || '').trim()
  if (!['started', 'progress', 'completed', 'failed'].includes(type)) {
    throw new ApiError('Unknown worker event.', 400)
  }
  const leaseId = String(body.leaseId || req.headers['x-worker-lease'] || '').trim()
  if (!leaseId) throw new ApiError('Missing worker lease.', 400)
  const result = await applyWorkerEvent(jobId, leaseId, { ...body, type })
  if (!result.ok) throw new ApiError(result.code === 'not_found' ? 'Worker job not found.' : 'Worker lease expired.', result.code === 'not_found' ? 404 : 409)

  if (type === 'completed') {
    resumeFinalization(result.job)
  } else if (type === 'failed') {
    recordWorkerFailure(result.job, result.job.error).catch((error) => console.error('[clip-api] 写 Worker 失败记录失败：', error))
  }
  sendJson(res, 202, { accepted: true, status: result.status })
}

function jobView(job) {
  const status = job.status === 'done' ? 'done' : job.status === 'error' ? 'error' : 'running'
  return {
    jobId: job.jobId || job.id,
    status,
    stage: ['desub', 'asr', 'clip', 'subtitles'].includes(job.stage) ? job.stage : 'asr',
    label: job.label || 'Processing your video…',
    progress: Math.max(0, Math.min(100, Number(job.progress) || 0)),
    warnings: Array.isArray(job.warnings) ? job.warnings : [],
    highlights: status === 'done' ? job.highlights || [] : [],
    error: status === 'error' ? job.error : null,
  }
}

async function handleCreateJob(req, res) {
  if (!WORKER_TOKEN) throw new ApiError('Video processing is not configured yet. Please try again later.', 503)
  const body = await readJsonBody(req)
  const videoUrl = String(body.videoUrl ?? '').trim()
  if (!/^https?:\/\//.test(videoUrl)) {
    throw new ApiError("That video link doesn't look right. Use a direct http(s) link, or upload the file instead.")
  }
  const job = await createJob({
    videoUrl,
    email: String(body.email ?? '').trim(),
    // 落盘后的 URL 认不出用户当初选的是哪个文件，账户页要显示来源就得前端带上。
    sourceName: String(body.sourceName ?? '').trim().slice(0, 200),
    duration: Number(body.duration) || 0,
    removeSubtitles: Boolean(body.removeSubtitles),
    addSubtitles: Boolean(body.addSubtitles),
  })
  sendJson(res, 202, jobView(job))
}

// ------------------------------------------------------------ 账户相关接口

async function handleSession(req, res) {
  const body = await readJsonBody(req, 64 * 1024)
  const email = String(body.email ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ApiError('email 格式不对')

  const { user, created } = await upsertUser({
    email,
    name: String(body.name ?? '').trim(),
    provider: String(body.provider ?? 'email').trim(),
    demo: body.demo !== false,
  })
  const account = await getAccount(user.email)
  sendJson(res, 200, { user, created, balance: account.balance })
}

async function handleAccount(req, res, url) {
  const email = String(url.searchParams.get('email') ?? '').trim()
  if (!email) throw new ApiError('缺少 email 参数')
  sendJson(res, 200, await getAccount(email))
}

/** 账户页的「我的成片」：这个邮箱剪出来的全部片段，新的在前。 */
async function handleAssets(req, res, url) {
  const email = String(url.searchParams.get('email') ?? '').trim()
  if (!email) throw new ApiError('缺少 email 参数')
  const assets = await listAssetsByEmail(email)
  sendJson(res, 200, { assets, total: assets.length })
}

async function handleTopup(req, res) {
  const body = await readJsonBody(req, 64 * 1024)
  const user = await findUserByEmail(body.email)
  if (!user) throw new ApiError('用户不存在，先登录一次', 404)

  let recharge
  try {
    recharge = await addRecharge({
      user,
      credits: body.credits,
      amount: body.amount,
      currency: body.currency ?? 'CNY',
      method: String(body.method ?? 'manual'),
      note: String(body.note ?? ''),
    })
  } catch (error) {
    throw new ApiError(error.message)
  }
  const account = await getAccount(user.email)
  sendJson(res, 200, { recharge, balance: account.balance })
}

// -------------------------------------------------------------------- 中间件

/** connect 风格中间件：vite dev server 和独立模式共用这一份实现。 */
export function createClipApi() {
  // 挂进 vite 时这里是唯一的入口，横幅也只能在这儿打。
  printBanner()
  return function clipApi(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)

    const handle = async () => {
      await ensureRelay()
      if (pathname === '/api/upload' && req.method === 'POST') {
        // Large uploads may legitimately take longer than Node's default request timeout.
        req.setTimeout?.(0)
        res.setTimeout?.(0)
        return handleUpload(req, res)
      }
      if (pathname === '/api/worker/jobs/next' && req.method === 'GET') {
        return handleWorkerNext(req, res, url)
      }
      if (pathname.startsWith('/api/worker/jobs/') && pathname.endsWith('/events') && req.method === 'POST') {
        const jobId = pathname.slice('/api/worker/jobs/'.length, -'/events'.length)
        return handleWorkerEvent(req, res, jobId)
      }
      if (pathname === '/api/clip' && req.method === 'POST') return handleCreateJob(req, res)
      if (pathname === '/api/session' && req.method === 'POST') return handleSession(req, res)
      if (pathname === '/api/account' && req.method === 'GET') return handleAccount(req, res, url)
      if (pathname === '/api/assets' && req.method === 'GET') return handleAssets(req, res, url)
      if (pathname === '/api/topup' && req.method === 'POST') return handleTopup(req, res)
      if (pathname.startsWith('/api/clip/') && req.method === 'GET') {
        const job = await getRelayJob(pathname.slice('/api/clip/'.length))
        if (!job) throw new ApiError('This job has expired. Please run it again.', 404)
        return sendJson(res, 200, jobView(job))
      }
      if (pathname.startsWith('/uploads/') && (req.method === 'GET' || req.method === 'HEAD')) {
        return serveUpload(req, res, pathname.slice('/uploads/'.length))
      }
      return next ? next() : sendJson(res, 404, { error: 'not found' })
    }

    handle().catch((error) => {
      const status = error instanceof ApiError ? error.status : 500
      if (status >= 500) console.error('[clip-api]', error)
      if (!res.headersSent) sendJson(res, status, { error: error.message })
      else res.end()
    })
  }
}

// 直接 `node scripts/clip-api.mjs` 时才起独立服务。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const middleware = createClipApi()
  http
    .createServer((req, res) => middleware(req, res, null))
    .listen(CLIP_API_PORT, '127.0.0.1', () => {
      log(`监听 http://127.0.0.1:${CLIP_API_PORT}`)
    })
}
