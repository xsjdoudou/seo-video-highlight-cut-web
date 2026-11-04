/**
 * Everything the confirm page needs to know about the video a visitor dropped
 * in, worked out entirely in the browser: there is no backend to ask.
 */

export type JobInput = { kind: 'link'; url: string } | { kind: 'file'; file: File }

export type SourceInfo = {
  /** Poster to show in the confirm page, or null when we cannot get one. */
  poster: string | null
  /** Seconds, or null when unknown (we cannot measure a remote link). */
  duration: number | null
  /** Vertical resolution for the quality badge, or null when unknown. */
  height: number | null
}

/** Credits per minute of source video — the number shown as "Credit usage". */
const CREDITS_PER_MINUTE = 2

/** How long we wait for the browser to decode a frame before giving up. */
const DECODE_TIMEOUT_MS = 3000

export function estimateCredits(seconds: number): number {
  return Math.max(1, Math.round((seconds / 60) * CREDITS_PER_MINUTE))
}

/** Video id from the usual YouTube URL shapes, or null for anything else. */
export function parseYouTubeId(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : host.endsWith('youtube.com') || host === 'youtube-nocookie.com'
        ? url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? ''
        : ''
  return /^[\w-]{11}$/.test(id) ? id : null
}

export function youTubeThumb(id: string, size: 'maxres' | 'hq' = 'maxres'): string {
  return `https://i.ytimg.com/vi/${id}/${size}default.jpg`
}

/** Pretty file size for the source pill: "412.6 MB". */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * Pull a poster frame, the duration and the resolution out of a local file.
 * Grabs a frame a quarter of the way in — the very first frame is often black.
 * Resolves with nulls rather than rejecting: a codec the browser cannot decode
 * is a cosmetic problem, the confirm page still works without a preview.
 */
export function readLocalVideo(file: File): Promise<SourceInfo> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    let metadata: { duration: number; height: number } | null = null
    let timer = 0
    let done = false

    const finish = (info: SourceInfo) => {
      if (done) return
      done = true
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(objectUrl)
      resolve(info)
    }

    // Metadata usually arrives well before a decoded frame does, so a timeout
    // still reports the duration we already have.
    timer = window.setTimeout(
      () => finish({ poster: null, duration: metadata?.duration ?? null, height: metadata?.height ?? null }),
      DECODE_TIMEOUT_MS,
    )

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = objectUrl

    video.onerror = () => finish({ poster: null, duration: null, height: null })

    video.onloadedmetadata = () => {
      metadata = {
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        height: video.videoHeight,
      }
      video.currentTime = Math.min(1, (metadata.duration || 4) / 4)
    }

    video.onseeked = () => {
      const width = video.videoWidth
      const height = video.videoHeight
      if (!width || !height) {
        finish({ poster: null, duration: metadata?.duration ?? null, height: null })
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.min(640, width)
      canvas.height = Math.round((canvas.width / width) * height)
      const ctx = canvas.getContext('2d')
      let poster: string | null = null
      try {
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
        poster = ctx ? canvas.toDataURL('image/jpeg', 0.8) : null
      } catch {
        poster = null
      }
      finish({ poster, duration: metadata?.duration ?? null, height })
    }
  })
}
