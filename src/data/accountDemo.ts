import type { Clip } from './clips'
import type { AccountView, AssetGroup } from '../lib/account'

export const DEMO_SESSION = {
  provider: 'email' as const,
  email: 'demo@video-highlight.local',
  name: 'Demo account',
  demo: true,
}

const scores = (score: number) => ({
  hook: Math.max(60, score - 2),
  value: Math.max(60, score + 1),
  emotion: Math.max(60, score - 4),
  standalone: Math.min(98, score + 2),
  quotability: Math.max(60, score),
  clarity: Math.min(98, score + 5),
})

const titles = [
  '人物冲突里的关键转折',
  '一句话改变整段故事',
  '最值得留下的观点反转',
  '情绪浓度最高的片段',
  '人物关系的意外变化',
  '完整信息密度最高的一段',
  '故事推进最自然的时刻',
  '结尾留下余韵的片段',
]

const durations = [64.95, 87.54, 70.87, 84.91, 60.11, 118.73, 44.97, 46.74]
const platforms = ['youtube', 'instagram', 'linkedin', 'tiktok', 'facebook', 'x', 'youtube', 'instagram'] as const

export const DEMO_CLIPS: Clip[] = Array.from({ length: 6 }, (_, index) => {
  const id = `h0${index + 1}`
  const score = 88 - index * 2
  return {
    id,
    score,
    scores: scores(score),
    type: 'Highlight',
    sourceStart: 0,
    sourceEnd: durations[index],
    duration: durations[index],
    video: `/media/aya_demo/clips/${id}.mp4`,
    preview: `/media/aya_demo/clips/${id}-preview.mp4`,
    poster: `/media/aya_demo/clips/${id}.jpg`,
    title: titles[index],
    platform: platforms[index],
    evaluation: {
      conclusion: '从真实剪辑流水线生成的本地预览片段。',
      reasons: {},
    },
  }
})

export const DEMO_ACCOUNT: AccountView = {
  user: {
    id: 'demo-account',
    email: DEMO_SESSION.email,
    name: DEMO_SESSION.name,
    provider: 'email',
    createdAt: '2026-10-26T13:33:00.000Z',
    lastLoginAt: '2026-10-30T04:30:00.000Z',
    loginCount: 1,
  },
  recharged: 100,
  spent: 16,
  balance: 84,
  recharges: [],
  consumptions: [],
}

export const DEMO_GROUPS: AssetGroup[] = [
  {
    jobId: 'aya-demo-20261026-213300',
    sourceName: 'aya_highlights_demo.mp4',
    createdAt: '2026-10-26T13:33:00.000Z',
    clips: DEMO_CLIPS,
  },
]
