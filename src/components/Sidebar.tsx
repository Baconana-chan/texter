import { useState, useEffect, useRef } from 'preact/hooks'
import type { Chat, AppMode, Message } from '../types'
import { Tooltip } from './Tooltip'

interface FavoriteEntry {
  chat: Chat
  message: Message
}

interface SidebarProps {
  mode: AppMode
  chats: Chat[]
  activeChatId: string | null
  favorites: FavoriteEntry[]
  incognito?: boolean
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string) => void
  onReorderChats?: (fromIndex: number, toIndex: number) => void
  onOpenSettings: () => void
  onOpenStats: () => void
  onOpenClipboard?: () => void
  onPlugins?: () => void
  onImageGenerator?: () => void
  onImportChats: () => void
  onExportChats: () => void
  onSwitchMode: (mode: AppMode) => void
  onClose: () => void
}

export function Sidebar({
  mode,
  chats,
  activeChatId,
  favorites,
  incognito,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onOpenSettings,
  onOpenStats,
  onOpenClipboard,
  onPlugins,
  onImageGenerator,
  onImportChats,
  onExportChats,
  onSwitchMode,
  onClose,
  onReorderChats,
}: SidebarProps) {
  const [search, setSearch] = useState('')
  const [showFavorites, setShowFavorites] = useState(false)

  // Sort chats by last activity (newest first)
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)

  const filtered = search.trim()
    ? sorted.filter((c) => {
        const q = search.toLowerCase()
        if (c.title.toLowerCase().includes(q)) return true
        return c.messages.some((m) => m.content.toLowerCase().includes(q))
      })
    : sorted

  return (
    <aside class="sidebar">
      <div class="sidebar__header">
        <h1 class="sidebar__title">Texter</h1>
        <button class="btn btn--ghost btn--icon" onClick={onClose} title="Close sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Mode switch */}
      <div class="sidebar__mode-switch">
        <button
          class={`sidebar__mode-btn ${mode === 'chat' ? 'sidebar__mode-btn--active' : ''}`}
          onClick={() => onSwitchMode('chat')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </button>
        <button
          class={`sidebar__mode-btn ${mode === 'projects' ? 'sidebar__mode-btn--active' : ''}`}
          onClick={() => onSwitchMode('projects')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Projects
        </button>
      </div>

      {mode === 'chat' && chats.length > 0 && (
        <div class="sidebar__search">
          <svg class="sidebar__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            class="sidebar__search-input"
            type="text"
            placeholder="Search chats..."
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
          {search && (
            <button class="sidebar__search-clear btn btn--ghost btn--icon btn--small" onClick={() => setSearch('')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Incognito banner */}
      {incognito && (
        <div class="sidebar__incognito">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
          </svg>
          Incognito — chats won't be saved
        </div>
      )}

      {/* Favorites toggle */}
      {mode === 'chat' && favorites.length > 0 && (
        <button class={`sidebar__fav-toggle ${showFavorites ? 'sidebar__fav-toggle--open' : ''}`} onClick={() => setShowFavorites(!showFavorites)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Favorites
          <span class="sidebar__fav-count">{favorites.length}</span>
          <svg class="sidebar__fav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Favorites list */}
      {mode === 'chat' && showFavorites && favorites.length > 0 && (
        <div class="sidebar__fav-list">
          {favorites.map((fav) => (
            <div
              key={`${fav.chat.id}-${fav.message.id}`}
              class="sidebar__fav-item"
              onClick={() => { onSelectChat(fav.chat.id); setShowFavorites(false) }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" width="12" height="12" class="sidebar__fav-star">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <div class="sidebar__fav-preview">
                <span class="sidebar__fav-author">{fav.message.role === 'user' ? 'You' : 'Assistant'}</span>
                <span class="sidebar__fav-text">{fav.message.content.slice(0, 60).trim()}</span>
              </div>
              <span class="sidebar__fav-chat-title">{fav.chat.title}</span>
            </div>
          ))}
        </div>
      )}

      {mode === 'chat' && (
        <>
          <button class="btn btn--new-chat" onClick={onNewChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>

          <div class="sidebar__chats">
            {filtered.length === 0 && (
              <div class="sidebar__empty">
                <p>{search ? 'No matching chats' : 'No conversations yet'}</p>
              </div>
            )}
            {filtered.map((chat, idx) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                index={idx}
                total={filtered.length}
                active={chat.id === activeChatId}
                onSelect={onSelectChat}
                onDelete={onDeleteChat}
                onMoveUp={(i) => onReorderChats?.(i, i - 1)}
                onMoveDown={(i) => onReorderChats?.(i, i + 1)}
              />
            ))}
          </div>
        </>
      )}

      <div class="sidebar__footer">
        <SidebarMoreButton
          onImport={onImportChats}
          onExport={onExportChats}
          onStats={onOpenStats}
          onClipboard={onOpenClipboard}
          onPlugins={onPlugins}
          onImageGenerator={onImageGenerator}
          onSettings={onOpenSettings}
        />
      </div>
    </aside>
  )
}

/** Format a timestamp as a relative time string (e.g. "2 min ago", "Yesterday", "Jun 15") */
// ── Collapsible More button ───────────────────────

function SidebarMoreButton({ onImport, onExport, onStats, onClipboard, onPlugins, onImageGenerator, onSettings }: {
  onImport: () => void
  onExport: () => void
  onStats: () => void
  onClipboard?: () => void
  onPlugins?: () => void
  onImageGenerator?: () => void
  onSettings: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div class="sidebar__more-wrap" ref={ref}>
      <button class="btn btn--ghost sidebar__more-btn" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
        More
        <svg class={`sidebar__more-chevron ${open ? 'sidebar__more-chevron--open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div class="sidebar__more-dropdown">
          <button class="sidebar__more-item" onClick={() => { onImport(); setOpen(false) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Import
          </button>
          <button class="sidebar__more-item" onClick={() => { onExport(); setOpen(false) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Export
          </button>
          <div class="sidebar__more-divider" />
          <button class="sidebar__more-item" onClick={() => { onStats(); setOpen(false) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
            </svg>
            Stats
          </button>
          <button class="sidebar__more-item" onClick={() => { onClipboard?.(); setOpen(false) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Clipboard
          </button>
          <button class="sidebar__more-item" onClick={() => { onPlugins?.(); setOpen(false) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Plugins
          </button>
          <button class="sidebar__more-item" onClick={() => { onImageGenerator?.(); setOpen(false) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Image Gen
          </button>
          <div class="sidebar__more-divider" />
          <button class="sidebar__more-item" onClick={() => { onSettings(); setOpen(false) }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts

  // Less than a minute
  if (diff < 60_000) return 'Just now'
  // Less than an hour
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000)
    return `${mins} min ago`
  }
  // Less than 24 hours
  if (diff < 86_400_000) {
    const hrs = Math.floor(diff / 3_600_000)
    return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
  }
  // Yesterday
  const date = new Date(ts)
  const today = new Date(now)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  if (date.toDateString() === today.toDateString()) return 'Today'

  // Within the last week
  const oneWeek = 7 * 86_400_000
  if (diff < oneWeek) {
    const days = Math.floor(diff / 86_400_000)
    return `${days} days ago`
  }

  // This year
  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // Previous year
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Chat item with move up/down buttons (replaces HTML5 DnD which Tauri WebView blocks) ──

interface ChatItemProps {
  chat: Chat
  index: number
  total: number
  active: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onMoveUp?: (index: number) => void
  onMoveDown?: (index: number) => void
}

function ChatItem({ chat, index, total, active, onSelect, onDelete, onMoveUp, onMoveDown }: ChatItemProps) {
  return (
    <div
      class={`sidebar__chat ${active ? 'sidebar__chat--active' : ''}`}
      onClick={() => onSelect(chat.id)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <div class="sidebar__chat-info">
        <span class="sidebar__chat-title">{chat.title}</span>
        <span class="sidebar__chat-date">{formatRelativeTime(chat.updatedAt)}</span>
      </div>
      <div class="sidebar__chat-actions">
        <Tooltip label="Move up">
        <button
          class="btn btn--ghost btn--icon btn--small sidebar__chat-move"
          onClick={(e) => { e.stopPropagation(); onMoveUp?.(index) }}
          disabled={index === 0}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        </Tooltip>
        <Tooltip label="Move down">
        <button
          class="btn btn--ghost btn--icon btn--small sidebar__chat-move"
          onClick={(e) => { e.stopPropagation(); onMoveDown?.(index) }}
          disabled={index === total - 1}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        </Tooltip>
        <Tooltip label="Delete chat">
        <button
          class="btn btn--ghost btn--icon btn--small"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(chat.id)
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        </Tooltip>
      </div>
    </div>
  )
}
