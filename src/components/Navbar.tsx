const NAV_ITEMS = [
  { label: 'Features', dropdown: true },
  { label: 'Solutions', dropdown: true },
  { label: 'Resources', dropdown: true },
  { label: 'Pricing' },
  { label: 'For business' },
]

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__inner">
        <a className="brand" href="/" aria-label="Video Highlight home">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Video Highlight</span>
        </a>
        <nav className="navbar__links" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <a key={item.label} href="#" className="navbar__link">
              {item.label}
              {item.dropdown && <Chevron />}
            </a>
          ))}
        </nav>
        <div className="navbar__actions">
          <a href="#" className="btn btn--ghost">Log in</a>
          <a href="#" className="btn btn--light">Sign up</a>
        </div>
      </div>
    </header>
  )
}
