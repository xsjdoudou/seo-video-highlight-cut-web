import { useEffect, useRef, useState } from 'react'
import { formatDuration, type Clip } from '../data/clips'
import { PLATFORM_LABEL, PlatformIcon, PlayIcon } from './icons'

function useCountUp(target: number, active: boolean, delay = 0, duration = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) {
      setValue(0)
      return
    }
    let raf = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active, delay, duration])
  return value
}

type Props = { clip: Clip; active: boolean; onOpen: () => void }

export default function ClipCard({ clip, active, onOpen }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const score = useCountUp(clip.score, active, 350)

  // Only spend bandwidth on previews once the clips are revealed.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (active) v.play().catch(() => {})
    else v.pause()
  }, [active])

  return (
    <article className="clip-card">
      <span className="clip-card__platform" title={PLATFORM_LABEL[clip.platform]}>
        <PlatformIcon platform={clip.platform} />
      </span>
      <button type="button" className="clip-card__media" onClick={onOpen} aria-label={`Play clip: ${clip.title}`}>
        <video
          ref={videoRef}
          src={clip.preview}
          poster={clip.poster}
          muted
          loop
          playsInline
          preload="none"
        />
        <span className="clip-card__overlay">
          <span className="clip-card__play">
            <PlayIcon />
          </span>
          <span className="clip-card__title">{clip.title}</span>
          <span className="clip-card__meta">
            {clip.type} · {formatDuration(clip.duration)}
          </span>
        </span>
        <span className="score-badge">
          <span className="score-badge__label">SCORE</span>
          <span className="score-badge__value">{score}</span>
        </span>
      </button>
    </article>
  )
}
