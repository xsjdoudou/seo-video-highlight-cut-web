export default function HomeContent() {
  return (
    <div className="home-content">
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
      </section>

      <section aria-labelledby="home-platforms">
        <h2 id="home-platforms">Podcast clips for YouTube Shorts, TikTok and Reels</h2>
        <p>
          Short clips give potential listeners a way to discover a podcast before committing to a full
          episode. A concise answer or a compelling exchange can introduce the guest, establish the topic,
          and give someone a reason to learn more. You can also use highlights to revisit an older episode
          when a subject becomes relevant again.
        </p>
        <p>
          When choosing a clip for YouTube Shorts, TikTok, or Instagram Reels, consider what a viewer needs
          to understand without hearing the rest of the conversation. Listen for references to earlier
          questions, names, or examples that may need context. Check subtitles for names and technical
          terms, and make sure the opening communicates why the moment matters. Different communities
          respond to different ideas, so the same episode may yield several useful clips.
        </p>
        <p>
          After downloading, review the video against the current requirements of the platform where you
          intend to post. You remain responsible for any final edits, captions, descriptions, and publishing.
          One-click publishing to social platforms is planned for a future release; it is not part of the
          current workflow. Always use video that you have the right to process and share.
        </p>
      </section>

      <section aria-labelledby="home-faq">
        <h2 id="home-faq">FAQ</h2>
        <h3>What can I use as a source?</h3>
        <p>
          You can paste a YouTube link or upload a video file from your device. Podcasts are one use case,
          but interviews, discussions, and educational recordings can also contain useful standalone
          moments. Make sure you have permission to use the source and publish any resulting clips.
        </p>
        <h3>How do credits work?</h3>
        <p>
          Processing is charged at two credits per minute of source video. The estimated usage appears
          before you start, based on the detected duration. Credit packs are one-time purchases, not
          automatically renewing subscriptions. Visit the <a href="/pricing">pricing page</a> for current
          packages and details.
        </p>
        <h3>Can I add subtitles?</h3>
        <p>
          The processing options include adding subtitles, as well as an option to remove subtitles already
          burned into the source. Review the result before publishing: names, terminology, timing, and
          readability are worth checking against the original recording.
        </p>
        <h3>Will every suggested clip be ready to publish?</h3>
        <p>
          Not necessarily. AI suggestions and scores help you find candidates, but they cannot decide what
          is appropriate for your audience or guarantee a result. Watch each clip, check its context and
          accuracy, and make any changes you need before sharing it.
        </p>
      </section>
    </div>
  )
}
