import { useRef, useState } from 'react'
import { formatDuration, type Clip, type ScoreBreakdown } from '../data/clips'
import type { JobInput } from '../lib/videoSource'
import { PlayIcon } from './icons'

const DIMENSIONS: { key: keyof ScoreBreakdown; label: string; short: string }[] = [
  { key: 'hook', label: 'Hook', short: 'Stops the scroll' },
  { key: 'value', label: 'Value', short: 'Delivers insight' },
  { key: 'emotion', label: 'Emotion', short: 'Creates feeling' },
  { key: 'standalone', label: 'Standalone', short: 'Works out of context' },
  { key: 'quotability', label: 'Quotability', short: 'Worth sharing' },
  { key: 'clarity', label: 'Clarity', short: 'Easy to follow' },
]

/** 成片固定 9:16；元数据到位前先按这个占位，实际比例仍以解码出来的宽高为准。 */
const FALLBACK_ASPECT = 9 / 16

/**
 * 结果页和账户页共用同一张卡片，省得两处各长一个样。
 *
 * eager=false 时不自动播：账户页一屏可能有几十条，全部自动播会把带宽和解码
 * 都吃光，改成指上去才播。
 */
export function ResultCard({ clip, onOpen, eager = true }: { clip: Clip; onOpen: () => void; eager?: boolean }) {
  const conclusion = clip.evaluation?.conclusion || 'A strong short-form candidate based on the full evaluation.'
  const [aspect, setAspect] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const hover = (playing: boolean) => {
    if (eager) return
    const video = videoRef.current
    if (!video) return
    if (playing) void video.play().catch(() => {})
    else video.pause()
  }

  return (
    <article className="results-card">
      <button
        type="button"
        className="results-card__media"
        onClick={onOpen}
        onMouseEnter={() => hover(true)}
        onMouseLeave={() => hover(false)}
        onFocus={() => hover(true)}
        onBlur={() => hover(false)}
        aria-label={`Open evaluation for ${clip.title}`}
        style={{ aspectRatio: aspect ?? FALLBACK_ASPECT }}
      >
        <video
          ref={videoRef}
          src={clip.preview}
          poster={clip.poster}
          autoPlay={eager}
          muted
          loop
          playsInline
          preload={eager ? 'auto' : 'metadata'}
          onLoadedMetadata={(e) => {
            const { videoWidth, videoHeight } = e.currentTarget
            if (videoWidth && videoHeight) setAspect(videoWidth / videoHeight)
          }}
        />
        <span className="results-card__media-shade" />
        <span className="results-card__play">
          <PlayIcon />
        </span>
        <span className="results-card__rank">#{clip.id.replace(/^h0?/, '')}</span>
        <span className="results-card__duration">{formatDuration(clip.duration)}</span>
      </button>

      <div className="results-card__body">
        <div className="results-card__topline">
          <span className="results-card__score">
            <strong>{clip.score}</strong>
            <span>/100</span>
          </span>
        </div>
        <button type="button" className="results-card__title" onClick={onOpen}>
          {clip.title}
        </button>
        <p className="results-card__conclusion">{conclusion}</p>
        {/* 六项评分只在弹窗里给，卡片上留一个入口就够了。 */}
        <button type="button" className="results-card__details" onClick={onOpen}>
          View full evaluation <span aria-hidden="true">↗</span>
        </button>
      </div>
    </article>
  )
}

function sourceLabel(job: JobInput) {
  return job.kind === 'link' ? job.url : job.file.name
}

export default function ResultsPage({
  job,
  clips,
  warnings,
  onBack,
  onRunAgain,
  onOpenClip,
}: {
  job: JobInput
  clips: Clip[]
  warnings: string[]
  onBack: () => void
  onRunAgain: () => void
  onOpenClip: (clip: Clip) => void
}) {
  const average = clips.length ? Math.round(clips.reduce((sum, clip) => sum + clip.score, 0) / clips.length) : 0
  const highest = clips.length ? Math.max(...clips.map((clip) => clip.score)) : 0

  return (
    <section className="results-page" aria-labelledby="results-heading">
      <div className="results-page__nav">
        <button type="button" className="results-page__back" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to setup
        </button>
        <span className="results-page__complete">
          <span className="results-page__complete-dot" /> Analysis complete
        </span>
      </div>

      <header className="results-page__header">
        <p className="results-page__eyebrow">Your highlight report</p>
        <h1 id="results-heading">Your shorts are ready.</h1>
        <p className="results-page__intro">
          Every clip was scored across six signals for short-form performance. Open any result to see the reasoning behind the score.
        </p>
        <div className="results-page__source" title={sourceLabel(job)}>
          <span className="results-page__source-icon">↗</span>
          <span>{sourceLabel(job)}</span>
        </div>
      </header>

      <section className="results-overview" aria-label="Results overview">
        <div className="results-overview__stat">
          <strong>{clips.length}</strong>
          <span>Shorts found</span>
        </div>
        <div className="results-overview__stat">
          <strong>{average || '—'}</strong>
          <span>Average score</span>
        </div>
        <div className="results-overview__stat">
          <strong>{highest || '—'}</strong>
          <span>Top score</span>
        </div>
        <div className="results-overview__dimensions">
          <span>Scored for</span>
          <div>
            {DIMENSIONS.map(({ label }) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </section>

      {warnings.map((warning) => (
        <p key={warning} className="results-page__warning">
          {warning}
        </p>
      ))}

      {clips.length ? (
        <div className="results-page__grid">
          {clips.map((clip) => (
            <ResultCard key={clip.id} clip={clip} onOpen={() => onOpenClip(clip)} />
          ))}
        </div>
      ) : (
        <div className="results-page__empty">
          <span className="results-page__empty-mark">—</span>
          <h2>No clip cleared the score threshold</h2>
          <p>The pipeline finished, but there were no highlights strong enough to recommend.</p>
          <button type="button" className="btn btn--light" onClick={onRunAgain}>
            Run another analysis
          </button>
        </div>
      )}

      {clips.length > 0 && (
        <div className="results-page__footer-actions">
          <button type="button" className="btn btn--outline" onClick={onRunAgain}>
            Run again
          </button>
          <span>Scores are recommendations, not guarantees.</span>
        </div>
      )}
    </section>
  )
}
