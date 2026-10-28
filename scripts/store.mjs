// 四个文件撑起来的小存储：用户、充值、消费、资产。没有数据库，也不需要。
//
//   data/users.json          用户档案，按 id 存一个 JSON 数组，整体原子重写
//   data/recharges.jsonl     充值流水，一行一条，只追加
//   data/consumptions.jsonl  消费流水，一行一条，只追加
//   data/assets.jsonl        剪出来的成片，一条片段一行，只追加
//
// 流水用 JSONL 是因为它们只增不改：追加一行不会动到已经写好的内容，
// 进程被 kill 也最多丢最后一行。users.json 要改（最近登录时间、登录次数），
// 所以走「写临时文件再 rename」，避免写一半进程挂掉留下半个文件。
//
// 余额 = 充值总额 − 消费总额，不单独存，省掉对不上账的可能。
//
// 环境变量：
//   DATA_DIR               数据目录      默认 <repo>/data
//   SIGNUP_BONUS_CREDITS   注册赠送积分  默认 100（设 0 就不送）

import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from './env.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// env() 而不是 `??`：留空的 .env 行会让 `??` 的默认值失效，见 scripts/env.mjs。
// 这两项尤其不能变空——DATA_DIR='' 会把数据目录解析成当前工作目录。
export const DATA_DIR = path.resolve(env('DATA_DIR', path.join(REPO_ROOT, 'data')))
export const SIGNUP_BONUS_CREDITS = Math.max(0, Number(env('SIGNUP_BONUS_CREDITS', 100)))

const USERS_FILE = path.join(DATA_DIR, 'users.json')
const RECHARGES_FILE = path.join(DATA_DIR, 'recharges.jsonl')
const CONSUMPTIONS_FILE = path.join(DATA_DIR, 'consumptions.jsonl')
const ASSETS_FILE = path.join(DATA_DIR, 'assets.jsonl')

/** 和前端 src/lib/videoSource.ts 里的 CREDITS_PER_MINUTE 保持一致。 */
const CREDITS_PER_MINUTE = 2

/**
 * 所有写操作排成一条链，避免两个请求同时改 users.json 互相覆盖。
 *
 * 注意：锁不可重入——已经在 serialize 里跑的代码不能再调 serialize，
 * 那会等一个永远不会完成的自己。所以每个写操作都拆成「带锁的导出函数」
 * 和「不带锁的 *Locked 实现」，内部互相调用时走后者。
 */
let writeQueue = Promise.resolve()

