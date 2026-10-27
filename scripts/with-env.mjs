#!/usr/bin/env node
// 读 .env，再把后面的命令当子进程跑起来。
//
//   node scripts/with-env.mjs vite
//   node scripts/with-env.mjs node scripts/clip-api.mjs
//   ENV_FILE=/etc/seo-web.env node scripts/with-env.mjs node scripts/clip-api.mjs
//
// 为什么不直接用 node --env-file：
//
//   * dev 模式下跑的是 vite，不是 node——clip-api 是被 vite.config.ts 挂进
//     vite 进程里的（见那边的 configureServer）。给 vite 加 node 参数只能走
//     NODE_OPTIONS，而 node 明确拒绝 NODE_OPTIONS 里出现 --env-file
//     （"--env-file= is not allowed in NODE_OPTIONS"）。
//   * --env-file 碰到文件不存在会直接报错退出。本机联调一般不需要 .env，
//     不该因为少一个文件就起不来。
//
// 规则和 node --env-file 对齐：已经存在的环境变量优先，文件里的值不覆盖它。
// 这样 `SEO_TOKEN=xxx npm run dev` 能临时盖掉文件里的值，不用改文件。

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = process.env.ENV_FILE || path.join(REPO_ROOT, '.env')

/** 支持 KEY=value、# 注释、前缀 export、单双引号。双引号里认 \n 和 \t。 */
function parseEnv(text) {
  const values = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq <= 0) continue

    const key = line.slice(0, eq).replace(/^export\s+/, '').trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    let value = line.slice(eq + 1).trim()
    if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1)
    } else if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t')
    } else {
      // 没加引号时，行尾的 # 注释不算值的一部分
      value = value.replace(/\s+#.*$/, '').trim()
    }
    values[key] = value
  }
  return values
}

function loadEnvFile(file) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }

  const values = parseEnv(text)
  const applied = []
  for (const [key, value] of Object.entries(values)) {
    // 已经在环境里的不动：命令行临时指定的值要赢过文件。
    if (process.env[key] !== undefined) continue
    process.env[key] = value
    applied.push(key)
  }
  return applied
}

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('用法: node scripts/with-env.mjs <命令> [参数...]')
  process.exit(2)
}

const applied = loadEnvFile(ENV_FILE)
if (applied === null) {
  console.error(`[with-env] 没有 ${ENV_FILE}，只用当前环境变量`)
} else {
  // 只打变量名，不打值——令牌不该进日志。
  console.error(`[with-env] 从 ${ENV_FILE} 读到 ${applied.length} 个变量: ${applied.join(', ') || '(都已在环境里，未覆盖)'}`)
}

const child = spawn(command, args, { stdio: 'inherit' })

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', (error) => {
  console.error(`[with-env] 起不来 ${command}: ${error.message}`)
  process.exit(127)
})

// 被信号杀掉的话按 shell 的惯例退 128+N，别让 systemd 以为是正常退出。
child.on('exit', (code, signal) => {
  process.exit(signal ? 128 + (os.constants.signals[signal] ?? 0) : (code ?? 0))
})
