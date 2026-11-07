const pages: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'AI Video Clipper – Turn Long Videos into Podcast Shorts',
    description: 'Turn long videos and podcasts into short clips with AI. Find highlights, review scores, and download videos for social media.',
  },
  '/pricing': {
    title: 'Pricing – Video Highlight',
    description: 'Compare one-time credit packs for Video Highlight. Processing costs 2 credits per minute of source video.',
  },
  '/how-it-works': {
    title: 'How It Works – Long Video to Shorts in 3 Steps',
    description: 'Upload a video or paste a YouTube link, let AI find highlights, and review and download your shorts.',
  },
}

export function pageSeo(path: string) {
  const canonicalPath = Object.hasOwn(pages, path) ? path : '/'
  return { ...pages[canonicalPath], canonical: `https://video-highlight.com${canonicalPath}` }
}