function serialize(task) {
  const result = writeQueue.then(task, task)
  // 吞掉异常只是为了不让链断掉；真正的错误由 result 自己抛给调用方。
  writeQueue = result.catch(() => {})
  return result
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`
}

async function ensureDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true })
}

// ------------------------------------------------------------------ 读写原语

async function readJsonArray(file) {
  try {
    const text = await fsp.readFile(file, 'utf8')
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function writeJsonArray(file, rows) {
  await ensureDir()
  const temporary = `${file}.${process.pid}.tmp`
  await fsp.writeFile(temporary, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
  await fsp.rename(temporary, file)
}

async function readJsonLines(file) {
  let text
  try {
    text = await fsp.readFile(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const rows = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      rows.push(JSON.parse(trimmed))
    } catch {
      // 上次写到一半留下的残行，跳过就好，不要让整个文件读不出来。
    }
  }
  return rows
}

async function appendJsonLineLocked(file, row) {
  await ensureDir()
  await fsp.appendFile(file, `${JSON.stringify(row)}\n`, 'utf8')
  return row
}

// -------------------------------------------------------------------- 用户

function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function listUsers() {
  return readJsonArray(USERS_FILE)
}

export async function findUserByEmail(email) {
  const address = normalizeEmail(email)
  if (!address) return null
  const users = await readJsonArray(USERS_FILE)
  return users.find((user) => user.email === address) ?? null
}

/**
 * 登录即写档案：第一次见到这个邮箱就建号并发注册赠送积分，
 * 之后每次登录只更新 provider / 名字 / 最近登录时间。
 */
export function upsertUser({ email, name, provider, demo = true }) {
  const address = normalizeEmail(email)
  if (!address) throw new Error('email 不能为空')

  return serialize(async () => {
    const users = await readJsonArray(USERS_FILE)
    const now = new Date().toISOString()
    const index = users.findIndex((user) => user.email === address)

    if (index >= 0) {
      const existing = users[index]
      users[index] = {
        ...existing,
        name: name || existing.name,
        provider: provider || existing.provider,
        demo,
        lastLoginAt: now,
        loginCount: (existing.loginCount ?? 0) + 1,
      }
      await writeJsonArray(USERS_FILE, users)
      return { user: users[index], created: false }
    }

    const user = {
      id: id('u'),
      email: address,
      name: name || address.split('@')[0],
      provider: provider || 'email',
      demo,
      createdAt: now,
      lastLoginAt: now,
      loginCount: 1,
    }
    users.push(user)
    await writeJsonArray(USERS_FILE, users)

    if (SIGNUP_BONUS_CREDITS > 0) {
      await addRechargeLocked({
        user,
        credits: SIGNUP_BONUS_CREDITS,
        amount: 0,
        method: 'signup_bonus',
        note: '新用户注册赠送',
      })
    }
    return { user, created: true }
  })
}

// -------------------------------------------------------------------- 充值

export function listRecharges() {
  return readJsonLines(RECHARGES_FILE)
}

export function addRecharge(input) {
  const row = buildRecharge(input)
  return serialize(() => appendJsonLineLocked(RECHARGES_FILE, row))
}

function addRechargeLocked(input) {
  return appendJsonLineLocked(RECHARGES_FILE, buildRecharge(input))
}

function buildRecharge({ user, credits, amount = 0, currency = 'CNY', method = 'manual', note = '' }) {
  const value = Math.round(Number(credits))
  if (!Number.isFinite(value) || value <= 0) throw new Error('credits 必须是正整数')

  return {
    id: id('r'),
    userId: user.id,
    email: user.email,
    credits: value,
    amount: Number(amount) || 0,
    currency,
    method,
    note,
    createdAt: new Date().toISOString(),
  }
}

// -------------------------------------------------------------------- 消费

export function listConsumptions() {
  return readJsonLines(CONSUMPTIONS_FILE)
}

/** 按源视频时长算积分，和页面上「Credit usage」显示的是同一个口径。 */
export function creditsForSeconds(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.max(1, Math.round((value / 60) * CREDITS_PER_MINUTE))
}

/**
 * 一次剪辑记一条。失败的任务也记，但 credits 记 0——
 * 没出片不该扣钱，可是排查问题时你会想知道它跑过。
 */
export function addConsumption({ user, jobId, credits, status, durationSeconds = 0, aspect = '', clips = 0, error = '' }) {
  const row = {
    id: id('c'),
    userId: user?.id ?? null,
    email: user?.email ?? null,
    jobId,
    kind: 'highlight_cut',
    credits: Math.max(0, Math.round(Number(credits) || 0)),
    status,
    durationSeconds: Number(durationSeconds) || 0,
    aspect,
    clips,
    error: error ? String(error).slice(0, 500) : '',
    createdAt: new Date().toISOString(),
  }
  return serialize(() => appendJsonLineLocked(CONSUMPTIONS_FILE, row))
}

// -------------------------------------------------------------------- 资产
//
// 成片是用户真正拿走的东西，而消费流水里只有「这趟剪出了几条」这个数字。
// 账户页要把片子本身列出来，所以每条高光单独存一行：下游返回的 highlight
// 原样留着，前端复用 highlightsToClips 映射，不用在两处各写一份字段对应关系。

export function listAssets() {
  return readJsonLines(ASSETS_FILE)
}

/**
 * 一趟任务的全部成片记一批。没登录（user 为空）就不记——资产得挂在某个账户下，
 * 否则没人能再找到它。
 */
export function addAssets({ user, jobId, sourceName = '', sourceUrl = '', highlights = [] }) {
  if (!user || !highlights.length) return Promise.resolve([])

  const createdAt = new Date().toISOString()
  const rows = highlights.map((highlight, index) => ({
    id: id('a'),
    userId: user.id,
    email: user.email,
    jobId,
    rank: Number(highlight?.rank) || index + 1,
    sourceName,
    sourceUrl,
    highlight,
    createdAt,
  }))

  return serialize(async () => {
    for (const row of rows) await appendJsonLineLocked(ASSETS_FILE, row)
    return rows
  })
}

/** 某个用户的全部成片，新的在前。 */
export async function listAssetsByEmail(email, { limit = 200 } = {}) {
  const address = normalizeEmail(email)
  if (!address) return []
  const rows = await readJsonLines(ASSETS_FILE)
  return rows
    .filter((row) => row.email === address)
    .slice(-limit)
    .reverse()
}

// -------------------------------------------------------------------- 账户

/** 某个用户的余额和流水；email 不存在时返回空账户而不是报错。 */
export async function getAccount(email, { limit = 20 } = {}) {
  const address = normalizeEmail(email)
  const [user, recharges, consumptions] = await Promise.all([
    findUserByEmail(address),
    readJsonLines(RECHARGES_FILE),
    readJsonLines(CONSUMPTIONS_FILE),
  ])

  const mine = (rows) => rows.filter((row) => row.email === address)
  const myRecharges = mine(recharges)
  const myConsumptions = mine(consumptions)
  const recharged = myRecharges.reduce((total, row) => total + (Number(row.credits) || 0), 0)
  const spent = myConsumptions.reduce((total, row) => total + (Number(row.credits) || 0), 0)

  return {
    user,
    recharged,
    spent,
    balance: recharged - spent,
    recharges: myRecharges.slice(-limit).reverse(),
    consumptions: myConsumptions.slice(-limit).reverse(),
  }
}

/** 启动时打印一下，省得找不到文件写到哪去了。 */
export function describeStore() {
  return {
    users: USERS_FILE,
    recharges: RECHARGES_FILE,
    consumptions: CONSUMPTIONS_FILE,
    assets: ASSETS_FILE,
    exists: {
      users: fs.existsSync(USERS_FILE),
      recharges: fs.existsSync(RECHARGES_FILE),
      consumptions: fs.existsSync(CONSUMPTIONS_FILE),
      assets: fs.existsSync(ASSETS_FILE),
    },
  }
}
