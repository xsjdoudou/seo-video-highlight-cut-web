import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDuration, type Clip } from '../data/clips'
import { getSession, refreshBalance, useBalance } from '../lib/auth'
import { createClipJob, fetchClipJob, GENERIC_FAILURE, highlightsToClips, ServerMessage, uploadVideo } from '../lib/clipApi'
import {
  estimateCredits,
  formatBytes,
  parseYouTubeId,
  readLocalVideo,
  youTubeThumb,
  type JobInput,
  type SourceInfo,
} from '../lib/videoSource'
import AuthModal from './AuthModal'
import ResultsPage from './ResultsPage'
import { BoltIcon, InfoIcon, LinkIcon } from './icons'

type Phase = 'ready' | 'working' | 'done' | 'error'

/** 轮询间隔；整条流水线动辄几分钟，没必要更密。 */
const POLL_MS = 2000

const CREDITS_HINT =
  'Credits are charged per minute of source video. We can only count them once we know how long the video is.'

/** Small on/off switch used by the clipping options panel. */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle${checked ? ' toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  )
}

export default function CreatePage({
  job,
  onRemove,
  onOpenClip,
}: {
  job: JobInput
  onRemove: () => void
  onOpenClip: (clip: Clip) => void
}) {
  const [info, setInfo] = useState<SourceInfo>({ poster: null, duration: null, height: null })
  /** maxresdefault is missing on plenty of videos, so fall back to hqdefault. */
  const [thumbSize, setThumbSize] = useState<'maxres' | 'hq'>('maxres')
  const [thumbBroken, setThumbBroken] = useState(false)
  const [stripSubtitles, setStripSubtitles] = useState(false)
  const [burnSubtitles, setBurnSubtitles] = useState(true)
  const [phase, setPhase] = useState<Phase>('ready')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [clips, setClips] = useState<Clip[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const balance = useBalance()
  /** 换源或离开页面后，还没跑完的那一轮轮询不该再写 state。 */
  const runId = useRef(0)
  /** 上传过的源视频地址，重跑时直接复用，别再传一遍几百 MB。 */
  const uploadedUrl = useRef<string | null>(null)

  const youTubeId = job.kind === 'link' ? parseYouTubeId(job.url) : null

  // A local file is the only source we can actually measure in the browser.
  useEffect(() => {
    setInfo({ poster: null, duration: null, height: null })
    setThumbSize('maxres')
    setThumbBroken(false)
    if (job.kind !== 'file') return
    let live = true
    readLocalVideo(job.file).then((result) => live && setInfo(result))
    return () => {
      live = false
    }
  }, [job])

  useEffect(() => {
    runId.current += 1
    uploadedUrl.current = null
    setPhase('ready')
    setClips([])
    setWarnings([])
    setError(null)
    setProgress(0)
    return () => {
      runId.current += 1
    }
  }, [job])

  const poster = job.kind === 'file' ? info.poster : youTubeId ? youTubeThumb(youTubeId, thumbSize) : null
  const credits = useMemo(() => (info.duration ? estimateCredits(info.duration) : null), [info.duration])

  const start = async () => {
    // 剪辑要登录：未登录就先弹登录框，登录成功后由弹窗回调接着跑这一趟。
    const session = getSession()
    if (!session) {
      setAuthOpen(true)
      return
    }
    const run = ++runId.current
    const live = () => runId.current === run
    setPhase('working')
    setError(null)
    setWarnings([])
    setClips([])
    setProgress(0)

    try {
      // 服务端要自己下载源视频，所以本地文件得先上传成一个可访问的链接。
      let videoUrl = job.kind === 'link' ? job.url.trim() : uploadedUrl.current ?? ''
      if (job.kind === 'file' && !videoUrl) {
        setStatus('Uploading your video…')
        videoUrl = await uploadVideo(job.file, (ratioDone) => {
          if (!live()) return
          setProgress(Math.round(ratioDone * 100))
          if (ratioDone >= 1) setStatus('Finishing your upload…')
        })
        uploadedUrl.current = videoUrl
        if (!live()) return
      }

      setStatus('Starting…')
      setProgress(0)
      const created = await createClipJob({
        videoUrl,
        duration: info.duration ?? 0,
        removeSubtitles: stripSubtitles,
        addSubtitles: burnSubtitles,
        email: session.email,
        sourceName: job.kind === 'link' ? job.url.trim() : job.file.name,
      })

      // 剪辑是个长任务，轮询到结束为止。
      let view = created
      while (live() && view.status === 'running') {
        setStatus(view.label)
        setProgress(view.progress)
        await new Promise((resolve) => setTimeout(resolve, POLL_MS))
        if (!live()) return
        view = await fetchClipJob(created.jobId)
      }
      if (!live()) return

      if (view.status === 'error') throw new ServerMessage(view.error ?? GENERIC_FAILURE)
      setWarnings(view.warnings ?? [])
      setClips(highlightsToClips(view.highlights))
      setProgress(100)
      setPhase('done')
      void refreshBalance()
    } catch (err) {
      if (!live()) return
      // 服务端给的那句是写给用户看的，直接显示；其它异常只会暴露内部细节。
      setError(err instanceof ServerMessage ? err.message : GENERIC_FAILURE)
      setPhase('error')
      void refreshBalance()
    }
  }

  const ctaLabel =
    phase === 'working'
      ? `${status}${progress ? ` ${progress}%` : ''}`
      : phase === 'done'
        ? 'Run again'
        : phase === 'error'
          ? 'Try again'
          : 'Get clips in 1 click'

  if (phase === 'done') {
    return (
      <ResultsPage
        job={job}
        clips={clips}
        warnings={warnings}
        onBack={onRemove}
        onRunAgain={start}
        onOpenClip={onOpenClip}
      />
    )
  }

  return (
    <section className="create" aria-labelledby="create-heading">
      <h1 id="create-heading" className="visually-hidden">
        Confirm your video
      </h1>

      <div className="create__source">
        <LinkIcon />
        {job.kind === 'link' ? (
          <span className="create__source-text">{job.url}</span>
        ) : (
          <span className="create__source-text">
            {job.file.name} <span className="create__source-size">{formatBytes(job.file.size)}</span>
          </span>
        )}
        <button type="button" className="create__remove" onClick={onRemove}>
          Remove
        </button>
      </div>

      <button type="button" className="create__cta" onClick={start} disabled={phase === 'working'}>
        {phase === 'working' && <span className="spinner" aria-hidden="true" />}
        {ctaLabel}
      </button>

      {phase === 'working' && (
        <div className="create__progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span className="create__progress-fill" style={{ width: `${Math.max(2, progress)}%` }} />
        </div>
      )}

      {error && (
        <p className="create__error" role="alert">
          {error}
        </p>
      )}

      <div className="create__options">
        <span className="create__option create__credits">
          Credit usage: <BoltIcon />
          <strong>{credits ?? '—'}</strong>
          <span className="create__info" title={CREDITS_HINT} aria-label={CREDITS_HINT} role="img">
            <InfoIcon />
          </span>
          {balance !== null && <span className="create__balance">Balance {balance}</span>}
        </span>
      </div>

      <div className="create__thumb">
        {poster && !thumbBroken ? (
          <img
            key={poster}
            src={poster}
            alt=""
            onError={() => (thumbSize === 'maxres' && youTubeId ? setThumbSize('hq') : setThumbBroken(true))}
          />
        ) : (
          <div className="create__thumb-placeholder">
            <LinkIcon />
            <span>{job.kind === 'file' ? 'Reading your file…' : 'Preview unavailable for this link'}</span>
          </div>
        )}
        {info.height ? <span className="duration-badge create__quality">{info.height}p</span> : null}
        {info.duration ? <span className="duration-badge create__length">{formatDuration(info.duration)}</span> : null}
      </div>

      <p className="create__disclaimer">
        Using video you don’t own may violate copyright laws. By continuing, you confirm this is your own original
        content.
      </p>

      <div className="create__panel">
        <div className="create__panel-row">
          <span className="create__panel-label">
            Remove burned-in subtitles
            <span className="create__panel-hint">Strips captions already baked into the source</span>
          </span>
          <Toggle
            checked={stripSubtitles}
            onChange={setStripSubtitles}
            disabled={phase === 'working'}
            label="Remove burned-in subtitles"
          />
        </div>

        <div className="create__panel-row">
          <span className="create__panel-label">
            Add subtitles
            <span className="create__panel-hint">Burns the transcript onto every clip</span>
          </span>
          <Toggle
            checked={burnSubtitles}
            onChange={setBurnSubtitles}
            disabled={phase === 'working'}
            label="Add subtitles"
          />
        </div>
      </div>

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onDone={() => {
            setAuthOpen(false)
            start()
          }}
        />
      )}
    </section>
  )
}
