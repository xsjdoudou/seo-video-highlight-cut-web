export const homeFaq = [
  {
    question: 'What can I use as a source?',
    answer: 'You can paste a YouTube link or upload a video file from your device. Podcasts are one use case, but interviews, discussions, and educational recordings can also contain useful standalone moments. Make sure you have permission to use the source and publish any resulting clips.',
  },
  {
    question: 'How do credits work?',
    answer: 'Processing is charged at two credits per minute of source video. The estimated usage appears before you start, based on the detected duration. Credit packs are one-time purchases, not automatically renewing subscriptions. Visit the pricing page for current packages and details.',
  },
  {
    question: 'Can I add subtitles?',
    answer: 'The processing options include adding subtitles, as well as an option to remove subtitles already burned into the source. Review the result before publishing: names, terminology, timing, and readability are worth checking against the original recording.',
  },
  {
    question: 'Will every suggested clip be ready to publish?',
    answer: 'Not necessarily. AI suggestions and scores help you find candidates, but they cannot decide what is appropriate for your audience or guarantee a result. Watch each clip, check its context and accuracy, and make any changes you need before sharing it.',
  },
]

export const homeStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'FAQPage',
      mainEntity: homeFaq.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Video Highlight',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: 'https://video-highlight.com/',
      offers: [
        { '@type': 'Offer', name: 'Starter: 100 credits', price: '7.99', priceCurrency: 'USD', url: 'https://video-highlight.com/pricing' },
        { '@type': 'Offer', name: 'Creator: 500 credits', price: '27.99', priceCurrency: 'USD', url: 'https://video-highlight.com/pricing' },
        { '@type': 'Offer', name: 'Studio: 1200 credits', price: '57.99', priceCurrency: 'USD', url: 'https://video-highlight.com/pricing' },
      ],
    },
  ],
}
