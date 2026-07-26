import { useEffect, useRef, useState } from 'preact/hooks'
import type { Message } from '../types'
import { ChatMessage } from './ChatMessage'

interface MessageListProps {
  messages: Message[]
  chatId?: string
  chatTitle?: string
  onEdit?: (messageId: string, content: string) => void
  onCycleVersion?: (chatId: string, messageId: string, direction: 'prev' | 'next') => void
  onRegenerate?: (chatId: string, messageId: string) => void
  onReply?: (messageId: string, chatId: string, preview: string) => void
  onToggleFavorite?: (chatId: string, messageId: string) => void
  onSuggestionClick?: (text: string) => void
}

export function MessageList({ messages, chatId, chatTitle, onEdit, onCycleVersion, onRegenerate, onReply, onToggleFavorite, onSuggestionClick }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)

  // ── Intersection Observer: detect when user scrolls away from bottom ──
  useEffect(() => {
    const bottomEl = bottomRef.current
    if (!bottomEl) return

    // Use a generous threshold — "near bottom" means within ~300px of the end
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === bottomEl) {
            setIsNearBottom(entry.isIntersecting)
          }
        }
      },
      {
        root: containerRef.current,
        rootMargin: '200px 0px 0px 0px',
      },
    )

    observer.observe(bottomEl)
    return () => observer.disconnect()
  }, [messages.length]) // re-attach when message count changes (DOM updates)

  // ── Auto-scroll to bottom only if user is near bottom ──
  useEffect(() => {
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isNearBottom])

  // ── Scroll to bottom handler (for the button) ──
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsNearBottom(true)
  }

  if (messages.length === 0) {
    return (
      <div class="message-list message-list--empty">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h2>Start a conversation</h2>
          <p>Send a message to begin chatting with the AI assistant</p>
        </div>
      </div>
    )
  }

  return (
    <div class="message-list" ref={containerRef}>
      {messages.map((msg) => (
        <div key={msg.id} class="message-wrapper">
          <ChatMessage
            message={msg}
            messages={messages}
            chatId={chatId}
            chatTitle={chatTitle}
            onEdit={onEdit}
            onCycleVersion={onCycleVersion}
            onRegenerate={onRegenerate}
            onReply={onReply}
            onToggleFavorite={onToggleFavorite}
            onSuggestionClick={onSuggestionClick}
          />
        </div>
      ))}
      <div ref={bottomRef} />

      {/* Scroll-to-bottom button — visible when user scrolls up */}
      <button
        class={`scroll-bottom-btn ${isNearBottom ? 'scroll-bottom-btn--hidden' : ''}`}
        onClick={scrollToBottom}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <polyline points="6 9 12 15 18 9" />
        </svg>
        Scroll to bottom
      </button>
    </div>
  )
}
