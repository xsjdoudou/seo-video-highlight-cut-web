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
//
// ⚠ 这个文件要能被**老版本 node 解析**，所以故意不用 ?? 、?. 、顶层 await，
//   import 也不加 node: 前缀。因为 node 是先把整个模块解析完再执行的：只要
//   文件里有一个它不认识的语法，下面那段版本检查根本没机会跑，用户看到的
//   就是 `SyntaxError: Unexpected token '?'` 这种完全看不出所以然的报错。
//   仓库里其他脚本不受这条约束，它们跑起来的时候版本已经验过了。

import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

// vite 7 要求 node >= 20.19。低于这个版本装依赖能过，但一跑就炸。
var MIN_NODE = [20, 19, 0]

function parseVersion(raw) {
  var parts = String(raw).replace(/^v/, '').split('.')
  return [Number(parts[0]) || 0, Number(parts[1]) || 0, Number(parts[2]) || 0]
}

function tooOld(current, minimum) {
  for (var i = 0; i < 3; i++) {
    if (current[i] > minimum[i]) return false
    if (current[i] < minimum[i]) return true
  }
  return false
}

if (tooOld(parseVersion(process.versions.node), MIN_NODE)) {
  console.error('')
  console.error('  node 版本太低：当前 v' + process.versions.node + '，需要 >= ' + MIN_NODE.join('.'))
  console.error('  (' + process.execPath + ')')
  console.error('')
  console.error('  装新版：')
  console.error('    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -')
  console.error('    sudo apt-get install -y nodejs')
  console.error('')
  console.error('  装完 `node -v` 还是旧版本的话，多半是 conda 的 bin 排在 PATH 前面')
  console.error('  把它挡住了（提示符上有 (base) 就是）。验一下：')
  console.error('    which -a node')
  console.error('  是的话 `conda deactivate` 之后重开一个 shell，再 npm ci 重装依赖。')
  console.error('')
  process.exit(1)
}

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
  for (const key of Object.keys(values)) {
    // 已经在环境里的不动：命令行临时指定的值要赢过文件。
    if (process.env[key] !== undefined) continue
    process.env[key] = values[key]
    applied.push(key)
  }
  return applied
}

const command = process.argv[2]
const args = process.argv.slice(3)
if (!command) {
  console.error('用法: node scripts/with-env.mjs <命令> [参数...]')
  process.exit(2)
}

const applied = loadEnvFile(ENV_FILE)
if (applied === null) {
  console.error('[with-env] 没有 ' + ENV_FILE + '，只用当前环境变量')
} else {
  // 只打变量名，不打值——令牌不该进日志。
  const names = applied.length ? applied.join(', ') : '(都已在环境里，未覆盖)'
  console.error('[with-env] 从 ' + ENV_FILE + ' 读到 ' + applied.length + ' 个变量: ' + names)
}

const child = spawn(command, args, { stdio: 'inherit' })

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, function () { child.kill(signal) })
}

child.on('error', function (error) {
  console.error('[with-env] 起不来 ' + command + ': ' + error.message)
  process.exit(127)
})

// 被信号杀掉的话按 shell 的惯例退 128+N，别让 systemd 以为是正常退出。
child.on('exit', function (code, signal) {
  if (signal) {
    const num = os.constants.signals[signal]
    process.exit(128 + (num === undefined ? 0 : num))
  }
  process.exit(code === null ? 0 : code)
})
