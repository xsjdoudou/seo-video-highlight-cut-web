import { homeFaq, homeStructuredData } from '../homeSchema'

export default function HomeContent() {
  return (
    <div className="home-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeStructuredData).replace(/</g, '\\u003c') }} />
      <section aria-labelledby="home-highlights">
        <h2 id="home-highlights">How the AI finds highlights</h2>
        <p>
          A long conversation can contain a dozen ideas worth sharing, but finding them often means watching
          the same recording over and over. Video Highlight helps narrow that search. It analyzes your source
          video and identifies moments that may work as short clips, giving you a starting point for review
          instead of asking you to find every highlight manually.
        </p>
        <p>
          The selection process looks for qualities that matter when a viewer has not seen the full episode:
          a strong opening, a clear idea, an engaging delivery, and enough context to make the moment
          understandable on its own. A surprising observation, a useful explanation, or a memorable quote
          might make a good candidate. The goal is to surface a range of moments you can evaluate for your
          own audience.
        </p>
        <p>
          Each suggested clip comes with a score and an evaluation. These are useful signals, not a promise
          of views or a substitute for your judgment. Watch the clip, check that it represents the speaker
          fairly, and decide whether the idea fits the story you want to tell. You know your audience and
          your source material best.
        </p>
        <p>
          When comparing suggestions, look beyond the highest score. A practical answer may serve an
          audience looking for advice, while a surprising question may be a better introduction to an
          interview. Consider whether the excerpt has a clear beginning and ending, whether a new viewer
          can follow it, and whether the speaker's meaning remains intact outside the longer conversation.
        </p>
        <p>
          Think of AI clips as a shortlist, not a finished editorial calendar. A candidate that introduces
          an unfamiliar topic can invite a new viewer into an episode; a detailed answer can reward people
          who already follow the subject. Video clipping works best when you consider the speaker's intent
          alongside the apparent strength of a hook. Listen to the surrounding passage when a statement
          could be misleading on its own, and keep the full recording available for that check.
        </p>
        <p>
          Scores help you compare candidates, but two clips with similar scores can serve very different
          purposes. One may have a strong emotional moment, while another offers a concise explanation.
          Choose the one that fits the post you are making rather than treating the numbers as a ranking of
          objective quality. The evaluation gives you a starting point for that decision.
        </p>
        <p>
          For a recorded panel, the best standalone passage may be a complete exchange rather than a
          single speaker's sentence. For an instructional video, a brief explanation may need the preceding
          question to make its purpose clear. Watch for changes in speaker, references such as “that idea,”
          and examples that depend on a diagram or earlier demonstration. These details can determine
          whether a viewer understands the moment without the full video.
        </p>
        <p>
          Keep track of why you selected a candidate. A useful working note might describe the question
          answered, the intended audience, and any detail that needs verification. Before sharing, compare
          that note with the actual clip and the surrounding source. This small review step helps you avoid
          presenting a nuanced conversation as a claim its speaker did not make.
        </p>
      </section>

      <section aria-labelledby="home-workflow">
        <h2 id="home-workflow">Long video to shorts</h2>
        <p>
          Start by pasting a YouTube video link or uploading a video file. Once the source is ready, you can
          review its details and the estimated credit usage before starting the job. You can also choose
          whether to add subtitles or attempt to remove subtitles already burned into the source. Processing
          takes the long video as its input and returns a selection of highlights for you to explore.
        </p>
        <p>
          Open the results to watch the suggested clips and read their evaluations. Compare the opening
          seconds, the context around each statement, and the point where the clip ends. A great moment in a
          full episode may need a different introduction when it stands alone, so reviewing the result is an
          important part of the workflow. Download the clips you want to use, then add any finishing touches
          in the tools you normally use.
        </p>
        <p>
          This approach is useful for interviews, educational videos, conversations, and other recordings
          where one long session covers multiple topics. A single source can provide several different
          angles: one clip might introduce a question, another might explain an answer, and another might
          capture a particularly distinctive point of view. The final selection stays in your hands.
        </p>
        <p>
          A clip generator can reduce the time spent searching, especially when you have a backlog of long
          recordings. Start with a source you know well, compare the suggestions to moments you would have
          picked yourself, and use that comparison to decide which results are useful. Automatic clipping
          produces candidates for review; it does not know your publishing calendar, your brand voice, or
          every detail that matters to your guests.
        </p>
        <p>
          Before processing, check that the recording is accessible and that you have the right to use it.
          Afterward, review any subtitles and make sure the excerpt does not cut off a qualification or
          important answer. If a result needs a different framing or an additional introduction, make that
          change in your usual editing workflow before sharing it.
        </p>
      </section>

      <section aria-labelledby="home-platforms">
        <h2 id="home-platforms">Podcast clips for YouTube Shorts, TikTok and Reels</h2>
        <p>
          Podcast clips can introduce an episode through a concise answer or memorable exchange. Before
          sharing shorts on YouTube, TikTok, or Reels, review the context, subtitles, and current platform
          requirements. Download and publish the clips yourself; automatic publishing is not currently
          available. See the <a href="/ai-shorts-generator">AI shorts generator</a> guide for more on
          reviewing the finished output.
        </p>
      </section>

      <section aria-labelledby="home-faq">
        <h2 id="home-faq">FAQ</h2>
        {homeFaq.map(({ question, answer }) => (
          <div key={question}>
            <h3>{question}</h3>
            <p>{answer}</p>
          </div>
        ))}
        <p><a href="/pricing">View credit packages</a></p>
      </section>
      <nav aria-label="Explore video tools">
        <a href="/ai-shorts-generator">AI shorts generator</a>
      </nav>
    </div>
  )
}
