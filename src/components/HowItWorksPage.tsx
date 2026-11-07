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

const faq = [
  {
    question: 'Can I use a YouTube video?',
    answer: 'Yes. Paste a YouTube link on the home page, then review the source details before processing. Only use recordings you are authorized to process and share.',
  },
  {
    question: 'Can I upload a recording instead?',
    answer: 'Yes. Choose Upload files and select a video from your device. The application reads the source details and shows an estimated credit cost when the duration is available.',
  },
  {
    question: 'How much does processing cost?',
    answer: 'Processing is charged at two credits per minute of source video. Credit packs are one-time purchases; see the pricing page for the available packages.',
  },
  {
    question: 'Do the clips publish automatically?',
    answer: 'No. Review and download the suggested clips, then publish them yourself. Check the clip, its subtitles, and any platform-specific requirements before sharing.',
  },
]

export default function HowItWorksPage({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const preview = sources[0]
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }

  return (
    <section className="how-page" aria-labelledby="how-heading">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <div className="how-page__nav">
        <button type="button" className="results-page__back" onClick={onBack}>
          <span aria-hidden="true">←</span> Back
        </button>
      </div>

      <header className="how-page__hero">
        <div className="how-page__hero-copy">
          <p className="results-page__eyebrow">How it works</p>
          <h1 id="how-heading">Long Video to Shorts <span>in 3 Steps</span></h1>
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
      <div className="home-content how-page__guide">
        <section>
          <h2>Step 1: Add your long video</h2>
          <p>Start on the <a href="/">home page</a>. Paste a YouTube link into the video field, or choose Upload files and select a recording from your device. You can use a podcast episode, interview, discussion, or educational video as long as you have permission to process and share it. The source needs to be accessible to the service before analysis can begin.</p>
          <p>After selecting a source, review the available video details and estimated credit usage on the confirmation screen. Processing is charged at two credits per minute of source video; the estimate depends on the detected duration. Sign in when prompted, check your available credits, and confirm that the source is the recording you intended to submit.</p>
          <p>Choose the subtitle options you need. You can request subtitles on the output and can also choose to attempt removal of captions already burned into the original. These options are separate, so review them before starting. Once the settings look right, start processing and allow the job time to complete.</p>
        </section>
        <section>
          <h2>Step 2: Let AI identify highlight candidates</h2>
          <p>Video Highlight analyzes the recording and suggests moments that could stand alone as short videos. It looks for useful features such as a strong opening, a clear idea, and a passage that has enough context to make sense outside the complete episode. The results provide a shortlist rather than a guarantee that every candidate will suit your audience.</p>
          <p>Wait for the results page to appear. Each candidate includes a score and evaluation to help you compare options. A high score can point you toward a promising passage, but it cannot tell you whether a statement reflects your guest's intent or whether it fits a specific post. Use the evaluation as an aid while deciding what to watch first.</p>
          <p>Different recordings produce different results. An interview may have several answers worth sharing; a tutorial may yield individual explanations. The number and usefulness of candidates depend on the source, so plan to review the output rather than assuming every long video produces the same set of clips.</p>
        </section>
        <section>
          <h2>Step 3: Review, download and share</h2>
          <p>Open the candidates and watch them from beginning to end. Check the first few seconds, the final sentence, and any references to earlier parts of the conversation. Make sure the clip communicates a complete idea and does not remove a qualification that changes the speaker's meaning. Compare several options if they cover the same subject.</p>
          <p>Check subtitles for spelling, names, timing, and readability. Download the clips you choose, then use your usual editing and publishing tools for any additional adjustments. Before uploading, check the destination's current format and length requirements. Publishing to social platforms remains a separate step; automatic one-click publishing is planned for a future release.</p>
        </section>
        <section>
          <h2>What kinds of long videos work well?</h2>
          <p>Look for recordings with distinct ideas, explanations, or exchanges that can be understood in a shorter excerpt. An interview can offer answers to several different questions. A podcast conversation may include a useful story, a specific recommendation, or a disagreement that introduces a wider topic. Educational recordings can contain individual examples or explanations worth reviewing separately.</p>
          <p>Before choosing a source, think about what a new viewer would need to understand the moment. A passage that depends heavily on an earlier diagram, a long demonstration, or a private joke may be harder to present on its own. A clear question followed by a complete answer can be easier to evaluate as a standalone clip, although you should still check what comes before and after it.</p>
          <p>Recordings with multiple speakers deserve an extra review. Make sure the selected passage identifies who is speaking and does not remove an important response. If a clip refers to a guest, product, location, or event introduced earlier, consider whether you need to add context in your final edit or description. Check that the audio, picture, and any requested subtitles are understandable throughout the selection.</p>
          <p>You can start with a YouTube link or upload a file, but the recording must be available to the service and you must have the rights to process and share it. If you are testing a workflow for the first time, use a source you know well. Comparing the suggested moments with your own notes makes it easier to judge which results are useful for your audience.</p>
        </section>
        <section>
          <h2>How many clips can one video produce?</h2>
          <p>There is no fixed number promised for every recording. The output depends on the source and the passages the analysis identifies as candidates; a longer video does not necessarily provide more usable shorts. Some recordings contain several independent points, while others develop a single argument that is difficult to shorten without losing context. Treat the returned clips as a selection to review, not a guaranteed publishing quota.</p>
          <p>When results arrive, compare the candidates with the purpose of your post. Two suggestions might address the same question from different angles, while another might introduce a separate topic. You can download the ones that meet your needs and leave the rest unused. Check each result from start to finish, even when several clips come from the same source.</p>
          <p>For a series of posts, consider whether each selected moment adds something distinct. A short explanation, an example, and a guest's response can complement one another if each is understandable by itself. If the opening relies on an earlier question or the ending omits a necessary qualification, use your normal editing tools to make the context clear before publishing.</p>
          <p>Processing costs are based on the duration of the source, not a promised number of finished clips. Review the estimated credits before starting, and see the <a href="/pricing">pricing page</a> for available packs. Scores and evaluations help you decide where to begin, but your own review determines which clips are appropriate to share.</p>
        </section>
        <section>
          <h2>Frequently asked questions</h2>
          {faq.map(({ question, answer }) => (
            <div key={question}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </div>
          ))}
          <p><a href="/pricing">View credit packages</a></p>
        </section>
      </div>
    </section>
  )
}
