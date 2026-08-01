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
  const topRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [isNearTop, setIsNearTop] = useState(true)

  // ── Intersection Observer: detect when user scrolls away from bottom ──
  useEffect(() => {
    const bottomEl = bottomRef.current
    if (!bottomEl) return

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
  }, [messages.length])

  // ── Intersection Observer: detect when user scrolls away from top ──
  useEffect(() => {
    const topEl = topRef.current
    if (!topEl) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === topEl) {
            setIsNearTop(entry.isIntersecting)
          }
        }
      },
      {
        root: containerRef.current,
        rootMargin: '0px 0px 200px 0px',
      },
    )

    observer.observe(topEl)
    return () => observer.disconnect()
  }, [messages.length])

  // ── Auto-scroll to bottom only if user is near bottom ──
  useEffect(() => {
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isNearBottom])

  // ── Scroll handlers ──
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsNearBottom(true)
  }

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setIsNearTop(true)
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
      <div ref={topRef} />

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

      {/* Floating action buttons — bottom-right corner */}
      <div class="scroll-fabs">
        {/* Scroll to top — visible when scrolled down */}
        <button
          class={`scroll-fab ${isNearTop ? 'scroll-fab--hidden' : ''}`}
          onClick={scrollToTop}
          title="Scroll to top"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {/* Scroll to bottom — visible when scrolled up */}
        <button
          class={`scroll-fab ${isNearBottom ? 'scroll-fab--hidden' : ''}`}
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
