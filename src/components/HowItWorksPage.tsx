import { sources } from '../data/clips'

const steps = [
  {
    number: '01',
    title: 'Drop in a video',
    copy: 'Paste a YouTube link or upload a long-form video. We read the source and prepare it for analysis.',
  },
  {
    number: '02',
    title: 'AI finds the moments',
    copy: 'Our pipeline looks for strong hooks, clear ideas, emotion, and moments that work without the full context.',
  },
  {
    number: '03',
    title: 'Review and publish',
    copy: 'Watch the selected clips, open the evaluation, and download the shorts that are ready for your next post.',
  },
]

export default function HowItWorksPage({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const preview = sources[0]

  return (
    <section className="how-page" aria-labelledby="how-heading">
      <div className="how-page__nav">
        <button type="button" className="results-page__back" onClick={onBack}>
          <span aria-hidden="true">←</span> Back
        </button>
      </div>

      <header className="how-page__hero">
        <div className="how-page__hero-copy">
          <p className="results-page__eyebrow">How it works</p>
          <h1 id="how-heading">One long video.<br /><span>Several strong stories.</span></h1>
          <p>
            Video Highlight turns conversations, interviews, and podcasts into short-form clips with a clear reason behind every pick.
          </p>
          <button type="button" className="btn btn--light btn--lg" onClick={onStart}>
            Create your first highlight <span aria-hidden="true">↗</span>
          </button>
        </div>

        <div className="how-page__preview" aria-label="Example highlight preview">
          <video src={preview.preview} poster={preview.poster} autoPlay muted loop playsInline preload="metadata" />
          <div className="how-page__preview-label">
            <span className="how-page__preview-dot" />
            <span>Highlight detected</span>
            <strong>{preview.title}</strong>
          </div>
        </div>
      </header>

      <section className="how-page__steps" aria-labelledby="steps-heading">
        <div className="how-page__section-heading">
          <p className="results-page__eyebrow">The workflow</p>
          <h2 id="steps-heading">From source to short in three steps.</h2>
        </div>
        <div className="how-page__step-grid">
          {steps.map((step) => (
            <article key={step.number} className="how-page__step">
              <span className="how-page__step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="how-page__promise" aria-label="What you get">
        <div>
          <p className="results-page__eyebrow">Made for momentum</p>
          <h2>Spend less time scrubbing. Spend more time publishing.</h2>
        </div>
        <p>Each clip comes with a score and evaluation so you can make a faster decision about what deserves your audience's attention.</p>
      </section>
    </section>
  )
}
