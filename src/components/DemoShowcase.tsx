import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDuration, pickSourceIndex, sources, type Clip } from '../data/clips'
import ClipCard from './ClipCard'
import { HandCursor, LinkIcon } from './icons'

type Phase = 'idle' | 'typing' | 'clicking' | 'processing' | 'done'

const PROMPT = 'Drop a long video and get viral clips'
const TYPE_MS = 38
const ROTATE_MS = 3000

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function DemoShowcase({
  onOpenClip,
  paused = false,
}: {
  onOpenClip: (clip: Clip) => void
  /** Held by the parent while a clip modal is open, so rotation waits. */
  paused?: boolean
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [typed, setTyped] = useState('')
  const [runId, setRunId] = useState(0)
  // Random on first render, so every page load opens on a different podcast.
  const [sourceIndex, setSourceIndex] = useState(() => pickSourceIndex())
  const [autoRotate, setAutoRotate] = useState(() => !prefersReducedMotion())
  const [hovered, setHovered] = useState(false)
  const [hidden, setHidden] = useState(false)
  const panelRef = useRef<HTMLElement>(null)

  const source = sources[sourceIndex]

  // Kick off the demo the first time the panel scrolls into view.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    if (prefersReducedMotion()) {
      setTyped(PROMPT)
      setPhase('done')
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('typing')
          io.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Drive the scripted sequence: typing -> cursor click -> processing -> clips.
  useEffect(() => {
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))

    if (phase === 'typing') {
      setTyped('')
      PROMPT.split('').forEach((_, i) => after(250 + i * TYPE_MS, () => setTyped(PROMPT.slice(0, i + 1))))
      after(250 + PROMPT.length * TYPE_MS + 250, () => setPhase('clicking'))
    } else if (phase === 'clicking') {
      after(1100, () => setPhase('processing'))
    } else if (phase === 'processing') {
      after(1300, () => setPhase('done'))
    }
    return () => timers.forEach(clearTimeout)
  }, [phase, runId])

  /**
   * Once the clips are on screen, cycle to the next podcast every 3s. The intro
   * animation is not replayed — it runs ~4.5s, so it would never finish.
   * sourceIndex is a dependency so manual navigation restarts the countdown.
   */
  useEffect(() => {
    if (phase !== 'done' || !autoRotate || paused || hovered || hidden) return
    const t = window.setTimeout(() => setSourceIndex((i) => (i + 1) % sources.length), ROTATE_MS)
    return () => clearTimeout(t)
  }, [phase, autoRotate, paused, hovered, hidden, sourceIndex])

  // Rotating in a background tab wastes bandwidth decoding previews nobody sees.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  /**
   * Warm the next podcast's posters and preview loops while the current one is
   * on screen. Without this the first pass through the list stutters: each
   * rotation would start six cold video requests with only 3s to fill.
   */
  useEffect(() => {
    if (phase !== 'done') return
    const next = sources[(sourceIndex + 1) % sources.length]
    const urls = [next.poster, ...next.clips.flatMap((c) => [c.poster, c.preview])]
    const links = urls.map((href) => {
      const el = document.createElement('link')
      el.rel = 'prefetch'
      el.href = href
      el.as = href.endsWith('.jpg') ? 'image' : 'video'
      document.head.appendChild(el)
      return el
    })
    return () => links.forEach((el) => el.remove())
  }, [phase, sourceIndex])

  const replay = useCallback(() => {
    setRunId((n) => n + 1)
    setPhase('typing')
  }, [])

  const goTo = useCallback((i: number) => {
    setSourceIndex(i)
    setPhase('done')
  }, [])

  const shuffle = useCallback(() => {
    setSourceIndex((i) => pickSourceIndex(i))
    setPhase('done')
  }, [])

  const showClips = phase === 'done'

  return (
    <section
      ref={panelRef}
      className={`demo demo--${phase}`}
      aria-labelledby="demo-heading"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <h2 id="demo-heading" className="visually-hidden">
        Example: one long podcast turned into short clips
      </h2>

      {/* Keyed so the player remounts and the fade-in replays on each rotation. */}
      <div className="demo__source" key={`src-${source.key}`}>
        <video
          className="demo__source-video"
          src={source.preview}
          poster={source.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label={source.title}
        />
        <span className="duration-badge">{formatDuration(source.duration)}</span>
        <div className="demo__scan" aria-hidden="true" />
      </div>

      <p className="demo__source-title" key={`title-${source.key}`} lang={source.lang}>
        {source.title}
      </p>

      <div className="demo__prompt">
        <div className="demo__prompt-text">
          <LinkIcon />
          <span className="demo__typed">
            {typed || <span className="demo__placeholder">Paste a YouTube link…</span>}
            {(phase === 'typing' || phase === 'idle') && <span className="demo__caret" />}
          </span>
        </div>
        <button
          type="button"
          className={`demo__button ${phase === 'processing' ? 'is-loading' : ''}`}
          onClick={replay}
          aria-label="Get clips (replay demo)"
        >
          {phase === 'processing' ? (
            <>
              <span className="spinner" aria-hidden="true" /> Clipping…
            </>
          ) : (
            'Get clips'
          )}
        </button>
        <span className="demo__cursor" aria-hidden="true">
          <HandCursor />
        </span>
      </div>

      <ul className="demo__clips" key={`clips-${source.key}`}>
        {source.clips.map((clip, i) => (
          <li key={clip.id} className="demo__clip" style={{ ['--i' as string]: i }}>
            <ClipCard clip={clip} active={showClips} onOpen={() => onOpenClip(clip)} />
          </li>
        ))}
      </ul>

      <div className="demo__caption">
        <span>
          {source.clips.length} {source.clips.length === 1 ? 'clip' : 'clips'} found in a{' '}
          {formatDuration(source.duration)} video, each scored for virality.
        </span>
        <ul className="demo__dots">
          {sources.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                className="demo__dot"
                aria-current={i === sourceIndex}
                aria-label={`Show video ${i + 1} of ${sources.length}`}
                onClick={() => goTo(i)}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="demo__replay"
          onClick={() => setAutoRotate((v) => !v)}
          aria-label={autoRotate ? 'Pause automatic rotation' : 'Resume automatic rotation'}
        >
          {autoRotate ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button type="button" className="demo__replay" onClick={shuffle}>
          ↻ Try another video
        </button>
      </div>
    </section>
  )
}
