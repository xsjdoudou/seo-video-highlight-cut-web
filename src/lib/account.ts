/**
 * 账户页读的数据：余额、流水，以及这个账户剪出来的全部成片。
 * 后端实现在 scripts/clip-api.mjs（/api/account 和 /api/assets），
 * 落盘在 scripts/store.mjs 的 data/*.jsonl。
 */

import type { Clip } from '../data/clips'
import { highlightsToClips, type Highlight } from './clipApi'

export type AccountUser = {
  id: string
  email: string
  name: string
  provider: string
  createdAt: string
  lastLoginAt: string
  loginCount: number
}

export type RechargeRow = {
  id: string
  credits: number
  amount: number
  currency: string
  method: string
  note: string
  createdAt: string
}

export type ConsumptionRow = {
  id: string
  jobId: string
  credits: number
  status: 'done' | 'error'
  durationSeconds: number
  clips: number
  error: string
  createdAt: string
}

export type AccountView = {
  user: AccountUser | null
  recharged: number
  spent: number
  balance: number
  recharges: RechargeRow[]
  consumptions: ConsumptionRow[]
}

/** 一条成片。highlight 原样来自剪辑服务，和任务刚跑完时拿到的那份结构一致。 */
export type Asset = {
  id: string
  jobId: string
  rank: number
  sourceName: string
  sourceUrl: string
  highlight: Highlight
  createdAt: string
}

/** 同一趟任务剪出来的片子归一组，账户页按任务分段展示。 */
export type AssetGroup = {
  jobId: string
  sourceName: string
  createdAt: string
  clips: Clip[]
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export function fetchAccount(email: string): Promise<AccountView> {
  return getJson<AccountView>(`/api/account?email=${encodeURIComponent(email)}`)
}

export async function fetchAssets(email: string): Promise<Asset[]> {
  const data = await getJson<{ assets?: Asset[] }>(`/api/assets?email=${encodeURIComponent(email)}`)
  return Array.isArray(data.assets) ? data.assets : []
}

/**
 * 成片按任务分组，并复用剪辑结果页那套 Highlight → Clip 映射，
 * 这样账户页的卡片和刚剪完时看到的完全一致。
 */
export function groupAssets(assets: Asset[]): AssetGroup[] {
  const groups = new Map<string, Asset[]>()
  for (const asset of assets) {
    const bucket = groups.get(asset.jobId)
    if (bucket) bucket.push(asset)
    else groups.set(asset.jobId, [asset])
  }

  return [...groups.entries()].map(([jobId, rows]) => {
    // 组内按 rank 正序，和结果页一致；组之间保持接口给的「新的在前」。
    const ordered = [...rows].sort((a, b) => a.rank - b.rank)
    return {
      jobId,
      sourceName: ordered[0]?.sourceName || ordered[0]?.sourceUrl || 'Untitled source',
      createdAt: ordered[0]?.createdAt ?? '',
      clips: highlightsToClips(ordered.map((asset) => asset.highlight)),
    }
  })
}

/** 列表里的日期只精确到天就够了。 */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
