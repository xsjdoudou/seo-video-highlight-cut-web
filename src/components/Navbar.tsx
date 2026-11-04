import { useState } from 'react'
import { signOut, useBalance, useSession } from '../lib/auth'
import AuthModal from './AuthModal'

const NAV_ITEMS = [{ label: 'Pricing', path: '/pricing' }]

export default function Navbar({
  accountPath,
  onOpenAccount,
  onOpenPricing,
}: {
  accountPath: string
  onOpenAccount: () => void
  onOpenPricing: () => void
}) {
  const session = useSession()
  const balance = useBalance()
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <a className="brand" href="/" aria-label="Video Highlight home">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Video Highlight</span>
        </a>
        <nav className="navbar__links" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.path}
              className="navbar__link"
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                event.preventDefault()
                onOpenPricing()
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="navbar__actions">
          {session ? (
            <>
              {/* 真 href 是为了中键和「新标签页打开」照样能用，点击仍走前端路由。 */}
              <a
                className="navbar__account"
                href={accountPath}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                  event.preventDefault()
                  onOpenAccount()
                }}
              >
                <span className="navbar__avatar" aria-hidden="true">
                  {(session.name || session.email).trim().charAt(0).toUpperCase()}
                </span>
                <span className="navbar__account-text">
                  <strong>{session.name || session.email}</strong>
                  <span>{balance === null ? 'My account' : `${balance} credits`}</span>
                </span>
              </a>
              <button type="button" className="btn btn--ghost" onClick={signOut}>
                Log out
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setAuthOpen(true)}>
                Log in
              </button>
              <button type="button" className="btn btn--light" onClick={() => setAuthOpen(true)}>
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onDone={() => setAuthOpen(false)} />}
    </header>
  )
}
