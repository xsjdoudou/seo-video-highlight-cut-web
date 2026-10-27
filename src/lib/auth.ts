/**
 * 登录态。目前是演示版：没有后端认证，会话只存在浏览器里，
 * Google / Facebook 这些按钮不会真的走 OAuth。
 *
 * 接真 OAuth 时只要换掉 signIn 的实现（以及把 `demo` 置 false），
 * 页面其余部分读的都是这里的 Session。
 */

import { useSyncExternalStore } from 'react'

export type Provider = 'google' | 'facebook' | 'email' | 'apple' | 'github'

export type Session = {
  provider: Provider
  email: string
  name: string
  /** 演示登录，不是真实账号。 */
  demo: boolean
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  google: 'Google',
  facebook: 'Facebook',
  email: 'Email',
  apple: 'Apple',
  github: 'GitHub',
}

const STORAGE_KEY = 'vh.session'

function read(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.provider || !parsed?.email) return null
    return parsed as Session
  } catch {
    return null
  }
}

let current: Session | null = read()
const listeners = new Set<() => void>()

function publish(next: Session | null) {
  current = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 隐私模式下写不进去，内存里的会话照样能用 */
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSession(): Session | null {
  return current
}

/** 邮箱地址的 @ 前面那段，首字母大写，当展示名用。 */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'there'
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export function signIn(provider: Provider, email?: string): Session {
  const address = (email || `demo@${provider === 'email' ? 'example.com' : `${provider}.com`}`).trim()
  const session: Session = { provider, email: address, name: nameFromEmail(address), demo: true }
  publish(session)
  // 后端那边落一份用户档案（第一次登录还会送注册积分）。失败不拦登录，
  // 剪辑接口拿到 email 时也会再找一次这个用户。
  void registerSession(session)
  return session
}

/** 把会话告诉后端，顺便拿回余额；后端没起来时静默跳过。 */
async function registerSession(session: Session): Promise<void> {
  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(session),
    })
    if (!response.ok) return
    const data = (await response.json()) as { balance?: number }
    if (typeof data.balance === 'number') publishBalance(data.balance)
  } catch {
    /* 纯静态部署下没有 /api，照常用演示会话 */
  }
}

export function signOut(): void {
  publish(null)
  publishBalance(null)
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, getSession)
}

// ------------------------------------------------------------------ 账户余额

let balance: number | null = null
const balanceListeners = new Set<() => void>()

function publishBalance(next: number | null) {
  balance = next
  balanceListeners.forEach((listener) => listener())
}

function subscribeBalance(listener: () => void): () => void {
  balanceListeners.add(listener)
  return () => balanceListeners.delete(listener)
}

function getBalance(): number | null {
  return balance
}

/** 重新读一遍余额（剪完一次就会少几分）。没登录或没后端时置空。 */
export async function refreshBalance(): Promise<void> {
  const session = current
  if (!session) {
    publishBalance(null)
    return
  }
  try {
    const response = await fetch(`/api/account?email=${encodeURIComponent(session.email)}`)
    if (!response.ok) return
    const data = (await response.json()) as { balance?: number }
    publishBalance(typeof data.balance === 'number' ? data.balance : null)
  } catch {
    /* 同上：没有 /api 就不显示余额 */
  }
}

export function useBalance(): number | null {
  return useSyncExternalStore(subscribeBalance, getBalance, getBalance)
}

// 刷新页面后会话还在，余额得重新问一次。
if (current) void refreshBalance()
