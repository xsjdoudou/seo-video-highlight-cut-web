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

export default function PricingPage({ onBack }: { onBack: () => void }) {
  const session = useSession()
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [configured, setConfigured] = useState(false)
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
        setConfigured(Boolean(data.configured))
        setPlans(Array.isArray(data.plans) ? data.plans : [])
      })
      .catch(() => setError('We could not load the credit packages. Please try again.'))
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
        body: JSON.stringify({ email: current.email, planId }),
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
        <p>Buy credits once and use them whenever you need new highlights.</p>
      </header>

      {loading && <p className="pricing__message">Loading packages…</p>}
      {error && <p className="pricing__message pricing__message--error" role="alert">{error}</p>}
      {!loading && !configured && (
        <p className="pricing__message">Payments are being configured. Please check back soon.</p>
      )}

      <div className="pricing__grid">
        {plans.map((plan, index) => (
          <article key={plan.id} className={`pricing__plan${index === 1 ? ' pricing__plan--featured' : ''}`}>
            {index === 1 && <span className="pricing__badge">Most popular</span>}
            <h2>{plan.name}</h2>
            <p className="pricing__credits"><strong>{plan.credits.toLocaleString()}</strong> credits</p>
            <p className="pricing__price"><strong>{plan.currency} {plan.price}</strong><span> one time</span></p>
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

      <p className="pricing__fineprint">Secure checkout powered by Waffo. Credits are added after payment is confirmed.</p>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onDone={() => setAuthOpen(false)} />}
    </section>
  )
}
