import { useState, useEffect } from 'preact/hooks'
import type { ClipboardEntry } from '../utils/clipboardStore'
import { loadClipboard, deleteClipboardItem, clearClipboard, copyToSystem } from '../utils/clipboardStore'

interface ClipboardDialogProps {
  onClose: () => void
}

export function ClipboardDialog({ onClose }: ClipboardDialogProps) {
  const [items, setItems] = useState<ClipboardEntry[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadClipboard().then(setItems)
  }, [])

  const filtered = search.trim()
    ? items.filter((i) => i.content.toLowerCase().includes(search.toLowerCase()))
    : items

  const handleCopy = async (content: string) => {
    await copyToSystem(content)
  }

  const handleDelete = async (id: string) => {
    await deleteClipboardItem(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleClear = async () => {
    await clearClipboard()
    setItems([])
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()

    if (diff < 60_000) return 'Just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog clipboard-dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div class="dialog__header">
          <h2 class="dialog__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Clipboard
          </h2>
          <div class="dialog__header-actions">
            {items.length > 0 && (
              <button class="btn btn--ghost btn--small btn--danger-text" onClick={handleClear} title="Clear all">
                Clear all
              </button>
            )}
            <button class="btn btn--ghost btn--icon" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div class="dialog__body">
          {/* Search */}
          {items.length > 0 && (
            <div class="clipboard__search">
              <svg class="clipboard__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                class="clipboard__search-input"
                type="text"
                placeholder="Search clipboard..."
                value={search}
                onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              />
              {search && (
                <button class="btn btn--ghost btn--icon btn--small" onClick={() => setSearch('')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {items.length === 0 && (
            <div class="clipboard__empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <p>Clipboard is empty</p>
              <span class="form-hint">Use the copy button on any message to save it here.</span>
            </div>
          )}

          {filtered.length === 0 && items.length > 0 && (
            <div class="clipboard__empty">
              <p>No matching entries</p>
            </div>
          )}

          {filtered.map((item) => (
            <div key={item.id} class="clipboard__item">
              <div class="clipboard__item-content">
                <p class="clipboard__item-text">{item.content}</p>
              </div>
              <div class="clipboard__item-footer">
                <span class="clipboard__item-source">{item.source}</span>
                <span class="clipboard__item-time">{formatTime(item.timestamp)}</span>
              </div>
              <div class="clipboard__item-actions">
                <button
                  class="btn btn--ghost btn--small"
                  onClick={() => handleCopy(item.content)}
                  title="Copy to system clipboard"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </button>
                <button
                  class="btn btn--ghost btn--small clipboard__item-delete"
                  onClick={() => handleDelete(item.id)}
                  title="Delete from clipboard"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          {items.length > 0 && (
            <div class="clipboard__footer-note">
              <span class="form-hint">
                {items.length} item{items.length !== 1 ? 's' : ''} saved — persists across restarts
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
