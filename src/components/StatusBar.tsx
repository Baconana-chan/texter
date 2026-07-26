import type { AppMode } from '../types'

interface StatusBarProps {
  mode: AppMode
  chatCount: number
  incognito: boolean
  saved: boolean
  onOpenSidebar: () => void
}

export function StatusBar({ mode, chatCount, incognito, saved, onOpenSidebar }: StatusBarProps) {
  return (
    <footer class="status-bar">
      <div class="status-bar__group">
        {/* Mode badge */}
        <span class={`status-bar__badge ${mode === 'projects' ? 'status-bar__badge--projects' : ''}`}>
          {mode === 'chat' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          )}
          {mode === 'chat' ? 'Chat' : 'Projects'}
        </span>

        {/* Chat count */}
        {mode === 'chat' && (
          <span class="status-bar__stat" title="Total chats">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {chatCount} chat{chatCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div class="status-bar__group status-bar__group--center">
        {/* Auto-save status */}
        <span class="status-bar__stat" title={incognito ? 'Incognito — chats are not saved automatically' : saved ? 'All changes saved' : 'Unsaved changes'}>
          <span class={`status-bar__dot ${incognito ? 'status-bar__dot--warn' : saved ? 'status-bar__dot--ok' : 'status-bar__dot--pending'}`} />
          {incognito ? 'Incognito' : saved ? 'Saved' : 'Saving...'}
        </span>
      </div>

      <div class="status-bar__group status-bar__group--right">
        {/* Keyboard shortcuts hint */}
        <span class="status-bar__shortcuts">
          <kbd class="status-bar__kbd">Ctrl+N</kbd> New
          <kbd class="status-bar__kbd">Ctrl+S</kbd> Save
        </span>

        {/* Sidebar toggle */}
        <button class="status-bar__toggle" onClick={onOpenSidebar} title="Open sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
    </footer>
  )
}
