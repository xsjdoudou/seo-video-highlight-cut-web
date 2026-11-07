import { useCallback, useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import HomeContent from './components/HomeContent'
import DemoShowcase from './components/DemoShowcase'
import CreatePage from './components/CreatePage'
import AccountPage from './components/AccountPage'
import PricingPage from './components/PricingPage'
import ClipModal from './components/ClipModal'
import LegalPage from './components/LegalPage'
import HowItWorksPage from './components/HowItWorksPage'
import GeneratorPage from './components/GeneratorPage'
import type { Clip } from './data/clips'
import type { JobInput } from './lib/videoSource'
import { pageSeo } from './seo'

const CREATE_PATH = '/create'
const ACCOUNT_PATH = '/account'
const PRICING_PATH = '/pricing'
const TERMS_PATH = '/terms'
const PRIVACY_PATH = '/privacy'
const HOW_IT_WORKS_PATH = '/how-it-works'
const CREATIONS_PATH = '/creations'
const GENERATOR_PATHS = ['/ai-shorts-generator']

export default function App({ initialPath }: { initialPath?: string } = {}) {
  const path = initialPath ?? window.location.pathname
  const [activeClip, setActiveClip] = useState<Clip | null>(null)
  const [job, setJob] = useState<JobInput | null>(null)
  // 账户页的数据全从接口来，刷新和深链都能直接打开，不像 /create 那样依赖内存里的 job。
  const [account, setAccount] = useState(() => path === ACCOUNT_PATH)
  const [pricing, setPricing] = useState(() => path === PRICING_PATH)
  const [howItWorks, setHowItWorks] = useState(() => path === HOW_IT_WORKS_PATH)
  const [creations, setCreations] = useState(() => path === CREATIONS_PATH)
  const [generatorPath, setGeneratorPath] = useState(() => GENERATOR_PATHS.includes(path) ? path : '')
  const [legalPath, setLegalPath] = useState<'terms' | 'privacy' | null>(() => {
    if (path === TERMS_PATH) return 'terms'
    if (path === PRIVACY_PATH) return 'privacy'
    return null
  })

  useEffect(() => {
    const seo = pageSeo(pricing ? PRICING_PATH : howItWorks ? HOW_IT_WORKS_PATH : generatorPath || '/')
    document.title = seo.title
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', seo.canonical)
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', seo.description)
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', seo.title)
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', seo.description)
  }, [pricing, howItWorks, generatorPath])

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
      setHowItWorks(path === HOW_IT_WORKS_PATH)
      setCreations(path === CREATIONS_PATH)
      setGeneratorPath(GENERATOR_PATHS.includes(path) ? path : '')
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
    setHowItWorks(false)
    setCreations(false)
    setGeneratorPath('')
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
    setHowItWorks(false)
    setCreations(false)
    setGeneratorPath('')
    setLegalPath(null)
    if (window.location.pathname !== ACCOUNT_PATH) window.history.pushState(null, '', ACCOUNT_PATH)
    window.scrollTo(0, 0)
  }, [])

  const openHowItWorks = useCallback(() => {
    setJob(null)
    setAccount(false)
    setPricing(false)
    setHowItWorks(true)
    setCreations(false)
    setGeneratorPath('')
    setLegalPath(null)
    if (window.location.pathname !== HOW_IT_WORKS_PATH) window.history.pushState(null, '', HOW_IT_WORKS_PATH)
    window.scrollTo(0, 0)
  }, [])

  const openCreations = useCallback(() => {
    setJob(null)
    setAccount(false)
    setPricing(false)
    setHowItWorks(false)
    setCreations(true)
    setGeneratorPath('')
    setLegalPath(null)
    if (window.location.pathname !== CREATIONS_PATH) window.history.pushState(null, '', CREATIONS_PATH)
    window.scrollTo(0, 0)
  }, [])

  const openPricing = useCallback(() => {
    setJob(null)
    setAccount(false)
    setPricing(true)
    setHowItWorks(false)
    setCreations(false)
    setGeneratorPath('')
    setLegalPath(null)
    if (window.location.pathname !== PRICING_PATH) window.history.pushState(null, '', PRICING_PATH)
    window.scrollTo(0, 0)
  }, [])

  // 直接深链打开 /account 时身后可能没有历史，用 replaceState 回首页而不是 back()。
  const leaveAccount = useCallback(() => {
    setAccount(false)
    setPricing(false)
    setHowItWorks(false)
    setCreations(false)
    setGeneratorPath('')
    setLegalPath(null)
    if ([ACCOUNT_PATH, PRICING_PATH, HOW_IT_WORKS_PATH, CREATIONS_PATH, TERMS_PATH, PRIVACY_PATH, ...GENERATOR_PATHS].includes(window.location.pathname)) {
      window.history.replaceState(null, '', '/')
    }
  }, [])

  return (
    <>
      <Navbar
        accountPath={ACCOUNT_PATH}
        onOpenAccount={openAccount}
        onOpenHowItWorks={openHowItWorks}
        onOpenPricing={openPricing}
        onOpenCreations={openCreations}
      />
      <main>
        {job ? (
          <CreatePage job={job} onRemove={leave} onOpenClip={setActiveClip} />
        ) : pricing ? (
          <PricingPage onBack={leaveAccount} />
        ) : howItWorks ? (
          <HowItWorksPage onBack={leaveAccount} onStart={leaveAccount} />
        ) : generatorPath ? (
          <GeneratorPage onStart={leaveAccount} />
        ) : creations ? (
          <AccountPage
            mode="creations"
            onBack={leaveAccount}
            onStart={leaveAccount}
            onOpenClip={setActiveClip}
            onOpenPricing={openPricing}
          />
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
            <HomeContent />
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
