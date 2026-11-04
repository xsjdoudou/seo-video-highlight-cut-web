import type { Platform } from '../data/clips'

export function LinkIcon() {
  return (
    <svg className="link-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 14a4.5 4.5 0 0 0 6.36 0l3-3a4.5 4.5 0 0 0-6.36-6.36l-1.25 1.25M14 10a4.5 4.5 0 0 0-6.36 0l-3 3a4.5 4.5 0 0 0 6.36 6.36l1.25-1.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function HandCursor() {
  return (
    <svg width="30" height="34" viewBox="0 0 30 34" aria-hidden="true">
      <path
        d="M10.5 3.2c0-1.3 1-2.2 2.2-2.2s2.2.9 2.2 2.2v9.1l.4-.1c.1-1.2 1.1-2.1 2.2-2.1 1.3 0 2.2 1 2.2 2.2v.8c.3-.9 1.2-1.6 2.2-1.6 1.3 0 2.2 1 2.2 2.2v1.4c.4-.7 1.1-1.1 2-1.1 1.3 0 2.2 1 2.2 2.2v7.4c0 5.4-4 9.3-9.2 9.3h-2.3c-3 0-5.3-1.2-7-3.6l-6-8.6c-.7-1-.5-2.4.5-3.1 1-.7 2.3-.5 3.1.4l2.9 3.4V3.2z"
        fill="#fff"
        stroke="#111"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M15 17v6M19.3 17v6M23.6 17v6" stroke="#111" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    </svg>
  )
}

export function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.5 2 4 14h6l-.5 8L20 10h-6.5z" fill="#ffc83d" />
    </svg>
  )
}

export function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 10.8v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.6" r="1.1" fill="currentColor" />
    </svg>
  )
}

/* ---- 登录弹窗用的品牌图标 ---- */

export function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"
      />
      <path
        fill="#34a853"
        d="M24 46c6 0 11-2 14.6-5.2l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.2 15.4 46 24 46z"
      />
      <path fill="#fbbc05" d="M11.6 28.3c-.5-1.3-.7-2.8-.7-4.3s.3-3 .7-4.3v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.9l7.3-5.6z" />
      <path
        fill="#ea4335"
        d="M24 10.6c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.8 4.3 13.9l7.3 5.7c1.8-5.2 6.6-9 12.4-9z"
      />
    </svg>
  )
}

export function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#1877f2" />
      <path
        fill="#fff"
        d="M15.4 13.3 15.9 10h-3.2V7.9c0-.9.4-1.8 1.9-1.8h1.4V3.3S14.7 3 13.5 3c-2.5 0-4.1 1.5-4.1 4.3V10H6.6v3.3h2.8V23h3.3v-9.7z"
      />
    </svg>
  )
}

export function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m3.5 7.5 8.5 6 8.5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.2-2.5s-2.4-.9-2.4-3.6zM14.2 5.3c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z"
      />
    </svg>
  )
}

export function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10 10 0 0 0 12 2z"
      />
    </svg>
  )
}

export function BusinessIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="7" width="8" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="4" width="10" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 8h4M14 11.5h4M14 15h4M6 11h2M6 15h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: 'YouTube Shorts',
  instagram: 'Instagram Reels',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  x: 'X',
}

export function PlatformIcon({ platform, size = 20 }: { platform: Platform; size?: number }) {
  switch (platform) {
    case 'youtube':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#FF0000" />
          <path d="M10 8.8v6.4l5.5-3.2z" fill="#fff" />
        </svg>
      )
    case 'instagram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <radialGradient id="ig-grad" cx="0.3" cy="1.05" r="1.2">
              <stop offset="0" stopColor="#FFD776" />
              <stop offset="0.25" stopColor="#F3A554" />
              <stop offset="0.5" stopColor="#E1306C" />
              <stop offset="0.8" stopColor="#C13584" />
              <stop offset="1" stopColor="#5B51D8" />
            </radialGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-grad)" />
          <rect x="6" y="6" width="12" height="12" rx="3.8" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.9" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="16.2" cy="7.8" r="1" fill="#fff" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#0A66C2" />
          <rect x="6" y="10" width="2.6" height="8" fill="#fff" />
          <circle cx="7.3" cy="7" r="1.5" fill="#fff" />
          <path d="M10.8 10h2.5v1.2c.5-.8 1.5-1.4 2.8-1.4 2 0 3 1.3 3 3.6V18h-2.6v-4.2c0-1.1-.4-1.8-1.4-1.8-1 0-1.7.7-1.7 1.9V18h-2.6z" fill="#fff" />
        </svg>
      )
    case 'tiktok': {
      const note =
        'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z'
      return (
        <svg width={size} height={size} viewBox="-2 -2 28 28" aria-hidden="true">
          <path d={note} fill="#25F4EE" transform="translate(-0.8 -0.6)" />
          <path d={note} fill="#FE2C55" transform="translate(0.8 0.6)" />
          <path d={note} fill="#fff" />
        </svg>
      )
    }
    case 'facebook':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="#1877F2" />
          <path
            d="M13.4 23v-7.7h2.6l.4-3.1h-3v-2c0-.9.3-1.5 1.5-1.5h1.6V5.9c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.7v3.1h2.6V23z"
            fill="#fff"
          />
        </svg>
      )
    case 'x':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
            fill="#fff"
            transform="translate(3 3) scale(0.75)"
          />
        </svg>
      )
  }
}
