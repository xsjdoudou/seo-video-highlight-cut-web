import { useCallback, useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import DemoShowcase from './components/DemoShowcase'
import CreatePage from './components/CreatePage'
import AccountPage from './components/AccountPage'
import ClipModal from './components/ClipModal'
import type { Clip } from './data/clips'
import type { JobInput } from './lib/videoSource'

const CREATE_PATH = '/create'
const ACCOUNT_PATH = '/account'

export default function App() {
  const [activeClip, setActiveClip] = useState<Clip | null>(null)
  const [job, setJob] = useState<JobInput | null>(null)
  const accountDemo = new URLSearchParams(window.location.search).get('account-demo') === 'aya'
  // 账户页的数据全从接口来，刷新和深链都能直接打开，不像 /create 那样依赖内存里的 job。
  const [account, setAccount] = useState(() => window.location.pathname === ACCOUNT_PATH || accountDemo)

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
      if (path !== CREATE_PATH) setJob(null)
      else if (!job) window.history.replaceState(null, '', '/')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [job])

  const start = useCallback((input: JobInput) => {
    setAccount(false)
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
    if (window.location.pathname !== ACCOUNT_PATH) window.history.pushState(null, '', ACCOUNT_PATH)
    window.scrollTo(0, 0)
  }, [])

  // 直接深链打开 /account 时身后可能没有历史，用 replaceState 回首页而不是 back()。
  const leaveAccount = useCallback(() => {
    setAccount(false)
    if (window.location.pathname === ACCOUNT_PATH) window.history.replaceState(null, '', '/')
  }, [])

  return (
    <>
      <Navbar accountPath={ACCOUNT_PATH} onOpenAccount={openAccount} demoAccount={accountDemo} />
      <main>
        {job ? (
          <CreatePage job={job} onRemove={leave} onOpenClip={setActiveClip} />
        ) : account ? (
          <AccountPage onBack={leaveAccount} onStart={leaveAccount} onOpenClip={setActiveClip} demo={accountDemo} />
        ) : (
          <>
            <Hero />
            <DemoShowcase onOpenClip={setActiveClip} onStart={start} paused={activeClip !== null} />
          </>
        )}
      </main>
      <footer className="footer">
        © {new Date().getFullYear()} Video Highlight · AI clipping for podcasts and long-form video
      </footer>
      {activeClip && <ClipModal clip={activeClip} onClose={() => setActiveClip(null)} />}
    </>
  )
}
