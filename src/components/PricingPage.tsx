import { useEffect, useState } from 'react'
import { getSession, useSession } from '../lib/auth'
import AuthModal from './AuthModal'

type BillingPlan = {
  id: string
  name: string
  credits: number
  price: string
  currency: string
  available: boolean
}

const DEFAULT_PLANS: BillingPlan[] = [
  { id: 'starter', name: 'Starter', credits: 100, price: '7.99', currency: 'USD', available: true },
  { id: 'creator', name: 'Creator', credits: 500, price: '27.99', currency: 'USD', available: true },
  { id: 'studio', name: 'Studio', credits: 1200, price: '57.99', currency: 'USD', available: true },
]

const PLAN_DETAILS: Record<string, string> = {
  starter: 'For occasional projects and short-form experiments.',
  creator: 'For recurring podcast, interview, and creator workflows.',
  studio: 'For teams producing highlights at a larger weekly volume.',
}

export default function PricingPage({ onBack }: { onBack: () => void }) {
  const session = useSession()
  const [plans, setPlans] = useState<BillingPlan[]>(DEFAULT_PLANS)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState('')
  const [error, setError] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingPlan, setPendingPlan] = useState('')

  useEffect(() => {
    fetch('/api/billing/plans')
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json() as Promise<{ configured?: boolean; plans?: BillingPlan[] }>
      })
      .then((data) => {
        if (Array.isArray(data.plans) && data.plans.length > 0) setPlans(data.plans)
      })
      .catch(() => setError('Live checkout status could not be verified. The published packages are shown below.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!session || !pendingPlan) return
    const planId = pendingPlan
    setPendingPlan('')
    void startCheckout(planId)
  }, [pendingPlan, session])

  const startCheckout = async (planId: string) => {
    const current = getSession()
    if (!current) {
      setPendingPlan(planId)
      setAuthOpen(true)
      return
    }
    setBuying(planId)
    setError('')
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ planId }),
      })
      const data = (await response.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string }
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || 'Checkout could not be started.')
      window.location.assign(data.checkoutUrl)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout could not be started.')
      setBuying('')
    }
  }

  return (
    <section className="pricing" aria-labelledby="pricing-heading">
      <div className="pricing__nav">
        <button type="button" className="results-page__back" onClick={onBack}>
          <span aria-hidden="true">←</span> Back
        </button>
      </div>
      <header className="pricing__header">
        <p className="results-page__eyebrow">Credit packs</p>
        <h1 id="pricing-heading">Keep your clips moving.</h1>
        <p>Buy credits once and use them whenever you need new highlights. Every pack is a one-time purchase: no subscription and no automatic renewal.</p>
      </header>

      {loading && <p className="pricing__message">Loading packages…</p>}
      {error && <p className="pricing__message pricing__message--error" role="alert">{error}</p>}

      <div className="pricing__grid">
        {plans.map((plan, index) => (
          <article key={plan.id} className={`pricing__plan${index === 1 ? ' pricing__plan--featured' : ''}`}>
            {index === 1 && <span className="pricing__badge">Most popular</span>}
            <h2>{plan.name}</h2>
            <p className="pricing__credits"><strong>{plan.credits.toLocaleString()}</strong> credits</p>
            <p className="pricing__price"><strong>{plan.currency} {plan.price}</strong><span> one time</span></p>
            <p className="pricing__description">{PLAN_DETAILS[plan.id] || 'Use these credits for AI video highlight processing.'}</p>
            <p className="pricing__minutes">About {Math.floor(plan.credits / 2).toLocaleString()} minutes of source video</p>
            <button
              type="button"
              className={`btn ${index === 1 ? 'btn--light' : 'btn--outline'} pricing__button`}
              disabled={!plan.available || Boolean(buying)}
              onClick={() => void startCheckout(plan.id)}
            >
              {buying === plan.id ? 'Opening checkout…' : plan.available ? 'Buy credits' : 'Coming soon'}
            </button>
          </article>
        ))}
      </div>

      <div className="pricing__terms">
        <strong>How credits work</strong>
        <p>2 credits = 1 minute of source video. Credits are used for processing and are added after payment is confirmed.</p>
        <p>All packages are one-time purchases, not subscriptions, and do not renew automatically. Secure checkout is powered by Waffo.</p>
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onDone={() => setAuthOpen(false)} />}
    </section>
  )
}
