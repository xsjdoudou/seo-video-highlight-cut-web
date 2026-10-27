import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createClipApi } from './scripts/clip-api.mjs'

const DEV_PORT = 10050

export default defineConfig({
  plugins: [
    react(),
    {
      // 上传 /api/* 和 /uploads/* 都由 scripts/clip-api.mjs 处理。dev 下直接挂进来，
      // 省掉再起一个进程；preview 走 scripts/auth-proxy.mjs 转发到独立实例。
      name: 'clip-api',
      configureServer(server) {
        // A source video can take several minutes over a tunnel. Node's default
        // request timeout would otherwise close an otherwise healthy upload.
        if (server.httpServer) {
          server.httpServer.requestTimeout = 0
          server.httpServer.headersTimeout = 0
        }
        server.middlewares.use(createClipApi())
      },
    },
  ],
  server: { host: true, port: DEV_PORT, strictPort: true },
  preview: {
    // 只听本地：对外一律经 scripts/auth-proxy.mjs，避免绕过 Basic Auth 直连 4173
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    // 隧道的随机域名，Host 头校验需要放行（IP 直连默认放行，域名不会）
    allowedHosts: ['.trycloudflare.com', '.loca.lt', '.pinggy.link'],
  },
})
