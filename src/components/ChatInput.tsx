import { useState, useRef, useEffect, useCallback } from 'preact/hooks'
import type { Provider, FileAttachment, ImageAttachment, Chat } from '../types'
import { getDraft, saveDraft, removeDraft } from '../utils/draftStore'
import { extractFileText, extractImageUrl, isImageFile } from '../utils/fileParser'
import { detectArchiveFormat } from '../utils/archiveParser'
import { extractImageText } from '../utils/ocr'
import { UnarchiveDialog } from './UnarchiveDialog'
import { getAutocompleteSuggestions } from '../utils/autocomplete'
import type { AutocompleteSuggestion } from '../utils/autocomplete'
import { startListening, stopListening, getState, onStateChange, onResult, isSupported } from '../utils/stt'
import { addToast } from '../utils/toastStore'

interface ChatInputProps {
  chatId?: string
  onSend: (payload: { content: string; fileAttach?: FileAttachment; imageAttach?: ImageAttachment }) => void
  onStop: () => void
  streaming: boolean
  disabled?: boolean
  editing?: { messageId: string; initialContent: string } | null
  onCancelEdit?: () => void
  onSubmitEdit?: (content: string) => void
  replying?: { preview: string } | null
  onCancelReply?: () => void
  ocrLanguage?: string
  sttLanguage?: string
  providers?: Provider[]
  activeProviderId?: string | null
  currentModel?: string
  onSwitchProvider?: (id: string) => void
  onSwitchModel?: (model: string) => void
  chats?: Chat[]
}

interface PendingFile {
  id: string
  name: string
  size: number
  status: 'loading' | 'ready' | 'error'
  progress: number // 0–100
  /** FileAttachment for text files, null for images that become ImageAttachment */
  fileAttach?: FileAttachment
  imageAttach?: ImageAttachment
  ocrStatus?: 'idle' | 'loading' | 'done' | 'error'
  ocrText?: string
}

let pendingIdCounter = 0
function nextPendingId(): string {
  return `pf_${++pendingIdCounter}_${Date.now()}`
}

