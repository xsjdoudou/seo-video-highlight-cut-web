import { useEffect, useState } from 'react'
import type { Clip } from '../data/clips'
import { useSession } from '../lib/auth'
import {
  fetchAccount,
  fetchAssets,
  formatDate,
  groupAssets,
  type AccountView,
  type AssetGroup,
} from '../lib/account'
import { ResultCard } from './ResultsPage'

type Phase = 'loading' | 'ready' | 'error'

export default function AccountPage({
  onBack,
  onStart,
  onOpenClip,
}: {
  onBack: () => void
  onStart: () => void
  onOpenClip: (clip: Clip) => void
}) {
  const session = useSession()
  const [phase, setPhase] = useState<Phase>('loading')
  const [account, setAccount] = useState<AccountView | null>(null)
  const [groups, setGroups] = useState<AssetGroup[]>([])

  useEffect(() => {
    if (!session) {
      setPhase('ready')
      setAccount(null)
      setGroups([])
      return
    }
    let live = true
    setPhase('loading')
    Promise.all([fetchAccount(session.email), fetchAssets(session.email)])
      .then(([view, assets]) => {
        if (!live) return
        setAccount(view)
        setGroups(groupAssets(assets))
        setPhase('ready')
      })
      .catch(() => live && setPhase('error'))
    return () => {
      live = false
    }
  }, [session])

  const totalClips = groups.reduce((sum, group) => sum + group.clips.length, 0)

  if (!session) {
    return (
      <section className="account">
        <div className="results-page__nav">
          <button type="button" className="results-page__back" onClick={onBack}>
            <span aria-hidden="true">←</span> Back
          </button>
        </div>
        <div className="results-page__empty">
          <span className="results-page__empty-mark">—</span>
          <h2>You're signed out</h2>
          <p>Log in to see your credits and every clip you've generated.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="account" aria-labelledby="account-heading">
      <div className="results-page__nav">
        <button type="button" className="results-page__back" onClick={onBack}>
          <span aria-hidden="true">←</span> Back
        </button>
        <span className="account__email">{session.email}</span>
      </div>

      <header className="results-page__header">
        <p className="results-page__eyebrow">Your account</p>
        <h1 id="account-heading">{account?.user?.name || session.name}</h1>
        <p className="results-page__intro">
          Every clip you've generated lives here. Open any one of them to see the full evaluation again.
        </p>
      </header>

      <section className="results-overview" aria-label="Account overview">
        <div className="results-overview__stat">
          <strong>{account ? account.balance : '—'}</strong>
          <span>Credits left</span>
        </div>
        <div className="results-overview__stat">
          <strong>{account ? account.spent : '—'}</strong>
          <span>Credits spent</span>
        </div>
        <div className="results-overview__stat">
          <strong>{phase === 'loading' ? '—' : totalClips}</strong>
          <span>Clips generated</span>
        </div>
        <div className="results-overview__dimensions">
          <span>Runs</span>
          <div>
            <span>{phase === 'loading' ? '—' : `${groups.length} video${groups.length === 1 ? '' : 's'} processed`}</span>
          </div>
        </div>
      </section>

      {phase === 'loading' && <p className="account__note">Loading your clips…</p>}

      {phase === 'error' && (
        <p className="account__note account__note--error" role="alert">
          We couldn't load your account just now. Please refresh and try again.
        </p>
      )}

      {phase === 'ready' && groups.length === 0 && (
        <div className="results-page__empty">
          <span className="results-page__empty-mark">—</span>
          <h2>No clips yet</h2>
          <p>Run your first video and the shorts you get back will show up here.</p>
          <button type="button" className="btn btn--light" onClick={onStart}>
            Get clips in 1 click
          </button>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.jobId} className="account__run" aria-label={group.sourceName}>
          <div className="account__run-head">
            <span className="account__run-source" title={group.sourceName}>
              <span className="results-page__source-icon">↗</span>
              {group.sourceName}
            </span>
            <span className="account__run-meta">
              {group.clips.length} clip{group.clips.length === 1 ? '' : 's'}
              {group.createdAt && ` · ${formatDate(group.createdAt)}`}
            </span>
          </div>
          {/* 和结果页同一套栅格，卡片大小保持一致。 */}
          <div className="results-page__grid">
            {group.clips.map((clip, index) => (
              <ResultCard
                key={`${group.jobId}-${index}`}
                clip={clip}
                eager={false}
                onOpen={() => onOpenClip(clip)}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}
