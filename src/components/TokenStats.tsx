import type { TokenStats } from '../types'

interface Props {
  stats: TokenStats
  onClose: () => void
}

export function TokenStatsDialog({ stats, onClose }: Props) {
  const { session, total } = stats

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog" onClick={(e) => e.stopPropagation()}>
        <div class="dialog__header">
          <h2 class="dialog__title">Token Statistics</h2>
          <button class="btn btn--ghost btn--icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="dialog__body">
          {/* Session stats */}
          <div class="token-stats__section">
            <h3 class="token-stats__section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              This Session
            </h3>
            <div class="token-stats__grid">
              <div class="token-stats__card">
                <span class="token-stats__label">Prompt</span>
                <span class="token-stats__value">{session.promptTokens.toLocaleString()}</span>
              </div>
              <div class="token-stats__card">
                <span class="token-stats__label">Completion</span>
                <span class="token-stats__value">{session.completionTokens.toLocaleString()}</span>
              </div>
              <div class="token-stats__card">
                <span class="token-stats__label">Total</span>
                <span class="token-stats__value token-stats__value--total">{session.totalTokens.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Total stats */}
          <div class="token-stats__section">
            <h3 class="token-stats__section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
              </svg>
              All Time
            </h3>
            <div class="token-stats__grid">
              <div class="token-stats__card">
                <span class="token-stats__label">Prompt</span>
                <span class="token-stats__value">{total.promptTokens.toLocaleString()}</span>
              </div>
              <div class="token-stats__card">
                <span class="token-stats__label">Completion</span>
                <span class="token-stats__value">{total.completionTokens.toLocaleString()}</span>
              </div>
              <div class="token-stats__card">
                <span class="token-stats__label">Total</span>
                <span class="token-stats__value token-stats__value--total">{total.totalTokens.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {stats.lastUpdated > 0 && (
            <p class="token-stats__updated">
              Last updated: {new Date(stats.lastUpdated).toLocaleString()}
            </p>
          )}

          <p class="token-stats__note">
            Token counts are provided by the API when available (OpenRouter, OpenAI).
            For other providers, tokens are estimated based on text length.
            Session stats reset each time you open the app.
          </p>
        </div>
        <div class="dialog__footer">
          <button class="btn btn--primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
