/**
 * 前端这一侧的剪辑接口：上传源视频、建任务、轮询，最后把服务端返回的
 * highlights 映射成页面已有的 Clip 结构。后端实现在 scripts/clip-api.mjs。
 */

import type { Clip, ClipEvaluation, Platform, ScoreBreakdown } from '../data/clips'

export type Highlight = {
  rank: number
  shot_id: string
  start: number
  end: number
  duration: number
  transcript: string
  score: { score_type: string; score: number; reason: string }[]
  highlight_reason: string
  transcript_summary: string
  type_zh: string
  type_en: string
  video_url: string
}

export type JobView = {
  jobId: string
  status: 'running' | 'done' | 'error'
  stage: 'desub' | 'asr' | 'clip' | 'subtitles'
  label: string
  progress: number
  warnings: string[]
  highlights: Highlight[]
  error: string | null
}

export type ClipJobInput = {
  videoUrl: string
  duration: number
  removeSubtitles: boolean
  addSubtitles: boolean
  /** 登录邮箱，用来把这次消费记到对应账户下。 */
  email?: string
  /** 用户看到的来源名（链接本身或上传的文件名），账户页用它标明片子是从哪剪的。 */
  sourceName?: string
}

const PLATFORMS: Platform[] = ['youtube', 'instagram', 'linkedin', 'tiktok', 'facebook', 'x']

/** 页面上拿不到更具体的原因时说这一句，跟后端的同名常量保持一致。 */
export const GENERIC_FAILURE = "That didn't go through. Please try again."

/** A stalled proxy connection should not leave the confirm page disabled forever. */
const UPLOAD_INACTIVITY_TIMEOUT_MS = 90_000

/**
 * 服务端给的错误是写给用户看的一句话，可以直接显示。
 * 其余异常（断网、代理返回 HTML 错误页）只会暴露内部细节，页面上要换成 GENERIC_FAILURE。
 */
export class ServerMessage extends Error {}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  try {
    const message = JSON.parse(text).error
    if (typeof message === 'string' && message.trim()) return message
  } catch {
    /* 不是 JSON，多半是 dev server 或代理给的错误页，不往页面上贴 */
  }
  return GENERIC_FAILURE
}

/**
 * 上传源视频，拿到一个服务端能下载的 URL。用 XHR 而不是 fetch，
 * 只因为要显示上传进度——几百 MB 的文件没进度条很难熬。
 */
export function uploadVideo(file: File, onProgress: (ratio: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let inactivityTimer = 0
    let settled = false
    let stalled = false

    const clearInactivityTimer = () => window.clearTimeout(inactivityTimer)
    const fail = (message: string) => {
      if (settled) return
      settled = true
      clearInactivityTimer()
      reject(new ServerMessage(message))
    }
    const armInactivityTimer = () => {
      clearInactivityTimer()
      inactivityTimer = window.setTimeout(() => {
        stalled = true
        xhr.abort()
        fail('The upload stalled. Check your connection and try again.')
      }, UPLOAD_INACTIVITY_TIMEOUT_MS)
    }

    xhr.open('POST', '/api/upload')
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    // 文件名可能是中文，头里只能放 ASCII。
    xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name))
    xhr.upload.onprogress = (e) => {
      armInactivityTimer()
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.upload.onload = () => {
      // The request body is sent, but the server may still be finishing the file.
      onProgress(1)
      armInactivityTimer()
    }
    xhr.onload = () => {
      if (settled) return
      settled = true
      clearInactivityTimer()
      let payload: { url?: string; error?: string } = {}
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        /* 下面统一按失败处理 */
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload.url) resolve(payload.url)
      else reject(new ServerMessage(payload.error ?? 'Uploading your video failed. Please try again.'))
    }
    xhr.onerror = () => fail("Can't reach the server. Check your connection and try again.")
    xhr.onabort = () => fail(stalled ? 'The upload stalled. Check your connection and try again.' : 'The upload was interrupted. Please try again.')
    xhr.ontimeout = () => fail('The upload took too long. Check your connection and try again.')
    armInactivityTimer()
    xhr.send(file)
  })
}

export async function createClipJob(input: ClipJobInput): Promise<JobView> {
  const response = await fetch('/api/clip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new ServerMessage(await readError(response))
  return response.json()
}

export async function fetchClipJob(jobId: string): Promise<JobView> {
  const response = await fetch(`/api/clip/${jobId}`)
  if (!response.ok) throw new ServerMessage(await readError(response))
  return response.json()
}

function scoreOf(highlight: Highlight, type: string): number {
  const entry = highlight.score?.find((item) => item.score_type === type)
  return Math.round(Number(entry?.score) || 0)
}

function breakdown(highlight: Highlight): ScoreBreakdown {
  return {
    hook: scoreOf(highlight, 'hook'),
    value: scoreOf(highlight, 'value'),
    emotion: scoreOf(highlight, 'emotion'),
    standalone: scoreOf(highlight, 'standalone'),
    quotability: scoreOf(highlight, 'quotability'),
    clarity: scoreOf(highlight, 'clarity'),
  }
}

const SCORE_KEYS: (keyof ScoreBreakdown)[] = ['hook', 'value', 'emotion', 'standalone', 'quotability', 'clarity']

function evaluationOf(highlight: Highlight): ClipEvaluation {
  const reasons: ClipEvaluation['reasons'] = {}
  for (const item of highlight.score ?? []) {
    if (SCORE_KEYS.includes(item.score_type as keyof ScoreBreakdown) && item.reason?.trim()) {
      reasons[item.score_type as keyof ScoreBreakdown] = item.reason.trim()
    }
  }
  return {
    conclusion: highlight.highlight_reason?.trim() || undefined,
    summary: highlight.transcript_summary?.trim() || undefined,
    reasons,
  }
}

/** 卡片标题：优先摘要，退回第一句台词，再退回类型标签。 */
function titleOf(highlight: Highlight): string {
  const summary = (highlight.transcript_summary || '').trim()
  if (summary) return summary
  const line = (highlight.transcript || '').replace(/^[^:：]{1,20}[:：]\s*/, '').trim()
  if (line) return line.length > 42 ? `${line.slice(0, 42)}…` : line
  return highlight.type_en || highlight.type_zh || 'Highlight'
}

/**
 * 成片直接当预览用：这些片段本来就只有几十秒，没有单独的预览转码。
 * poster 留空，浏览器会自己拿第一帧。
 */
export function highlightsToClips(highlights: Highlight[]): Clip[] {
  return highlights.map((highlight, i) => ({
    id: `h${String(highlight.rank ?? i + 1).padStart(2, '0')}`,
    score: scoreOf(highlight, 'sum'),
    scores: breakdown(highlight),
    type: highlight.type_en || highlight.type_zh || 'Highlight',
    sourceStart: Number(highlight.start) || 0,
    sourceEnd: Number(highlight.end) || 0,
    duration: Number(highlight.duration) || Math.max(0, (Number(highlight.end) || 0) - (Number(highlight.start) || 0)),
    video: highlight.video_url,
    preview: highlight.video_url,
    poster: '',
    title: titleOf(highlight),
    platform: PLATFORMS[i % PLATFORMS.length],
    evaluation: evaluationOf(highlight),
  }))
}
