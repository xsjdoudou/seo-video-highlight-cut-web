// HTTP Basic Auth 反向代理，挡在 `vite preview` 前面。
//
// 用途：把 preview 暴露到公网（隧道）时加一道账号密码，挡掉扫描器和误入的人。
// 零依赖，只用 node 内置模块。
//
//   node scripts/auth-proxy.mjs
//
// 环境变量：
//   PROXY_PORT   代理监听端口        默认 10060
//   PROXY_HOST   代理监听地址        默认 127.0.0.1（只给本机的隧道进程连）
//   TARGET_PORT  vite preview 端口   默认 4173
//   CLIP_API_PORT  clip api 端口     默认 10051（/api/* 和 /uploads/* 转发到这里）
//   AUTH_USER    用户名              默认 demo
//   AUTH_PASS    密码                默认启动时随机生成并打印

import http from 'node:http'
import crypto from 'node:crypto'
import { env } from './env.mjs'

const PROXY_PORT = Number(env('PROXY_PORT', 10060))
const PROXY_HOST = env('PROXY_HOST', '127.0.0.1')
const TARGET_PORT = Number(env('TARGET_PORT', 4173))
const CLIP_API_PORT = Number(env('CLIP_API_PORT', 10051))
const AUTH_USER = env('AUTH_USER', 'demo')
// 走 env() 而不是 `??`：.env.example 里 AUTH_PASS 是留空的，`??` 会把 '' 当成
// 「设过了」，密码变成空串——等于这道 Basic Auth 形同虚设。留空必须走随机生成。
const AUTH_PASS = env('AUTH_PASS', crypto.randomBytes(12).toString('base64url'))

const REALM = 'seo-video-highlight preview'
const expected = 'Basic ' + Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')

// 先 sha256 再比较，避免 timingSafeEqual 对不等长输入抛错，同时不泄漏长度。
const digest = (s) => crypto.createHash('sha256').update(s).digest()
const expectedDigest = digest(expected)

function authorized(header) {
  if (!header) return false
  return crypto.timingSafeEqual(digest(header), expectedDigest)
}

const server = http.createServer((req, res) => {
  if (!authorized(req.headers.authorization)) {
    res.writeHead(401, {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain; charset=utf-8',
    })
    res.end('401 Unauthorized\n')
    return
  }

  // 透传给 preview。保留 method/url/headers，并以流的方式对接，
  // 这样视频的 Range 请求（拖进度条）能正常工作。
  // /api/* 和 /uploads/* 是剪辑接口和上传的素材，preview 不认，转给 clip-api。
  const toClipApi = req.url?.startsWith('/api/') || req.url?.startsWith('/uploads/')
  const port = toClipApi ? CLIP_API_PORT : TARGET_PORT
  const upstream = http.request(
    { host: '127.0.0.1', port, method: req.method, path: req.url, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
    },
  )

  // 剪辑是个长任务，轮询之外还有大文件上传，别让 node 默认超时掐断。
  upstream.setTimeout(0)
  req.setTimeout(0)

  upstream.on('error', (err) => {
    const hint = toClipApi ? 'node scripts/clip-api.mjs' : 'npm run preview'
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`502 Bad Gateway: 连不上 127.0.0.1:${port}，先跑 ${hint}\n${err.message}\n`)
  })

  req.pipe(upstream)
})

server.listen(PROXY_PORT, PROXY_HOST, () => {
  console.log(`auth proxy  http://${PROXY_HOST}:${PROXY_PORT}  ->  127.0.0.1:${TARGET_PORT}`)
  console.log(`            /api/*, /uploads/*              ->  127.0.0.1:${CLIP_API_PORT}`)
  console.log(`  用户名: ${AUTH_USER}`)
  console.log(`  密码:   ${AUTH_PASS}`)
  if (!process.env.AUTH_PASS) console.log('  (随机生成，重启会变；要固定就设 AUTH_PASS 环境变量)')
})
