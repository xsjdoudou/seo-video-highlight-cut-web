import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { isValidEmail, signIn, signInWithGoogle } from '../lib/auth'
import { GoogleIcon } from './icons'

/** Real account registration and login backed by the server. */
export default function AuthModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    panel.current?.scrollTo({ top: 0 })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  useEffect(() => {
    emailInput.current?.focus()
  }, [mode])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setError('Your password must be at least 8 characters.')
      return
    }
    if (mode === 'register' && !name.trim()) {
      setError('Enter your name.')
      return
    }
    setBusy(true)
    try {
      await signIn(mode, email, password, name)
      onDone()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const changeMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
  }

  const continueWithGoogle = () => {
    setError('')
    setGoogleBusy(true)
    signInWithGoogle()
  }

  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={onClose}>
      <div className="auth" ref={panel} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="auth__close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 id="auth-title" className="auth__title">
          {mode === 'login' ? 'Log in' : 'Create your account'}
        </h2>
        <p className="auth__lede">
          {mode === 'login' ? 'Use your email and password to continue.' : 'Create an account to save your clips and credits.'}
        </p>

        <button type="button" className="auth__provider" onClick={continueWithGoogle} disabled={busy || googleBusy}>
          <GoogleIcon />
          <span>{googleBusy ? 'Connecting…' : 'Continue with Google'}</span>
        </button>

        <div className="auth__divider" aria-hidden="true">
          <span>or continue with email</span>
        </div>

        <form className="auth__form" onSubmit={submit}>
          {mode === 'register' && (
            <input
              type="text"
              className="auth__input"
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              aria-label="Your name"
            />
          )}
          <input
            ref={emailInput}
            type="email"
            className="auth__input"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            aria-label="Email address"
            aria-invalid={Boolean(error)}
          />
          <input
            type="password"
            className="auth__input"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            aria-label="Password"
            aria-invalid={Boolean(error)}
          />
          {error && (
            <p className="auth__error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="auth__submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <button type="button" className="auth__text-button" onClick={changeMode} disabled={busy}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
        </button>

        <p className="auth__terms">
          By continuing you agree to our <a href="#" className="auth__link">Terms of Use</a> and{' '}
          <a href="#" className="auth__link">Privacy Policy</a>.
        </p>
      </div>
    </div>,
    document.body,
  )
}
