import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'

import { DATA_DIR } from './store.mjs'
import { env } from './env.mjs'

const FILE = path.resolve(env('RELAY_STORE_FILE', path.join(DATA_DIR, 'worker-relay.json')))
const LEASE_MS = Math.max(30_000, Number(env('WORKER_LEASE_MS', 90_000)))
const RETENTION_MS = Math.max(60_000, Number(env('RELAY_JOB_RETENTION_MS', 7 * 24 * 60 * 60 * 1000)))

let statePromise = null
let writeQueue = Promise.resolve()
const waiters = new Set()

function emptyState() {
  return { version: 1, jobs: {} }
}

async function readState() {
  try {
    const parsed = JSON.parse(await fsp.readFile(FILE, 'utf8'))
    return parsed && typeof parsed.jobs === 'object' ? parsed : emptyState()
  } catch (error) {
    if (error.code === 'ENOENT') return emptyState()
    throw error
  }
}

async function state() {
  if (!statePromise) statePromise = readState()
  return statePromise
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function notify() {
  for (const resolve of waiters) resolve()
  waiters.clear()
}

async function persist(next) {
  await fsp.mkdir(path.dirname(FILE), { recursive: true })
  const temporary = `${FILE}.${process.pid}.tmp`
  await fsp.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  await fsp.rename(temporary, FILE)
  statePromise = Promise.resolve(next)
}

function mutate(task) {
  const result = writeQueue.then(async () => {
    const current = await state()
    const next = clone(current)
    const value = await task(next)
    await persist(next)
    return value
  })
  writeQueue = result.catch(() => {})
  return result
}

function recoverExpired(next, now = Date.now()) {
  let changed = false
  for (const job of Object.values(next.jobs)) {
    if (job.status === 'running' && Number(job.leaseUntil) <= now) {
      job.status = 'queued'
      job.leaseId = ''
      job.leaseUntil = 0
      job.updatedAt = now
      changed = true
    }
  }
  return changed
}

function prune(next, now = Date.now()) {
  for (const [jobId, job] of Object.entries(next.jobs)) {
    if (now - Number(job.updatedAt || job.createdAt || now) > RETENTION_MS) delete next.jobs[jobId]
  }
}

export async function initializeRelay() {
  await mutate((next) => {
    recoverExpired(next)
    prune(next)
  })
  return listRelayJobs()
}

export async function listRelayJobs() {
  const current = await state()
  return Object.values(current.jobs).map(clone)
}

export async function getRelayJob(jobId) {
  const current = await state()
  return clone(current.jobs[jobId] || null)
}

export async function createRelayJob(input) {
  const now = Date.now()
  const job = {
    jobId: crypto.randomUUID(),
    status: 'queued',
    stage: 'asr',
    label: 'Waiting for a processing worker…',
    progress: 0,
    warnings: [],
    highlights: [],
    error: null,
    input,
    taskId: '',
    leaseId: '',
    leaseUntil: 0,
    result: null,
    createdAt: now,
    startedAt: 0,
    updatedAt: now,
  }
  await mutate((next) => {
    next.jobs[job.jobId] = job
  })
  notify()
  return clone(job)
}

export async function claimNextJob(workerId = '') {
  const now = Date.now()
  const claimed = await mutate((next) => {
    recoverExpired(next, now)
    prune(next, now)
    const job = Object.values(next.jobs)
      .filter((item) => item.status === 'queued')
      .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))[0]
    if (!job) return null
    job.status = 'running'
    job.leaseId = crypto.randomUUID()
    job.leaseUntil = now + LEASE_MS
    job.workerId = String(workerId || '').slice(0, 120)
    job.startedAt ||= now
    job.stage = 'fetch'
    job.label = 'Fetching your video…'
    job.progress = Math.max(2, Number(job.progress) || 0)
    job.updatedAt = now
    return {
      jobId: job.jobId,
      leaseId: job.leaseId,
      leaseUntil: job.leaseUntil,
      input: clone(job.input),
    }
  })
  return claimed
}

export async function waitForWork(timeoutMs) {
  const waitMs = Math.max(0, Math.min(30_000, Number(timeoutMs) || 0))
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(wake)
      resolve()
    }, waitMs)
    const wake = () => {
      clearTimeout(timer)
      waiters.delete(wake)
      resolve()
    }
    waiters.add(wake)
  })
}

export async function applyWorkerEvent(jobId, leaseId, event) {
  const now = Date.now()
  const result = await mutate((next) => {
    const job = next.jobs[jobId]
    if (!job) return { ok: false, code: 'not_found' }
    if (job.status !== 'running' || job.leaseId !== leaseId) return { ok: false, code: 'lease_lost' }

    job.leaseUntil = now + LEASE_MS
    job.updatedAt = now
    if (event.taskId) job.taskId = String(event.taskId).slice(0, 200)
    if (event.currentStage) job.currentStage = String(event.currentStage).slice(0, 120)
    if (Number.isFinite(Number(event.progress))) job.progress = Math.max(0, Math.min(99, Math.round(Number(event.progress))))
    if (event.stage && ['fetch', 'transfer', 'desub', 'asr', 'clip', 'subtitles'].includes(event.stage)) job.stage = event.stage
    if (event.label) job.label = String(event.label).slice(0, 200)

    if (event.type === 'started') {
      job.status = 'running'
      job.label = event.label || 'Processing your video…'
    } else if (event.type === 'completed') {
      const payload = event.result || event
      job.status = 'finalizing'
      job.result = {
        highlights: Array.isArray(payload.highlights) ? payload.highlights : [],
        segments: Array.isArray(payload.segments) ? payload.segments : Array.isArray(payload.asr?.segments) ? payload.asr.segments : [],
      }
      job.leaseId = ''
      job.leaseUntil = 0
      job.label = 'Preparing your clips…'
      job.progress = 90
    } else if (event.type === 'failed') {
      job.status = 'error'
      job.error = String(event.error || 'The processing worker failed.').slice(0, 1000)
      job.leaseId = ''
      job.leaseUntil = 0
      job.label = 'Something went wrong'
      job.progress = Math.min(99, Number(job.progress) || 0)
    }
    return { ok: true, status: job.status, job: clone(job) }
  })
  if (result.ok && result.status === 'queued') notify()
  return result
}

export async function finalizeRelayJob(jobId, updates) {
  return mutate((next) => {
    const job = next.jobs[jobId]
    if (!job) return null
    Object.assign(job, updates, { updatedAt: Date.now() })
    return clone(job)
  })
}

export function relayFile() {
  return FILE
}
