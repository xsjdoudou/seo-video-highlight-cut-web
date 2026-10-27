#!/usr/bin/env node
// 部署自检：这台机器到底能不能用上国内那个剪辑服务。
//
//   npm run check:seo
//
// 读 SEO_URL / SEO_PATH / SEO_TOKEN（经 scripts/with-env.mjs 从 .env 来）。
// 全程不打印令牌，只说它好使还是不好使。
//
// 三步，每步失败的原因都不一样，分开查才看得出是哪一环：
//
//   1. SEO_URL 本身能不能解析成一个带协议和端口的地址
//   2. GET /health_check —— 不需要令牌。通了说明网络、端口、安全组都对
//   3. GET <SEO_PATH>/<随机 task_id> 带上令牌 —— 只验令牌
//      · 404 task not found = 令牌对了，请求进到了业务逻辑（这个 id 本来就不存在）
//      · 401 = 令牌不对或者没带
//      这一步什么都不会创建，也不会占 GPU。
//
// 退出码：0 全通，1 有问题。可以直接挂进部署脚本。

import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'

const SEO_URL = (process.env.SEO_URL ?? 'http://127.0.0.1:8649').replace(/\/+$/, '')
const SEO_PATH = process.env.SEO_PATH ?? '/v1/seo'
const SEO_TOKEN = (process.env.SEO_TOKEN ?? '').trim()
const TIMEOUT_MS = Number(process.env.SEO_REQUEST_TIMEOUT_MS ?? 15000)

const problems = []
const ok = (text) => console.log(`  \x1b[32m✓\x1b[0m ${text}`)
const bad = (text, fix) => {
  console.log(`  \x1b[31m✗\x1b[0m ${text}`)
  if (fix) console.log(`      ${fix}`)
  problems.push(text)
}

function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http
    const req = client.request(url, { method: 'GET', headers, timeout: TIMEOUT_MS }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () =>
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8').slice(0, 300) }),
      )
    })
    req.on('timeout', () => req.destroy(new Error(`超过 ${TIMEOUT_MS}ms 没响应`)))
    req.on('error', reject)
    req.end()
  })
}

// ── 1. 地址本身 ───────────────────────────────────────────────────────────
console.log('\n[1/3] SEO_URL')
let parsed = null
try {
  parsed = new URL(SEO_URL)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`协议是 ${parsed.protocol}`)
  ok(`${parsed.protocol}//${parsed.hostname}:${parsed.port || '(默认)'}`)

  // 端口只在指向远端时才有讲究。本机联调用 8649 是对的，国内那台机器上
  // seo_server.py 的默认端口就是它；跨境走的才必须是安全组放通的 10080。
  const isLocal = ['127.0.0.1', '::1', 'localhost'].includes(parsed.hostname)
  if (isLocal) {
    ok('指向本机，端口不做要求')
  } else if (!parsed.port && parsed.protocol === 'http:') {
    bad(
      '没写端口',
      '国内那台的安全组只放通 10080，必须显式写上：SEO_URL=http://101.132.167.193:10080',
    )
  } else if (parsed.port === '8649') {
    bad(
      '端口是 8649',
      '那是 seo_server.py 的默认端口，但安全组没放通它，从外网连过去只会超时。' +
        '改成 10080，国内起服务时也要带 SEO_PORT=10080。',
    )
  }
} catch (error) {
  bad(`解析不了：${error.message}`, `SEO_URL 现在是 "${SEO_URL}"。裸 IP 不行，要写成 http://101.132.167.193:10080`)
}

// ── 2. 连通性 ─────────────────────────────────────────────────────────────
console.log('\n[2/3] 连通性（GET /health_check，不需要令牌）')
let reachable = false
if (!parsed) {
  console.log('  \x1b[33m-\x1b[0m 跳过，先把上一步修好')
} else {
  try {
    const res = await request(`${SEO_URL}/health_check`)
    if (res.status === 200) {
      reachable = true
      ok('连上了，网络 / 端口 / 安全组都对')
    } else {
      bad(`HTTP ${res.status}`, `响应体：${res.body}`)
    }
  } catch (error) {
    bad(
      `连不上：${error.message}`,
      '按顺序查：国内的服务起了吗（SEO_PORT=10080 python seo_server.py）；' +
        '安全组放通 10080 了吗；端口写对了吗。',
    )
  }
}

// ── 3. 令牌 ───────────────────────────────────────────────────────────────
console.log('\n[3/3] 令牌（GET 一个不存在的 task_id，不创建任何东西）')
if (!reachable) {
  console.log('  \x1b[33m-\x1b[0m 跳过，先把上一步修好')
} else {
  const probeUrl = `${SEO_URL}${SEO_PATH}/${crypto.randomUUID()}`
  const headers = SEO_TOKEN ? { Authorization: `Bearer ${SEO_TOKEN}` } : {}
  try {
    const res = await request(probeUrl, headers)
    if (res.status === 404) {
      ok(SEO_TOKEN ? '令牌对了（服务端认了，只是这个 task_id 不存在）' : '服务端没开鉴权，放行了')
      if (!SEO_TOKEN) {
        bad(
          '国内那边没开鉴权',
          '10080 是对公网开着的，现在谁扫到都能用这台机器的 GPU。' +
            '赶紧在 Nacos 里配上 seo_token 并重启服务。',
        )
      }
    } else if (res.status === 401) {
      bad(
        SEO_TOKEN ? '令牌不对' : '服务端开了鉴权，但这里没设 SEO_TOKEN',
        SEO_TOKEN
          ? '本地 SEO_TOKEN 和国内 Nacos 里的 seo_token 不是同一个值。' +
            '两边别互相贴明文，各自算一下 sha256 比对前 12 位就行。'
          : '把国内 Nacos 里 seo_token 的值填进这台机器的 .env。',
      )
    } else {
      bad(`没见过的 HTTP ${res.status}`, `响应体：${res.body}`)
    }
  } catch (error) {
    bad(`请求失败：${error.message}`)
  }
}

// ── 结论 ──────────────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log('\n\x1b[32m全通了。\x1b[0m 接着跑 npm run check:oss 验上传那一侧。\n')
} else {
  console.log(`\n\x1b[31m${problems.length} 个问题\x1b[0m，按上面的提示从第一个开始修。\n`)
  process.exit(1)
}
