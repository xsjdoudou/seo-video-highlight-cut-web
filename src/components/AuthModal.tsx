import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { isValidEmail, signIn, type Provider } from '../lib/auth'
import { AppleIcon, BusinessIcon, FacebookIcon, GitHubIcon, GoogleIcon, MailIcon } from './icons'

/** 先露出来的三个入口，和「其他登录方式」后面才展开的两个。 */
const PRIMARY: { provider: Provider; label: string; icon: ComponentType }[] = [
  { provider: 'google', label: 'Continue with Google', icon: GoogleIcon },
  { provider: 'facebook', label: 'Continue with Facebook', icon: FacebookIcon },
]

const MORE: { provider: Provider; label: string; icon: ComponentType }[] = [
  { provider: 'apple', label: 'Continue with Apple', icon: AppleIcon },
  { provider: 'github', label: 'Continue with GitHub', icon: GitHubIcon },
]

/**
 * 登录 / 注册弹窗。未登录时点 Get clips 会弹它，登录成功后由调用方接着往下跑。
 * 现在是演示登录，点哪个入口都只是在本地建一个会话，见 src/lib/auth.ts。
 */
export default function AuthModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [emailMode, setEmailMode] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  useEffect(() => {
    if (emailMode) emailInput.current?.focus()
  }, [emailMode])

  const choose = (provider: Provider) => {
    signIn(provider)
    onDone()
  }

  const submitEmail = (e: FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    signIn('email', email)
    onDone()
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={onClose}>
      <div className="auth" ref={panel} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth__close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 id="auth-title" className="auth__title">
          Sign up or log in
        </h2>
        <p className="auth__lede">Use your email or another service to continue — free while in beta.</p>

        {emailMode ? (
          <form className="auth__form" onSubmit={submitEmail}>
            <input
              ref={emailInput}
              type="email"
              className="auth__input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              aria-label="Email address"
              aria-invalid={Boolean(error)}
            />
            {error && (
              <p className="auth__error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth__submit">
              Continue
            </button>
            <button type="button" className="auth__text-button" onClick={() => setEmailMode(false)}>
              Back to all options
            </button>
          </form>
        ) : (
          <>
            {PRIMARY.map(({ provider, label, icon: Icon }) => (
              <button key={provider} type="button" className="auth__provider" onClick={() => choose(provider)}>
                <Icon />
                <span>{label}</span>
              </button>
            ))}
            <button type="button" className="auth__provider" onClick={() => setEmailMode(true)}>
              <MailIcon />
              <span>Continue with email</span>
            </button>

            {showMore ? (
              MORE.map(({ provider, label, icon: Icon }) => (
                <button key={provider} type="button" className="auth__provider" onClick={() => choose(provider)}>
                  <Icon />
                  <span>{label}</span>
                </button>
              ))
            ) : (
              <button type="button" className="auth__text-button" onClick={() => setShowMore(true)}>
                Other ways to log in
              </button>
            )}
          </>
        )}

        <p className="auth__terms">
          By continuing you agree to our{' '}
          <a href="#" className="auth__link">
            Terms of Use
          </a>
          . Read our{' '}
          <a href="#" className="auth__link">
            Privacy Policy
          </a>
          .
        </p>

        <a href="#" className="auth__business">
          <BusinessIcon />
          Create a team account
        </a>

        <p className="auth__demo">Demo sign-in: nothing is sent anywhere and no real account is created.</p>
      </div>
    </div>
  )
}
