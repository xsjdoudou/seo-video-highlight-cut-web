/** Server-backed email authentication and the current HttpOnly session. */

import { useSyncExternalStore } from 'react'

export type Provider = 'email' | 'google'

export type Session = {
  id: string
  provider: Provider
  email: string
  name: string
  demo: false
}

export const PROVIDER_LABEL: Record<Provider, string> = { email: 'Email', google: 'Google' }

let current: Session | null = null
const listeners = new Set<() => void>()

function publish(next: Session | null) {
  current = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSession(): Session | null {
  return current
}

async function errorMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  return data.error || 'Authentication failed. Please try again.'
}

function toSession(value: unknown): Session | null {
  if (!value || typeof value !== 'object') return null
  const user = value as Partial<Session>
  if (!user.id || !user.email || !user.name) return null
  return {
    id: user.id,
    provider: user.provider === 'google' ? 'google' : 'email',
    email: user.email,
    name: user.name,
    demo: false,
  }
}

async function loadSession() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (!response.ok) return
    const data = (await response.json()) as { user?: unknown }
    publish(toSession(data.user))
    if (current) void refreshBalance()
  } catch {
    /* A static build can run without the API; it simply starts signed out. */
  }
}

export async function signIn(mode: 'login' | 'register', email: string, password: string, name = ''): Promise<Session> {
  const response = await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password, name }),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  const data = (await response.json()) as { user?: unknown }
  const session = toSession(data.user)
  if (!session) throw new Error('The server returned an invalid account.')
  publish(session)
  void refreshBalance()
  return session
}

export function signInWithGoogle(): void {
  window.location.assign('/api/auth/google')
}

export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
  } finally {
    publish(null)
    publishBalance(null)
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, getSession)
}

// ------------------------------------------------------------------ account balance

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

export async function refreshBalance(): Promise<void> {
  if (!current) {
    publishBalance(null)
    return
  }
  try {
    const response = await fetch('/api/account', { credentials: 'same-origin' })
    if (response.status === 401) {
      publish(null)
      publishBalance(null)
      return
    }
    if (!response.ok) return
    const data = (await response.json()) as { balance?: number }
    publishBalance(typeof data.balance === 'number' ? data.balance : null)
  } catch {
    /* Keep the last known balance during a temporary network failure. */
  }
}

export function useBalance(): number | null {
  return useSyncExternalStore(subscribeBalance, getBalance, getBalance)
}

void loadSession()