export function ChatInput({
  chatId,
  onSend,
  onStop,
  streaming,
  disabled,
  editing,
  onCancelEdit,
  onSubmitEdit,
  replying,
  onCancelReply,
  ocrLanguage,
  sttLanguage,
  providers,
  activeProviderId,
  currentModel,
  onSwitchProvider,
  onSwitchModel,
  chats,
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const [modelOpen, setModelOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [archiveFile, setArchiveFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [suggestionIndex, setSuggestionIndex] = useState(-1)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [sttState, setSttState] = useState<'idle' | 'listening' | 'error'>('idle')
  const editorRef = useRef<HTMLDivElement>(null)
  const prevChatIdRef = useRef<string | undefined>(undefined)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevEditingIdRef = useRef<string | null>(null)

  // ── Speech-to-Text ────────────────────────────────
  const sttSupported = isSupported()

  useEffect(() => {
    const unsubState = onStateChange(() => {
      setSttState(getState())
    })
    const unsubResult = onResult((result) => {
      // Append final text to editor content
      if (result.isFinal) {
        const el = editorRef.current
        if (el) {
          const current = el.textContent ?? ''
          const separator = current && !current.endsWith(' ') ? ' ' : ''
          el.textContent = current + separator + result.text
          syncInput()
          // Move cursor to end
          const range = document.createRange()
          const sel = window.getSelection()
          range.selectNodeContents(el)
          range.collapse(false)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }
    })
    return () => { unsubState(); unsubResult() }
  }, [])

  const handleVoiceInput = () => {
    if (sttState === 'listening' || sttState === 'error') {
      stopListening()
    } else {
      startListening(sttLanguage)
    }
  }

  // Show toast on STT error
  useEffect(() => {
    if (sttState === 'error') {
      addToast('Voice input failed: microphone unavailable or permission denied', 'error')
    }
  }, [sttState])

  // Cleanup STT on unmount
  useEffect(() => {
    return () => { stopListening() }
  }, [])

  // ── Draft auto-save ────────────────────────────────
  // Save draft when input changes (debounced)
  useEffect(() => {
    if (!chatId || editing) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      saveDraft(chatId, input)
    }, 800)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [input, chatId, editing])

  // Load draft when chatId changes
  useEffect(() => {
    if (!chatId) return
    const prevId = prevChatIdRef.current
    prevChatIdRef.current = chatId

    // Save previous draft before switching
    if (prevId && prevId !== chatId && input.trim()) {
      saveDraft(prevId, input)
    }

    // Load draft for new chat
    getDraft(chatId).then((draft) => {
      if (draft && !editing) {
        setEditorContent(draft)
      } else if (!draft && !editing) {
        clearEditor()
      }
    })
  }, [chatId])



  // Close model selector on outside click
  useEffect(() => {
    if (!modelOpen) return
    const handleClick = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [modelOpen])

  const updateSuggestions = (text: string) => {
    if (text.trim().length >= 2 && !editing && chats && chats.length > 0) {
      const results = getAutocompleteSuggestions(chats, text)
      setSuggestions(results)
      setSuggestionsOpen(results.length > 0)
      setSuggestionIndex(-1)
    } else {
      setSuggestionsOpen(false)
      setSuggestions([])
      setSuggestionIndex(-1)
    }
  }

  const syncInput = () => {
    const el = editorRef.current
    if (!el) return
    const text = el.textContent ?? ''
    setInput(text)
    el.classList.toggle('chat-input__editor--empty', text.length === 0)
    updateSuggestions(text)
  }

  const setEditorContent = (text: string) => {
    const el = editorRef.current
    if (!el) return
    el.textContent = text
    el.classList.toggle('chat-input__editor--empty', !text)
    setInput(text)
  }

  const clearEditor = () => setEditorContent('')

  // Handle editing population
  useEffect(() => {
    const currentId = editing?.messageId ?? null
    if (currentId && currentId !== prevEditingIdRef.current) {
      setEditorContent(editing!.initialContent)
      const el = editorRef.current
      if (el) {
        el.focus()
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(el)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
    if (!currentId && prevEditingIdRef.current) {
      clearEditor()
    }
    prevEditingIdRef.current = currentId
  }, [editing?.messageId])

  useEffect(() => {
    if (!streaming && !editing && editorRef.current) {
      editorRef.current.focus()
    }
  }, [streaming, editing])

  // ── Process files (from input change or drag & drop) ──────────

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    for (const file of files) {
      const fmt = detectArchiveFormat(file.name)
      if (fmt) {
        // Archive — only handle first archive in the selection
        if (!archiveFile) setArchiveFile(file)
        continue
      }

      const id = nextPendingId()
      const pending: PendingFile = {
        id,
        name: file.name,
        size: file.size,
        status: 'loading',
        progress: 0,
      }
      setPendingFiles((prev) => [...prev, pending])

      if (isImageFile(file.name)) {
        // Simulate progress for images
        const progressTimer = setInterval(() => {
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.id === id && p.status === 'loading'
                ? { ...p, progress: Math.min(p.progress + 10, 85) }
                : p,
            ),
          )
        }, 100)

        extractImageUrl(file)
          .then(({ dataUrl, mimeType }) => {
            clearInterval(progressTimer)
            setPendingFiles((prev) =>
              prev.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      status: 'ready' as const,
                      progress: 100,
                      imageAttach: { name: file.name, dataUrl, mimeType, size: file.size },
                    }
                  : p,
              ),
            )

            // ── Run OCR in parallel ────────────────
            setPendingFiles((prev) =>
              prev.map((p) =>
                p.id === id ? { ...p, ocrStatus: 'loading' as const } : p,
              ),
            )

            extractImageText(dataUrl, ocrLanguage).then((text) => {
              setPendingFiles((prev) =>
                prev.map((p) =>
                  p.id === id
                    ? { ...p, ocrStatus: text ? 'done' as const : 'error' as const, ocrText: text }
                    : p,
                ),
              )
            })
          })
          .catch(() => {
            clearInterval(progressTimer)
            // Fallback: read as text
            extractFileText(file).then((content) => {
              setPendingFiles((prev) =>
                prev.map((p) =>
                  p.id === id
                    ? { ...p, status: 'ready' as const, progress: 100, fileAttach: { name: file.name, content, size: file.size } }
                    : p,
                ),
              )
            })
          })
      } else {
        // Regular file — simulate progress during extraction
        const progressTimer = setInterval(() => {
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.id === id && p.status === 'loading'
                ? { ...p, progress: Math.min(p.progress + 8, 80) }
                : p,
            ),
          )
        }, 150)

        extractFileText(file)
          .then((content) => {
            clearInterval(progressTimer)
            setPendingFiles((prev) =>
              prev.map((p) =>
                p.id === id
                  ? { ...p, status: 'ready' as const, progress: 100, fileAttach: { name: file.name, content, size: file.size } }
                  : p,
              ),
            )
          })
          .catch(() => {
            clearInterval(progressTimer)
            setPendingFiles((prev) =>
              prev.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      status: 'ready' as const,
                      progress: 100,
                      fileAttach: { name: file.name, content: '[Error: Could not read file]', size: file.size },
                    }
                  : p,
              ),
            )
          })
      }
    }
  }, [archiveFile])

  // ── File input handler ───────────────────────────

  const handleFileSelect = () => fileInputRef.current?.click()

  const handleFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      processFiles(input.files)
    }
    input.value = ''
  }

  // ── Drag & Drop handlers ─────────────────────────

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!editing && !streaming) setDragOver(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (editing || streaming || disabled) return
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }

  // ── Handle archive selection ─────────────────────

  const handleArchiveSelect = (entries: { name: string; content: string }[]) => {
    const id = nextPendingId()
    const parts = entries.map((e) => `[${e.name}]\n---\n${e.content}\n---`)
    const combined: FileAttachment = {
      name: `${entries.length} file${entries.length > 1 ? 's' : ''} from archive`,
      content: parts.join('\n\n'),
      size: entries.reduce((sum, e) => sum + e.content.length, 0),
    }
    setPendingFiles((prev) => [
      ...prev,
      { id, name: combined.name, size: combined.size, status: 'ready', progress: 100, fileAttach: combined },
    ])
  }

  // ── Remove pending file ──────────────────────────

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((pf) => pf.id !== id))
  }

  // ── Submit ───────────────────────────────────────

  const hasReadyContent = pendingFiles.some((pf) => pf.status === 'ready') || input.trim().length > 0

  const handleSubmit = () => {
    const trimmed = input.trim()
    const readyFiles = pendingFiles.filter((pf) => pf.status === 'ready')

    // Allow sending with files even without text, or text without files
    if ((!trimmed && readyFiles.length === 0) || streaming || disabled) return

    if (editing && onSubmitEdit) {
      onSubmitEdit(trimmed)
    } else {
      // Combine all ready file attachments into one (for API backward compat)
      const textFiles = readyFiles.filter((pf) => pf.fileAttach)
      const images = readyFiles.filter((pf) => pf.imageAttach)
      const lastImage = images[images.length - 1]

      // Build message content: user text + OCR text from images
      let finalContent = trimmed

      // Append OCR text from images
      const ocrTexts = readyFiles
        .filter((pf) => pf.ocrStatus === 'done' && pf.ocrText)
        .map((pf) => `[OCR from ${pf.name}]\n${pf.ocrText}`)
      if (ocrTexts.length > 0) {
        finalContent += '\n\n' + ocrTexts.join('\n\n')
      }

      let combinedFileAttach: FileAttachment | undefined
      if (textFiles.length > 0) {
        const parts = textFiles.map((pf) => `[${pf.fileAttach!.name}]\n---\n${pf.fileAttach!.content}\n---`)
        combinedFileAttach = {
          name: textFiles.length === 1 ? textFiles[0].fileAttach!.name : `${textFiles.length} files`,
          content: parts.join('\n\n'),
          size: textFiles.reduce((sum, pf) => sum + (pf.fileAttach?.size ?? 0), 0),
        }
      }

      onSend({
        content: finalContent,
        fileAttach: combinedFileAttach,
        imageAttach: lastImage?.imageAttach,
      })
    }

    if (chatId) removeDraft(chatId)
    clearEditor()
    setPendingFiles([])
    editorRef.current?.focus()
  }

  const selectSuggestion = (index: number) => {
    const sug = suggestions[index]
    if (!sug) return
    setEditorContent(sug.text)
    setSuggestionsOpen(false)
    setSuggestions([])
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (suggestionsOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
        return
      }
      if (e.key === 'Enter' && suggestionIndex >= 0) {
        e.preventDefault()
        selectSuggestion(suggestionIndex)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSuggestionsOpen(false)
        setSuggestions([])
        return
      }
      if (e.key === 'Tab' && suggestionIndex >= 0) {
        e.preventDefault()
        selectSuggestion(suggestionIndex)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      if (editing && onCancelEdit) onCancelEdit()
      editorRef.current?.blur()
    }
  }

  // Strip HTML on paste
  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') ?? ''
    const el = editorRef.current
    if (!el) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) {
      el.textContent = (el.textContent ?? '') + text
    } else {
      const range = sel.getRangeAt(0)
      if (!el.contains(range.commonAncestorContainer)) {
        el.textContent = (el.textContent ?? '') + text
      } else {
        range.deleteContents()
        range.insertNode(document.createTextNode(text))
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
    syncInput()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const isLoadingAny = pendingFiles.some((pf) => pf.status === 'loading')

  return (
    <div
      class={`chat-input${dragOver ? ' chat-input--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div class="chat-input__drop-overlay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Drop files here</span>
        </div>
      )}

      {replying && !editing && (
        <div class="chat-input__reply-bar">
          <span class="chat-input__reply-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <polyline points="21 15 15 9 21 3" />
              <path d="M3 21v-2a4 4 0 0 1 4-4h8" />
            </svg>
            Replying to: {replying.preview}
          </span>
          <button class="btn btn--ghost btn--small" onClick={onCancelReply}>Cancel</button>
        </div>
      )}
      {editing && (
        <div class="chat-input__edit-bar">
          <span class="chat-input__edit-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            Editing message
          </span>
          <button class="btn btn--ghost btn--small" onClick={() => { onCancelEdit?.(); clearEditor() }}>Cancel</button>
        </div>
      )}

      {/* Pending files bar — multiple chips */}
      {pendingFiles.length > 0 && !editing && (
        <div class="chat-input__files-bar">
          {pendingFiles.map((pf) => (
            <div key={pf.id} class={`chat-input__file-chip ${pf.status === 'loading' ? 'chat-input__file-chip--loading' : ''}`}>
              {pf.imageAttach ? (
                <>
                  <img class="chat-input__image-thumb" src={pf.imageAttach.dataUrl} alt={pf.name} />
                  <div class="chat-input__image-info">
                    <span class="chat-input__file-name">{pf.name}</span>
                    <span class="chat-input__file-size">{formatSize(pf.size)}</span>
                    {pf.ocrStatus === 'loading' && (
                      <span class="chat-input__ocr-status chat-input__ocr-status--loading">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        OCR…
                      </span>
                    )}
                    {pf.ocrStatus === 'done' && (
                      <span class="chat-input__ocr-status chat-input__ocr-status--done" title={pf.ocrText?.slice(0, 100)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        OCR
                      </span>
                    )}
                    {pf.ocrStatus === 'error' && (
                      <span class="chat-input__ocr-status chat-input__ocr-status--error">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        OCR
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  <span class="chat-input__file-name">{pf.name}</span>
                  <span class="chat-input__file-size">{formatSize(pf.size)}</span>
                </>
              )}
              {pf.status === 'loading' && (
                <div class="chat-input__file-progress">
                  <div class="chat-input__file-progress-fill" style={{ width: `${pf.progress}%` }} />
                </div>
              )}
              {pf.status === 'ready' && (
                <button class="chat-input__file-remove" onClick={() => removeFile(pf.id)} title="Remove">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {isLoadingAny && (
            <span class="chat-input__files-hint">Loading files...</span>
          )}
        </div>
      )}

      <div class={`chat-input__container ${editing ? 'chat-input__container--editing' : replying ? 'chat-input__container--replying' : ''}`}>
        <div class="chat-input__editor-wrap">
          <div
            ref={editorRef}
            class="chat-input__editor chat-input__editor--empty"
            contentEditable={!disabled}
            role="textbox"
            aria-multiline="true"
            data-placeholder={editing ? 'Edit your message...' : 'Type a message...'}
            onInput={syncInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => { if (input.trim().length >= 2) updateSuggestions(input) }}
            onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
          />

          {/* Autocomplete dropdown */}
          {suggestionsOpen && suggestions.length > 0 && (
            <div class="autocomplete-dropdown">
              {suggestions.map((s, i) => (
                <button
                  key={`${s.sourceChatId}-${i}`}
                  class={`autocomplete-item ${i === suggestionIndex ? 'autocomplete-item--active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(i) }}
                  onMouseEnter={() => setSuggestionIndex(i)}
                  role="option"
                  aria-selected={i === suggestionIndex}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="autocomplete-item__icon">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <span class="autocomplete-item__text">{s.text}</span>
                  <span class="autocomplete-item__source">{s.source}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div class="chat-input__actions">
          {!editing && !streaming && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.json,.csv,.xml,.yaml,.yml,.log,.ini,.cfg,.env,.docx,.pdf,.odt,.pptx,.xlsx,.epub,.rtf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.zip,.tar,.tar.gz,.tgz,.gz,.7z,.rar,.py,.js,.ts,.jsx,.tsx,.rs,.go,.java,.cpp,.c,.h,.hpp,.rb,.php,.sh,.bash,.zsh,.sql,.r,.lua,.dart,.swift,.kt,.scala,.html,.css,.scss,.less,.sass,.ipynb,.toml,.conf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button
                class="chat-input__attach-btn"
                onClick={handleFileSelect}
                title="Attach file"
                disabled={disabled}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              {sttSupported && (
                <button
                  class={`chat-input__voice-btn ${sttState === 'listening' ? 'chat-input__voice-btn--recording' : ''}`}
                  onClick={handleVoiceInput}
                  title={sttState === 'listening' ? 'Stop recording' : 'Voice input'}
                >
                  {sttState === 'listening' ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                      <span class="chat-input__voice-dot" />
                    </>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
              )}
            </>
          )}
          {streaming ? (
            <button class="btn btn--stop" onClick={onStop} title="Stop generating">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              class="btn btn--send"
              onClick={handleSubmit}
              disabled={!hasReadyContent || disabled}
              title={editing ? 'Save edit' : 'Send message'}
            >
              {editing ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Unarchive dialog */}
      {archiveFile && (
        <UnarchiveDialog
          file={archiveFile}
          onSelect={handleArchiveSelect}
          onClose={() => setArchiveFile(null)}
        />
      )}

      {/* Model selector */}
      {providers && providers.length > 0 && !editing && (
        <div class="chat-input__model-bar" ref={modelRef}>
          <button class="chat-input__model-btn" onClick={() => setModelOpen(!modelOpen)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <circle cx="12" cy="12" r="3" />
            </svg>
            {activeProviderId && providers.find((p) => p.id === activeProviderId)
              ? `${providers.find((p) => p.id === activeProviderId)!.name} / ${currentModel ?? '?'}`
              : currentModel ?? 'Select model'}
            <svg class="chat-input__model-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {modelOpen && (
            <div class="chat-input__model-dropdown">
              {providers.map((p) => (
                <div key={p.id} class="chat-input__model-group">
                  <div
                    class={`chat-input__model-provider ${p.id === activeProviderId ? 'chat-input__model-provider--active' : ''}`}
                    onClick={() => { onSwitchProvider?.(p.id); setModelOpen(false) }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <circle cx="12" cy="12" r="10" />
                      {p.id === activeProviderId && <circle cx="12" cy="12" r="3" fill="currentColor" />}
                    </svg>
                    <span class="chat-input__model-provider-name">{p.name}</span>
                    <span class="chat-input__model-name">{p.activeModel}</span>
                    <span class="chat-input__model-endpoint">{p.apiEndpoint.replace(/^https?:\/\//, '').replace(/\/v1$/, '')}</span>
                  </div>
                  {p.id === activeProviderId && (
                    <div class="chat-input__model-input-wrap">
                      <input
                        class="chat-input__model-input"
                        type="text"
                        value={currentModel ?? p.activeModel}
                        onInput={(e) => onSwitchModel?.((e.target as HTMLInputElement).value)}
                        placeholder="Model name..."
                        spellcheck={false}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
