import type { ReactNode } from 'react'

const LAST_UPDATED = 'November 3, 2026'

type LegalPageProps = {
  kind: 'terms' | 'privacy'
  onBack: () => void
}

function LegalLayout({ title, intro, children, onBack }: { title: string; intro: string; children: ReactNode; onBack: () => void }) {
  return (
    <section className="legal-page" aria-labelledby="legal-heading">
      <div className="legal-page__nav">
        <button type="button" className="results-page__back" onClick={onBack}>
          <span aria-hidden="true">←</span> Back
        </button>
        <span className="legal-page__updated">Last updated {LAST_UPDATED}</span>
      </div>
      <header className="legal-page__header">
        <p className="results-page__eyebrow">Video Highlight</p>
        <h1 id="legal-heading">{title}</h1>
        <p>{intro}</p>
      </header>
      <article className="legal-page__content">{children}</article>
    </section>
  )
}

export default function LegalPage({ kind, onBack }: LegalPageProps) {
  if (kind === 'privacy') {
    return (
      <LegalLayout
        title="Privacy policy"
        intro="This policy explains what Video Highlight collects, why we use it, and how you can control your data."
        onBack={onBack}
      >
        <h2>1. Who we are</h2>
        <p>
          Video Highlight is a digital service that finds high-value moments in long-form videos and turns them into short clips.
          For privacy questions or data requests, contact <a href="mailto:privacy@video-highlight.com">privacy@video-highlight.com</a>.
        </p>

        <h2>2. Information we collect</h2>
        <ul>
          <li><strong>Account information:</strong> your name, email address, password hash, and account session data.</li>
          <li><strong>Content you submit:</strong> YouTube links or uploaded video files, transcripts and speaker information needed to process a clip.</li>
          <li><strong>Generated content:</strong> highlight selections, transcripts, summaries, scores, rendered clips, and processing status.</li>
          <li><strong>Technical information:</strong> IP address, browser and device information, request logs, error logs, and security events.</li>
          <li><strong>Billing information:</strong> product, amount, currency, payment status, and payment identifiers. We do not store full payment card numbers.</li>
        </ul>

        <h2>3. How we use information</h2>
        <ul>
          <li>To authenticate accounts, process videos, generate highlights, and maintain your clip library.</li>
          <li>To process purchases, add credits, prevent fraud, and resolve billing issues.</li>
          <li>To provide support, diagnose failures, protect the service, and comply with law.</li>
          <li>To improve reliability using aggregated or de-identified operational data.</li>
        </ul>
        <p>We do not use your submitted videos or transcripts to train a general-purpose AI model without your separate permission.</p>

        <h2>4. Service providers</h2>
        <p>
          We use infrastructure and processing providers to deliver the service, including cloud hosting, object storage,
          video-processing infrastructure, and Waffo Pancake for checkout and payment processing. These providers receive only
          the information needed to perform their contracted function and are subject to their own privacy policies.
        </p>

        <h2>5. Storage and retention</h2>
        <ul>
          <li>Uploaded source files are normally retained for up to 24 hours for processing and cleanup.</li>
          <li>Rendered clips are normally retained for up to 30 days so signed-in users can replay and download them.</li>
          <li>Temporary job state is normally retained for up to 2 hours after processing.</li>
          <li>Account and billing records are retained for as long as needed to provide the service and meet legal obligations.</li>
        </ul>
        <p>Retention can vary when a job fails, a legal hold applies, or cleanup is delayed. Deleted content is removed or anonymized when reasonably practicable.</p>

        <h2>6. Cookies and security</h2>
        <p>
          We use a necessary, HttpOnly session cookie to keep you signed in. We use HTTPS in production, hash passwords with
          scrypt, restrict account access to the authenticated user, and apply least-privilege access to operational systems.
          No security measure is completely guaranteed; please keep your login credentials private.
        </p>

        <h2>7. Your rights</h2>
        <p>
          You may request access to, correction of, export of, or deletion of your personal information by emailing
          <a href="mailto:privacy@video-highlight.com"> privacy@video-highlight.com</a>. We may need to verify your identity before completing a request.
          We will respond within the period required by applicable law.
        </p>

        <h2>8. Children</h2>
        <p>The service is intended for people aged 18 or older. We do not knowingly collect personal information from children.</p>

        <h2>9. International transfers</h2>
        <p>
          Our service providers may process information in countries different from yours. Where required, we use appropriate
          contractual or other safeguards for cross-border transfers.
        </p>

        <h2>10. Changes and contact</h2>
        <p>
          We may update this policy as the service changes. We will update the date above and provide additional notice for
          material changes when required. For privacy or deletion requests, email <a href="mailto:privacy@video-highlight.com">privacy@video-highlight.com</a>.
        </p>
      </LegalLayout>
    )
  }

  return (
    <LegalLayout
      title="Terms of service"
      intro="These terms govern your use of Video Highlight, an AI-powered digital video clipping service."
      onBack={onBack}
    >
      <h2>1. Acceptance</h2>
      <p>
        By creating an account, buying credits, or using Video Highlight, you confirm that you are at least 18 years old,
        have authority to accept these terms, and agree to this policy and our <a href="/privacy">Privacy Policy</a>.
        If you do not agree, do not use the service.
      </p>

      <h2>2. The service</h2>
      <p>
        Video Highlight analyzes a submitted long-form video and related transcript data to identify highlights, score and
        summarize them, reframe them for short-form video, and return rendered clips. The service is delivered online as a
        digital product. AI results are suggestions and may be incomplete or inaccurate; you must review every clip before publishing it.
      </p>

      <h2>3. Accounts and content rights</h2>
      <p>
        Keep your account information accurate and your password confidential. You are responsible for every activity under your account.
        You must own or have permission to submit each video, audio track, transcript, image, and other material you provide.
        You retain your rights in your input. You grant us a limited, non-exclusive license to host, process, transform, and deliver
        that input only as needed to operate the service. Subject to these terms, you may use the generated clips for lawful personal or commercial purposes.
      </p>

      <h2>4. Credits and pricing</h2>
      <p>Video Highlight currently sells one-time credit packs. The checkout page shows the applicable price and credit amount before payment:</p>
      <ul>
        <li>Starter: 100 credits for $9 USD.</li>
        <li>Creator: 500 credits for $29 USD.</li>
        <li>Studio: 1,200 credits for $59 USD.</li>
      </ul>
      <p>Credits are not a subscription, do not renew automatically, and are applied only after payment is confirmed by Waffo Pancake. We may change future pricing, but an already completed purchase is not repriced.</p>

      <h2>5. Refunds</h2>
      <p>
        Because credits provide immediate access to a digital service, used credits are generally non-refundable. We will refund
        duplicate or erroneous charges. Unused credits may be eligible for a refund if requested within 7 days of purchase,
        subject to applicable law. Contact <a href="mailto:refunds@video-highlight.com">refunds@video-highlight.com</a> with your account email and transaction ID.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You may not use the service to upload, process, generate, or distribute content that:</p>
      <ul>
        <li>Is illegal, pornographic, sexually explicit, or otherwise NSFW, including sexual content involving minors.</li>
        <li>Depicts or encourages graphic violence, gore, torture, terrorism, or instructions for serious physical harm.</li>
        <li>Promotes hatred, dehumanization, or discrimination against people based on protected characteristics.</li>
        <li>Contains child sexual abuse material or any other child-safety violation.</li>
        <li>Creates misleading deepfakes, impersonates another person, or uses a person’s likeness without authorization.</li>
        <li>Infringes copyright, trademark, publicity, privacy, or other third-party rights.</li>
        <li>Uploads malware, attacks the service, bypasses limits, scrapes it at scale, or resells access without written permission.</li>
        <li>Presents AI output as professional medical, legal, financial, or other regulated advice.</li>
      </ul>
      <p>Only submit content you are authorized to use. You are responsible for reviewing every generated clip before publishing it.</p>

      <h2>7. Reporting and content moderation</h2>
      <p>
        To report a generated clip or other content that may violate these terms, email
        <a href="mailto:support@video-highlight.com"> support@video-highlight.com</a> with the relevant account email,
        clip or job URL, a description of the issue, and any supporting evidence. Do not include sensitive personal information unless it is necessary for the report.
      </p>
      <p>
        We review reports and may review flagged content, account activity, and relevant technical records to assess the report.
        Depending on the result, we may request more information, restrict or remove content, limit processing, suspend or terminate
        an account, preserve evidence, or refer an urgent matter to the appropriate authority. We aim to acknowledge reports within
        2 business days and take action as soon as reasonably practicable. We may not disclose confidential details of an investigation.
      </p>

      <h2>8. AI models and generated content</h2>
      <p>
        The current processing pipeline uses the following named models and services: OpenAI <strong>GPT-5.5</strong> for semantic
        video understanding and highlight evaluation; Tencent Cloud MPS <strong>SmartSubtitles</strong> for speech recognition;
        <strong>CLIP ViT-L/14@336px</strong> for visual shot analysis; <strong>SAM3</strong> for subject segmentation and
        reframing; local <strong>YOLOv8s-face</strong> for face detection; and <strong>ERes2NetV2</strong> for speaker representation.
        The pipeline configuration may change as the beta product evolves, and this page will be updated when the production model set changes.
      </p>
      <p>
        These models assist with analysis and editing; they do not guarantee factual accuracy, copyright clearance, or suitability for publication.
        You retain responsibility for the input rights and final use of every output.
      </p>

      <h2>9. Third-party services</h2>
      <p>
        Checkout is provided by Waffo Pancake. Cloud hosting, object storage, video processing, and other infrastructure may be
        provided by third parties. Their availability can affect processing time and results. You agree to their terms where applicable.
      </p>

      <h2>10. Availability and liability</h2>
      <p>
        The service is provided on an “as available” basis. We do not guarantee uninterrupted availability, a particular processing
        time, or that AI output will be accurate or suitable for your purpose. To the maximum extent permitted by law, Video Highlight
        is not liable for indirect or consequential losses. Our aggregate liability is limited to the amount you paid us in the 12 months before the event giving rise to the claim.
      </p>

      <h2>11. Termination and changes</h2>
      <p>
        You may stop using the service at any time. We may suspend or terminate access for fraud, abuse, a material breach, or legal requirements.
        We may update these terms as the service changes. Material changes will be posted here with a new effective date and, where required,
        additional notice.
      </p>

      <h2>12. Contact</h2>
      <p>
        Billing: <a href="mailto:billing@video-highlight.com">billing@video-highlight.com</a><br />
        Support: <a href="mailto:support@video-highlight.com">support@video-highlight.com</a><br />
        Privacy: <a href="mailto:privacy@video-highlight.com">privacy@video-highlight.com</a><br />
        Content reports: <a href="mailto:support@video-highlight.com">support@video-highlight.com</a>
      </p>
    </LegalLayout>
  )
}
