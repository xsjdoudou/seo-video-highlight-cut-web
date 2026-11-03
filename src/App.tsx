import { useCallback, useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import DemoShowcase from './components/DemoShowcase'
import CreatePage from './components/CreatePage'
import AccountPage from './components/AccountPage'
import PricingPage from './components/PricingPage'
import ClipModal from './components/ClipModal'
import LegalPage from './components/LegalPage'
import type { Clip } from './data/clips'
import type { JobInput } from './lib/videoSource'

const CREATE_PATH = '/create'
const ACCOUNT_PATH = '/account'
const PRICING_PATH = '/pricing'
const TERMS_PATH = '/terms'
const PRIVACY_PATH = '/privacy'

export default function App() {
  const [activeClip, setActiveClip] = useState<Clip | null>(null)
  const [job, setJob] = useState<JobInput | null>(null)
  // 账户页的数据全从接口来，刷新和深链都能直接打开，不像 /create 那样依赖内存里的 job。
  const [account, setAccount] = useState(() => window.location.pathname === ACCOUNT_PATH)
  const [pricing, setPricing] = useState(() => window.location.pathname === PRICING_PATH)
  const [legalPath, setLegalPath] = useState<'terms' | 'privacy' | null>(() => {
    if (window.location.pathname === TERMS_PATH) return 'terms'
    if (window.location.pathname === PRIVACY_PATH) return 'privacy'
    return null
  })

  // The job only lives in memory, so a reload or a deep link to /create has
  // nothing to show: send those visitors back to the landing page.
  useEffect(() => {
    if (window.location.pathname === CREATE_PATH) {
      window.history.replaceState(null, '', '/')
    }
  }, [])

  // Back/forward between the landing page, the confirm page and the account
  // page. Navigating forward into a /create entry we no longer have a job for
  // rewrites the URL.
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname
      setAccount(path === ACCOUNT_PATH)
      setPricing(path === PRICING_PATH)
      setLegalPath(path === TERMS_PATH ? 'terms' : path === PRIVACY_PATH ? 'privacy' : null)
      if (path !== CREATE_PATH) setJob(null)
      else if (!job) window.history.replaceState(null, '', '/')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [job])

  const start = useCallback((input: JobInput) => {
    setAccount(false)
    setPricing(false)
    setLegalPath(null)
    setJob(input)
    window.history.pushState(null, '', CREATE_PATH)
    window.scrollTo(0, 0)
  }, [])

  const leave = useCallback(() => {
    if (window.location.pathname === CREATE_PATH) window.history.back()
    else setJob(null)
  }, [])

  const openAccount = useCallback(() => {
    setJob(null)
    setAccount(true)
    setPricing(false)
    setLegalPath(null)
    if (window.location.pathname !== ACCOUNT_PATH) window.history.pushState(null, '', ACCOUNT_PATH)
    window.scrollTo(0, 0)
  }, [])

  const openPricing = useCallback(() => {
    setJob(null)
    setAccount(false)
    setPricing(true)
    setLegalPath(null)
    if (window.location.pathname !== PRICING_PATH) window.history.pushState(null, '', PRICING_PATH)
    window.scrollTo(0, 0)
  }, [])

  // 直接深链打开 /account 时身后可能没有历史，用 replaceState 回首页而不是 back()。
  const leaveAccount = useCallback(() => {
    setAccount(false)
    setPricing(false)
    setLegalPath(null)
    if ([ACCOUNT_PATH, PRICING_PATH, TERMS_PATH, PRIVACY_PATH].includes(window.location.pathname)) {
      window.history.replaceState(null, '', '/')
    }
  }, [])

  return (
    <>
      <Navbar accountPath={ACCOUNT_PATH} onOpenAccount={openAccount} onOpenPricing={openPricing} />
      <main>
        {job ? (
          <CreatePage job={job} onRemove={leave} onOpenClip={setActiveClip} />
        ) : pricing ? (
          <PricingPage onBack={leaveAccount} />
        ) : account ? (
          <AccountPage
            onBack={leaveAccount}
            onStart={leaveAccount}
            onOpenClip={setActiveClip}
            onOpenPricing={openPricing}
          />
        ) : legalPath ? (
          <LegalPage kind={legalPath} onBack={leaveAccount} />
        ) : (
          <>
            <Hero />
            <DemoShowcase onOpenClip={setActiveClip} onStart={start} paused={activeClip !== null} />
          </>
        )}
      </main>
      <footer className="footer">
        <span>© {new Date().getFullYear()} Video Highlight · AI clipping for podcasts and long-form video</span>
        <span className="footer__links">
          <a href={TERMS_PATH}>Terms of service</a>
          <a href={PRIVACY_PATH}>Privacy policy</a>
          <a href="mailto:support@video-highlight.com">Contact support</a>
          <span className="footer__beta">Beta</span>
        </span>
      </footer>
      {activeClip && <ClipModal clip={activeClip} onClose={() => setActiveClip(null)} />}
    </>
  )
}
