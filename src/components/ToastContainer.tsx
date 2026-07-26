import { useState, useEffect } from 'preact/hooks'
import { subscribe, getToasts, dismissToast } from '../utils/toastStore'
import type { Toast } from '../utils/toastStore'

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>(getToasts())

  useEffect(() => {
    const unsub = subscribe(() => {
      setToasts([...getToasts()])
    })
    return unsub
  }, [])

  if (toasts.length === 0) return null

  return (
    <div class="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          class={`toast toast--${t.type}${t.leaving ? ' toast--leaving' : ''}`}
          role="alert"
        >
          <span class="toast__icon">
            {t.type === 'success' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
            {t.type === 'error' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {t.type === 'warning' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {t.type === 'info' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
          </span>
          <span class="toast__message">{t.message}</span>
          <button
            class="toast__close"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
