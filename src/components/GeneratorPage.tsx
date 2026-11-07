import { sources } from '../data/clips'

const faq = [
  {
    question: 'What does the AI shorts generator create?',
    answer: 'It suggests clips from your source video and provides scores and evaluations to help you review them. The number and usefulness of suggestions depend on the recording.',
  },
  {
    question: 'Can I add subtitles to a generated clip?',
    answer: 'Yes. Select the option to add subtitles before processing. Review the result for names, timing, and readability before sharing it.',
  },
  {
    question: 'How are credits calculated?',
    answer: 'Processing costs two credits per minute of source video. The estimated usage is shown before you start when the source duration is available.',
  },
  {
    question: 'Does the tool publish directly to social platforms?',
    answer: 'No. Download the clips you select and publish them using your usual tools. One-click publishing is planned for a future release.',
  },
]

export default function GeneratorPage({ onStart }: { onStart: () => void }) {
  const example = sources.find((source) => source.key === 'yt_test_2')!
  const clip = example.clips[0]
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
    <div className="home-content generator-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <a href="/">← Video Highlight home</a>
      <h1>AI Shorts Generator for Podcasts and Long Videos</h1>
      <p>Turn a long conversation, podcast, or educational recording into short-video candidates. Review the opening, context, subtitles, and evaluation before choosing what to download.</p>
      <button type="button" className="btn btn--light" onClick={onStart}>Start with a video</button>

      <section>
        <h2>What you get from a source video</h2>
        <p>Instead of a single fixed summary, the AI shorts generator presents suggested moments from the recording. Each candidate has a video preview, a score, and an evaluation that can help you decide what to inspect first. Depending on the material, one result might contain a concise answer, while another captures a surprising observation or a useful explanation.</p>
        <p>The number of suggestions and their suitability vary with the source. A score is a comparison aid, not a promise of views. Watch each result and consider whether it makes sense to someone who has not seen the rest of the conversation. The strongest moment for your audience may not be the one with the highest score.</p>
      </section>

      <section>
        <h2>Review the opening, context and subtitles</h2>
        <p>When you open a candidate, listen to the first sentence: does it make the topic clear without a long introduction? Then check the ending. A clip can sound decisive while leaving out a qualification that followed in the original recording. Compare it with the source when a point needs more context, and keep the speaker's intended meaning intact.</p>
        <p>You can choose to add subtitles before processing. Review the generated text for names, technical terms, timing, and readability. The processing screen also offers an option to attempt removal of subtitles already burned into the source. Neither option replaces a final visual check of the downloaded video.</p>
        <p>Before posting, inspect the framing, aspect ratio, and duration against the destination's current requirements. Different platforms and placements may have different rules. Make any necessary final adjustments in your usual editing workflow; do not assume every suggested clip is ready to publish unchanged.</p>
      </section>

      <section>
        <h2>A real example from an English podcast</h2>
        <p>Our example source is “{example.title}.” One selected result is “{clip.title}.” Play the generated clip below to see a real candidate from the demo, including the way a specific idea is presented outside the full recording.</p>
        <video className="generator-page__video" src={clip.video} poster={clip.poster} controls playsInline preload="metadata" aria-label={clip.title} />
        <p>Consider what this excerpt communicates on its own, what context a new viewer might need, and whether its start and finish suit the post you are planning. Those same checks help turn an automatically selected moment into an editorial choice.</p>
      </section>

      <section>
        <h2>Choose and download clips for your workflow</h2>
        <p>Begin at the <a href="/">home page</a> by pasting a YouTube link or uploading a file you are authorized to use. Review the source details, estimated credit usage, and subtitle settings. Start processing, wait for the results, and compare the suggested clips. Download the candidates you want to take forward.</p>
        <p>A podcast team might choose one answer to introduce a guest and another to explain a practical idea. An educator might select separate explanations for different lessons. In either case, create a deliberate selection rather than posting every suggestion: check the recording for accuracy, decide what each clip adds, and add descriptions or other context where needed.</p>
        <p>The current workflow ends with reviewing and downloading your clips. You publish them separately. For a closer look at each processing step, read the <a href="/how-it-works">long video to shorts guide</a>.</p>
      </section>

      <section>
        <h2>Frequently asked questions</h2>
        {faq.map(({ question, answer }) => (
          <div key={question}>
            <h3>{question}</h3>
            <p>{answer}</p>
          </div>
        ))}
        <p><a href="/pricing">See credit packages</a> or <a href="/">return to the AI video clipper</a>.</p>
      </section>
    </div>
  )
}
