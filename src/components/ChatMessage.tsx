import { useState, useEffect } from 'preact/hooks'
import type { Message } from '../types'
import { renderMarkdown } from '../utils/markdown'
import { addClipboardItem, copyToSystem } from '../utils/clipboardStore'
import { togglePlay, subscribe, getState, isSpeakingText } from '../utils/tts'
import { Tooltip } from './Tooltip'

interface ChatMessageProps {
  message: Message
  chatId?: string
  messages?: Message[]
  chatTitle?: string
  onEdit?: (messageId: string, content: string) => void
  onCycleVersion?: (chatId: string, messageId: string, direction: 'prev' | 'next') => void
  onRegenerate?: (chatId: string, messageId: string) => void
  onReply?: (messageId: string, chatId: string, preview: string) => void
  onToggleFavorite?: (chatId: string, messageId: string) => void
  onSuggestionClick?: (text: string) => void
}

export function ChatMessage({ message, chatId, messages, chatTitle, onEdit, onCycleVersion, onRegenerate, onReply, onToggleFavorite, onSuggestionClick }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const edits = message.edits ?? []
  const editIndex = message.editIndex ?? 0
  const totalVersions = edits.length + 1
  const hasEdits = edits.length > 0
  const hasReasoning = !!message.reasoning
  const hasReply = !!message.replyTo
  const hasFile = !!message.fileAttach
  const hasImage = !!message.imageAttach

  // Find the replied-to message
  const repliedMsg = hasReply && messages ? messages.find((m) => m.id === message.replyTo) : null

  // Always render markdown when there's content — including during streaming
  const html = message.content
    ? renderMarkdown(message.content)
    : ''

  return (
    <div class={`message ${isUser ? 'message--user' : 'message--assistant'}`}>
      <div class="message__avatar">
        {isUser ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
            <path d="M2 20a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v2H2v-2z" />
          </svg>
        )}
      </div>
      <div class="message__content">
        <div class="message__header">
          {message.loading && !message.content && !message.reasoning ? (
            <div class="message__typing">
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </div>
          ) : (
            <>
              {/* Reply indicator */}
              {repliedMsg && (
                <div class="message__reply-indicator">
                  <div class="message__reply-line" />
                  <div class="message__reply-preview">
                    <span class="message__reply-author">{repliedMsg.role === 'user' ? 'You' : 'Assistant'}</span>
                    <span class="message__reply-text">{repliedMsg.content.slice(0, 100).trim()}</span>
                  </div>
                </div>
              )}

              {/* Image attachment */}
              {hasImage && !message.loading && (
                <div class="message__image-attach">
                  <img
                    class="message__image-preview"
                    src={message.imageAttach!.dataUrl}
                    alt={message.imageAttach!.name}
                    loading="lazy"
                    onClick={() => window.open(message.imageAttach!.dataUrl, '_blank')}
                  />
                  <div class="message__image-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span class="message__file-name">{message.imageAttach!.name}</span>
                    <span class="message__file-size">{(message.imageAttach!.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              )}

              {/* File attachment indicator */}
              {hasFile && !hasImage && (
                <div class="message__file-attach">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  <span class="message__file-name">{message.fileAttach!.name}</span>
                  <span class="message__file-size">{(message.fileAttach!.size / 1024).toFixed(1)} KB</span>
                </div>
              )}

              {/* Reasoning block (collapsible) */}
              {!isUser && hasReasoning && (
                <ReasoningBlock text={message.reasoning!} />
              )}

              <div
                class="message__text md-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </>
          )}

          {/* Actions row */}
          <div class="message__actions">
            {onReply && !message.loading && chatId && (
              <Tooltip label="Reply">
              <button
                class="message__action-btn"
                onClick={() => onReply(message.id, chatId, message.content)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <polyline points="21 15 15 9 21 3" />
                  <path d="M3 21v-2a4 4 0 0 1 4-4h8" />
                </svg>
              </button>
              </Tooltip>
            )}

            {onToggleFavorite && !message.loading && chatId && (
              <Tooltip label={message.favorited ? 'Unfavorite' : 'Favorite'}>
              <button
                class={`message__action-btn ${message.favorited ? 'message__action-btn--faved' : ''}`}
                onClick={() => onToggleFavorite(chatId, message.id)}
              >
                <svg viewBox="0 0 24 24" fill={message.favorited ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" width="14" height="14">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
              </Tooltip>
            )}

            {onRegenerate && !isUser && !message.loading && !message.error && chatId && (
              <Tooltip label="Regenerate">
              <button
                class="message__action-btn"
                onClick={() => onRegenerate(chatId, message.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
              </Tooltip>
            )}

            {/* TTS button — assistant messages only */}
            {!isUser && !message.loading && !message.error && message.content && (
              <TtsButton text={message.content} />
            )}

            {/* Copy button */}
            {!message.loading && (
              <CopyButton content={message.content} source={chatTitle ?? 'Chat'} />
            )}

            {onEdit && isUser && !message.loading && (
              <Tooltip label="Edit message">
              <button
                class="message__action-btn"
                onClick={() => onEdit(message.id, message.content)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
              </Tooltip>
            )}

            {hasEdits && onCycleVersion && chatId && (
              <div class="message__version-nav">
                <Tooltip label="Older version">
                <button
                  class="message__action-btn"
                  onClick={() => onCycleVersion(chatId, message.id, 'prev')}
                  disabled={editIndex >= edits.length}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                </Tooltip>
                <span class="message__version-indicator">
                  {totalVersions - editIndex}/{totalVersions}
                </span>
                <Tooltip label="Newer version">
                <button
                  class="message__action-btn"
                  onClick={() => onCycleVersion(chatId, message.id, 'next')}
                  disabled={editIndex === 0}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {message.error && (
          <div class="message__error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>Failed to get response</span>
          </div>
        )}

        {/* Suggestion chips — only on assistant messages, non-loading, non-error */}
        {!isUser && !message.loading && !message.error && message.suggestions && message.suggestions.length > 0 && (
          <div class="suggestion-chips">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                class="suggestion-chip"
                style={{ '--i': i } as any}
                onClick={() => onSuggestionClick?.(s)}
                title={s}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Copy button — copies to system clipboard + internal buffer */
function CopyButton({ content, source }: { content: string; source: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyToSystem(content)
    await addClipboardItem(content, source)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (      <Tooltip label={copied ? 'Copied!' : 'Copy'}>
      <button
        class={`message__action-btn ${copied ? 'message__action-btn--copied' : ''}`}
        onClick={handleCopy}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      </Tooltip>
  )
}

/** TTS button — play/pause/stop speech for message text */
function TtsButton({ text }: { text: string }) {
  const [ttsState, setTtsState] = useState(getState())
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const unsub = subscribe(() => {
      const st = getState()
      setTtsState(st)
      setIsActive(st !== 'idle' && isSpeakingText(text))
    })
    return unsub
  }, [text])

  const handleClick = () => togglePlay(text)

  // When another message starts speaking, isActive becomes false for this one
  const isSpeaking = isActive && ttsState === 'speaking'
  const isPaused = isActive && ttsState === 'paused'

  return (
    <Tooltip label={isSpeaking ? 'Pause' : isPaused ? 'Resume' : 'Read aloud'}>
    <button
      class={`message__action-btn ${isSpeaking ? 'message__tts-btn--speaking' : ''} ${isPaused ? 'message__tts-btn--paused' : ''}`}
      onClick={handleClick}
    >
      {isSpeaking ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : isPaused ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
    </Tooltip>
  )
}

/** Collapsible reasoning / chain-of-thought block */
function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const html = renderMarkdown(text)

  return (
    <div class={`reasoning ${open ? 'reasoning--open' : ''}`}>
      <button class="reasoning__toggle" onClick={() => setOpen(!open)}>
        <svg
          class={`reasoning__chevron ${open ? 'reasoning__chevron--open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="14"
          height="14"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span class="reasoning__label">{open ? 'Thought' : 'Thought for a moment'}</span>
        {!open && <span class="reasoning__preview">{text.slice(0, 80).trim()}{text.length > 80 ? '...' : ''}</span>}
      </button>
      {open && (
        <div
          class="reasoning__content md-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}
