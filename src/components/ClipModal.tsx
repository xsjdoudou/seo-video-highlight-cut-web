import { useEffect } from 'react'
import { formatDuration, type Clip, type ScoreBreakdown } from '../data/clips'
import { CloseIcon, PLATFORM_LABEL, PlatformIcon } from './icons'

const DIMENSIONS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'hook', label: 'Hook' },
  { key: 'value', label: 'Value' },
  { key: 'emotion', label: 'Emotion' },
  { key: 'standalone', label: 'Standalone' },
  { key: 'quotability', label: 'Quotability' },
  { key: 'clarity', label: 'Clarity' },
]

export default function ClipModal({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={clip.title} onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <video className="modal__video" src={clip.video} poster={clip.poster} controls autoPlay playsInline />
        <div className="modal__info">
          <div className="modal__platform">
            <PlatformIcon platform={clip.platform} size={18} />
            {PLATFORM_LABEL[clip.platform]}
          </div>
          <h3 className="modal__title">{clip.title}</h3>
          <p className="modal__meta">
            <span className="tag">{clip.type}</span>
            {formatDuration(clip.duration)} · from {formatDuration(clip.sourceStart)}–{formatDuration(clip.sourceEnd)} of
            the original
          </p>
          <div className="modal__score">
            <span className="modal__score-value">{clip.score}</span>
            <span className="modal__score-label">Virality score</span>
          </div>
          {clip.evaluation?.conclusion && (
            <div className="modal__conclusion">
              <span className="modal__section-label">AI conclusion</span>
              <p>{clip.evaluation.conclusion}</p>
            </div>
          )}
          {clip.evaluation?.summary && (
            <div className="modal__summary">
              <span className="modal__section-label">Clip summary</span>
              <p>{clip.evaluation.summary}</p>
            </div>
          )}
          <ul className="score-bars">
            {DIMENSIONS.map(({ key, label }) => (
              <li key={key}>
                <span className="score-bars__label">{label}</span>
                <span className="score-bars__track">
                  <span className="score-bars__fill" style={{ width: `${clip.scores[key]}%` }} />
                </span>
                <span className="score-bars__value">{clip.scores[key]}</span>
                {clip.evaluation?.reasons[key] && <p className="score-bars__reason">{clip.evaluation.reasons[key]}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
