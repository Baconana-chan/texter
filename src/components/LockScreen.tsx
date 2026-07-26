import { useState } from 'preact/hooks'
import { hashPin } from '../utils/store'

interface LockScreenProps {
  onUnlock: () => void
  pinHash: string
}

export function LockScreen({ onUnlock, pinHash }: LockScreenProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!pin.trim()) return
    setLoading(true)
    setError('')

    try {
      const h = await hashPin(pin)
      if (h === pinHash) {
        onUnlock()
      } else {
        setError('Incorrect PIN')
        setPin('')
      }
    } catch {
      setError('Verification error')
    }
    setLoading(false)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape' && pin.length > 0) setPin('')
  }

  return (
    <div class="lockscreen">
      <div class="lockscreen__card">
        <div class="lockscreen__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 class="lockscreen__title">Texter</h1>
        <p class="lockscreen__subtitle">Enter PIN to unlock</p>

        <div class="lockscreen__input-wrap">
          <input
            class={`lockscreen__input ${error ? 'lockscreen__input--error' : ''}`}
            type="password"
            value={pin}
            onInput={(e) => { setError(''); setPin((e.target as HTMLInputElement).value) }}
            onKeyDown={handleKeyDown}
            placeholder="Enter PIN"
            maxLength={10}
            autoFocus
            disabled={loading}
          />
        </div>

        {error && <p class="lockscreen__error">{error}</p>}

        <button
          class="btn btn--primary lockscreen__btn"
          onClick={handleSubmit}
          disabled={!pin.trim() || loading}
        >
          {loading ? 'Verifying...' : 'Unlock'}
        </button>
      </div>
    </div>
  )
}
