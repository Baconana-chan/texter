import { useState, useCallback, useRef, useEffect } from 'preact/hooks'
import type { Message, Chat, AppSettings, EditingState, ReplyState, Provider, TokenUsage, TokenStats, FileAttachment, ImageAttachment, ContentPart } from '../types'
import { DEFAULT_CHAT_TITLE } from '../types'
import { streamChat } from '../utils/api'
import { loadChats, saveChats, loadSettings, saveSettings } from '../utils/store'
import { runPreProcessors, runPostProcessors } from '../utils/pluginStore'
import { getMigrationReady } from '../utils/migration'
import { loadProviders, saveProviders, loadActiveProviderId, saveActiveProviderId } from '../utils/providerStore'
import { loadTokenStats, saveTokenStats } from '../utils/tokenStore'
import { parseChatboxExport } from '../utils/importChatbox'

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Build system prompt with language instruction + auto features appended */
function buildSystemPrompt(
  basePrompt: string,
  responseLanguage?: string,
  autoTitle?: boolean,
  showSuggestions?: boolean,
  isFirstMessage?: boolean,
): string {
  let prompt = basePrompt

  // Language instruction
  if (responseLanguage && responseLanguage !== 'auto') {
    const langNames: Record<string, string> = {
      en: 'English', ru: 'Russian', de: 'German', fr: 'French',
      es: 'Spanish', it: 'Italian', pt: 'Portuguese', ja: 'Japanese',
      ko: 'Korean', zh: 'Chinese', ar: 'Arabic', nl: 'Dutch',
      pl: 'Polish', sv: 'Swedish', tr: 'Turkish', uk: 'Ukrainian',
      vi: 'Vietnamese', th: 'Thai', hi: 'Hindi',
    }
    const langName = langNames[responseLanguage] ?? responseLanguage
    prompt += `\n\nIMPORTANT: Always respond in ${langName}. Do not use any other language.`
  }

  // Auto-title instruction (only for first message in a new/default-titled chat)
  if (autoTitle && isFirstMessage) {
    prompt += `\n\nIMPORTANT: Since this is a new conversation, suggest a short title for this chat (max 50 chars) at the end of your response in the format [TITLE: suggested title]. Do not use any formatting in the title.`
  }

  // Follow-up suggestions instruction
  if (showSuggestions) {
    prompt += `\n\nIMPORTANT: At the very end of your response, suggest exactly 3 follow-up questions the user might want to ask. Format them as: [SUGGESTIONS: Q1 | Q2 | Q3]. Keep each question under 80 characters. Questions must be separated by " | ".`
  }

  return prompt
}

/** Parse [TITLE: ...] and [SUGGESTIONS: ... | ... | ...] from response, strip from content */
function parseStructuredResponse(content: string): {
  cleanContent: string
  titleSuggestion?: string
  suggestions?: string[]
} {
  let clean = content
  let titleSuggestion: string | undefined
  let suggestions: string[] | undefined

  // Extract [TITLE: ...]
  const titleMatch = clean.match(/\[TITLE:\s*([^\]]+)\]/)
  if (titleMatch) {
    titleSuggestion = titleMatch[1].trim()
    clean = clean.replace(titleMatch[0], '').trim()
  }

  // Extract [SUGGESTIONS: ... | ... | ...]
  const suggMatch = clean.match(/\[SUGGESTIONS:\s*([^\]]+)\]/)
  if (suggMatch) {
    suggestions = suggMatch[1].split('|').map((s) => s.trim()).filter(Boolean)
    clean = clean.replace(suggMatch[0], '').trim()
  }

  return { cleanContent: clean, titleSuggestion, suggestions }
}

/** Build API message content from text + optional image (multimodal) */
function buildMessageContent(text: string, imageAttach?: ImageAttachment): string | ContentPart[] {
  if (!imageAttach) return text
  const parts: ContentPart[] = []
  if (text) parts.push({ type: 'text', text })
  parts.push({ type: 'image_url', image_url: { url: imageAttach.dataUrl } })
  return parts
}

export function useChat() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [providers, setProviders] = useState<Provider[]>([])
  const [activeProviderId, setActiveProviderIdState] = useState<string | null>(null)
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const regenerateMessageRef = useRef<((chatId: string, messageId: string) => Promise<void>) | null>(null)

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null

  // Current active provider
  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? providers[0] ?? null
  const currentProviderType = activeProvider?.type ?? 'openai'
  const currentApiEndpoint = activeProvider?.apiEndpoint ?? settings?.apiEndpoint ?? 'https://api.openai.com/v1'
  const currentApiKey = activeProvider?.apiKey ?? settings?.apiKey ?? ''
  const currentModel = activeChat?.model ?? activeProvider?.activeModel ?? settings?.model ?? 'gpt-4o-mini'

  // ── Token tracking ────────────────────────────────
  const addTokenUsage = useCallback((usage: TokenUsage) => {
    setTokenStats((prev) => {
      if (!prev) return prev
      const next: TokenStats = {
        session: {
          promptTokens: prev.session.promptTokens + usage.promptTokens,
          completionTokens: prev.session.completionTokens + usage.completionTokens,
          totalTokens: prev.session.totalTokens + usage.totalTokens,
        },
        total: {
          promptTokens: prev.total.promptTokens + usage.promptTokens,
          completionTokens: prev.total.completionTokens + usage.completionTokens,
          totalTokens: prev.total.totalTokens + usage.totalTokens,
        },
        lastUpdated: Date.now(),
      }
      saveTokenStats(next)
      return next
    })
  }, [])

  // Load data on mount (waits for migrations to complete first)
  useEffect(() => {
    getMigrationReady().then(() => {
      loadChats().then(setChats)
      loadSettings().then((s) => {
        setSettings(s)
        if (!s.apiKey) setSettingsOpen(true)
      })
      loadProviders().then((p) => {
        if (p.length > 0) {
          setProviders(p)
          loadActiveProviderId().then((id) => {
            if (id && p.some((pr) => pr.id === id)) {
              setActiveProviderIdState(id)
            } else {
              setActiveProviderIdState(p[0].id)
            }
          })
        }
      })
      loadTokenStats().then((s) => {
        // Reset session on app start, keep total
        setTokenStats({ session: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, total: s.total, lastUpdated: s.lastUpdated })
      })
    })
  }, [])

  // ── Provider management ────────────────────────────
  const setActiveProvider = useCallback((id: string) => {
    setActiveProviderIdState(id)
    saveActiveProviderId(id)
  }, [])

  const addProvider = useCallback((p: Provider) => {
    setProviders((prev) => {
      const next = [...prev, p]
      saveProviders(next)
      return next
    })
  }, [])

  const deleteProvider = useCallback((id: string) => {
    setProviders((prev) => {
      const next = prev.filter((p) => p.id !== id)
      saveProviders(next)
      return next
    })
    setActiveProviderIdState((prev) => (prev === id ? null : prev))
  }, [])

  const updateProvider = useCallback((id: string, data: Partial<Provider>) => {
    setProviders((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...data } : p))
      saveProviders(next)
      return next
    })
  }, [])

  const switchProviderModel = useCallback((providerId: string, model: string) => {
    updateProvider(providerId, { activeModel: model })
    // Also update the active chat's model if using this provider
    if (activeChatId && activeProvider?.id === providerId) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId ? { ...c, model } : c,
        ),
      )
    }
  }, [activeChatId, activeProvider])

  // Persist chats on change (debounced) — skip in incognito mode
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (settings?.incognito) return
    if (chats.length === 0) return
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => saveChats(chats), 1500)
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    }
  }, [chats, settings?.incognito])

  const persistSettings = useCallback(async (s: AppSettings) => {
    setSettings(s)
    await saveSettings(s)
  }, [])

  const [activeCharacter, setActiveCharacter] = useState<{ name: string; avatar: string } | null>(null)

  const createChat = useCallback((opts?: { systemPrompt?: string; model?: string; characterName?: string; characterAvatar?: string }) => {
    const chat: Chat = {
      id: generateId(),
      title: DEFAULT_CHAT_TITLE,
      messages: [],
      model: opts?.model ?? settings?.model ?? 'gpt-4o-mini',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      systemPrompt: opts?.systemPrompt,
    }
    setChats((prev) => [chat, ...prev])
    setActiveChatId(chat.id)
    setActiveCharacter(
      opts?.characterName
        ? { name: opts.characterName, avatar: opts.characterAvatar ?? '🎭' }
        : null, // clear character badge when creating a normal chat
    )
    return chat
  }, [settings])

  const deleteChat = useCallback((id: string) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id)
      return next
    })
    setActiveChatId((prev) => {
      if (prev === id) {
        setActiveCharacter(null) // clear character badge when its chat is deleted
        return null
      }
      return prev
    })
  }, [])

  const updateChatTitle = useCallback((id: string, title: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c)),
    )
  }, [])

  const selectChat = useCallback((id: string) => {
    setActiveChatId(id)
    setActiveCharacter(null) // clear any character badge when switching chats
    // Don't close sidebar — user can close manually or via backdrop on mobile
  }, [])

  // ── Chat reordering ────────────────────────────────
  const reorderChats = useCallback((fromIndex: number, toIndex: number) => {
    setChats((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  // ── Editing state ────────────────────────────────
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyState | null>(null)

  const startReplying = useCallback((messageId: string, chatId: string, preview: string) => {
    setEditing(null) // cancel any in-progress edit
    setReplyTo({ messageId, chatId, preview: preview.slice(0, 120) })
  }, [])

  const cancelReplying = useCallback(() => {
    setReplyTo(null)
  }, [])

  const startEditing = useCallback((messageId: string, chatId: string, content: string) => {
    setReplyTo(null) // clear any pending reply
    setEditing({ messageId, chatId, initialContent: content })
  }, [])

  const cancelEditing = useCallback(() => {
    setEditing(null)
  }, [])

  const submitEdit = useCallback(
    (newContent: string) => {
      if (!editing) return

      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== editing.chatId) return c

          return {
            ...c,
            messages: c.messages.map((m) => {
              if (m.id !== editing.messageId) return m

              // If content unchanged, just exit edit mode
              if (m.content === newContent) return m

              // Save current content as edit history
              const edit: { content: string; timestamp: number } = {
                content: m.content,
                timestamp: Date.now(),
              }

              return {
                ...m,
                content: newContent,
                edits: [edit, ...(m.edits ?? [])],
                editIndex: 0,
                timestamp: Date.now(),
              }
            }),
            updatedAt: Date.now(),
          }
        }),
      )

      setEditing(null)

      // Auto-regenerate: find the next assistant message and regenerate it
      const chat = chats.find((c) => c.id === editing.chatId)
      if (chat) {
        const editedIdx = chat.messages.findIndex((m) => m.id === editing.messageId)
        if (editedIdx >= 0) {
          // Find the next assistant message after the edited one
          for (let i = editedIdx + 1; i < chat.messages.length; i++) {
            if (chat.messages[i].role === 'assistant') {
              setTimeout(() => regenerateMessageRef.current?.(editing.chatId, chat.messages[i].id), 50)
              break
            }
          }
        }
      }
    },
    [editing, chats],
  )

  const cycleMessageVersion = useCallback(
    (chatId: string, messageId: string, direction: 'prev' | 'next') => {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== chatId) return c
          return {
            ...c,
            messages: c.messages.map((m) => {
              if (m.id !== messageId) return m
              const edits = m.edits ?? []
              if (edits.length === 0) return m

              const current = m.editIndex ?? 0
              const maxIndex = edits.length
              let nextIndex: number

              if (direction === 'prev') {
                nextIndex = Math.min(current + 1, maxIndex)
              } else {
                nextIndex = Math.max(current - 1, 0)
              }

              if (nextIndex === current) return m

              // Swap content with the version being navigated to
              const editsCopy = [...edits]
              if (nextIndex === 0) {
                // Going to latest: current content goes to edits[0], edits[0].content becomes current
                const oldContent = m.content
                const restoredContent = editsCopy[0].content
                editsCopy[0] = { ...editsCopy[0], content: oldContent }
                return { ...m, content: restoredContent, edits: editsCopy, editIndex: 0 }
              }

              // Going to an older edit
              const targetIdx = nextIndex - 1 // edits array is 0-based from newest
              const oldContent = m.content
              const restoredContent = editsCopy[targetIdx].content
              editsCopy[targetIdx] = { ...editsCopy[targetIdx], content: oldContent }
              return { ...m, content: restoredContent, edits: editsCopy, editIndex: nextIndex }
            }),
            updatedAt: Date.now(),
          }
        }),
      )
    },
    [],
  )

  // ── Regenerate ──────────────────────────────────────
  const regenerateMessage = useCallback(
    async (chatId: string, messageId: string) => {
      if (streamingRef.current) return // guard: don't regenerate while already streaming

      if (!currentApiKey) {
        setSettingsOpen(true)
        return
      }

      // Find the target message and build context BEFORE any state changes
      let oldMsg: Message | undefined
      let contextMessages: Message[] = []

      setChats((prev) => {
        const chat = prev.find((c) => c.id === chatId)
        if (!chat) return prev
        const idx = chat.messages.findIndex((m) => m.id === messageId)
        if (idx < 0) return prev
        const msg = chat.messages[idx]
        if (msg.role !== 'assistant') return prev // safety: only regenerate assistant messages
        oldMsg = msg
        contextMessages = chat.messages.slice(0, idx)
        return prev // read-only pass
      })

      if (!oldMsg) return

      // For regen we don't auto-title (chat already has a title) but still allow suggestions
      const regenSystem = buildSystemPrompt(
        settings?.systemPrompt ?? '',
        settings?.responseLanguage,
        false, // autoTitle: no on regen
        settings?.showSuggestions,
        false, // isFirstMessage: no
      )
      const apiMessages = [
        { role: 'system' as const, content: regenSystem },
        ...contextMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.imageAttach ? buildMessageContent(m.content, m.imageAttach) : m.content,
        })),
      ]

      const newAssistantId = generateId()

      // Replace old assistant message with a fresh loading one, strip everything after
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== chatId) return c
          const msgIndex = c.messages.findIndex((m) => m.id === messageId)
          if (msgIndex < 0) return c

          const updatedMsg: Message = {
            ...oldMsg!,
            content: '',
            loading: true,
            error: false,
            id: newAssistantId,
            edits: [
              { content: oldMsg!.content, timestamp: Date.now() },
              ...(oldMsg!.edits ?? []),
            ],
            editIndex: 0,
          }

          return {
            ...c,
            messages: [...c.messages.slice(0, msgIndex), updatedMsg],
            updatedAt: Date.now(),
          }
        }),
      )

      setStreaming(true)
      const abortController = new AbortController()
      abortRef.current = abortController
      let fullContent = ''
      let fullReasoning = ''

      await streamChat(
        currentProviderType,
        currentApiEndpoint,
        currentApiKey,
        currentModel,
        apiMessages,
        regenSystem,
        abortController.signal,
        {
          onToken: (token: string) => {
            fullContent += token
            setChats((prev) =>
              prev.map((c) =>
                c.id === chatId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === newAssistantId ? { ...m, content: fullContent, reasoning: fullReasoning || undefined } : m,
                      ),
                    }
                  : c,
              ),
            )
          },
          onReasoning: (token: string) => {
            fullReasoning += token
            setChats((prev) =>
              prev.map((c) =>
                c.id === chatId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === newAssistantId ? { ...m, reasoning: fullReasoning } : m,
                      ),
                    }
                  : c,
              ),
            )
          },
          onUsage: (usage) => {
            addTokenUsage(usage)
          },
          onDone: async () => {
            let processedContent = fullContent
            try {
              // ── Run post-processor plugins ──────────────
              const postMessages = (chats.find((c) => c.id === chatId)?.messages ?? []).map((m) => ({ role: m.role, content: m.content }))
              processedContent = await runPostProcessors(fullContent, postMessages)
            } catch {
              processedContent = fullContent // fallback on error
            }

            const { cleanContent, titleSuggestion, suggestions } = parseStructuredResponse(processedContent)
            const finalContent = cleanContent || 'No response'

            setChats((prev) =>
              prev.map((c) =>
                c.id === chatId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === newAssistantId
                          ? {
                              ...m,
                              loading: false,
                              content: finalContent,
                              reasoning: fullReasoning || undefined,
                              titleSuggestion,
                              suggestions,
                            }
                          : m,
                      ),
                    }
                  : c,
              ),
            )
            setStreaming(false)
            abortRef.current = null
          },
          onError: (error: Error) => {
            console.error('Regenerate error:', error)
            setChats((prev) =>
              prev.map((c) =>
                c.id === chatId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === newAssistantId
                          ? { ...m, loading: false, error: true, content: `Error: ${error.message}`, reasoning: fullReasoning || undefined }
                          : m,
                      ),
                    }
                  : c,
              ),
            )
            setStreaming(false)
            abortRef.current = null
          },
        },
        { maxReasoningTokens: settings?.maxReasoningTokens, maxOutputTokens: settings?.maxOutput, temperature: settings?.temperature },
      )
    },
    [settings, currentProviderType, currentApiEndpoint, currentApiKey, currentModel],
  )

  // Sync regenerateMessage ref for use in submitEdit (avoids TDZ issue)
  useEffect(() => {
    regenerateMessageRef.current = regenerateMessage
  }, [regenerateMessage])

  const importChatsFromJson = useCallback((json: unknown) => {
    const imported = parseChatboxExport(json)
    if (imported.length === 0) return 0
    setChats((prev) => {
      const existingIds = new Set(prev.map((c) => c.id))
      const newChats = imported.filter((c) => !existingIds.has(c.id))
      return [...newChats, ...prev]
    })
    return imported.length
  }, [])

  const exportChatsToJson = useCallback(() => {
    const data = JSON.stringify(chats, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `texter-chats-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [chats])

  const streamingRef = useRef(false)
  // sync ref with state
  useEffect(() => { streamingRef.current = streaming }, [streaming])

  // Toggle favorite
  const toggleFavorite = useCallback((chatId: string, messageId: string) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, favorited: !m.favorited } : m,
              ),
            }
          : c,
      ),
    )
  }, [])

  // Collect all favorited messages across all chats
  const favorites = chats.flatMap((c) =>
    c.messages.filter((m) => m.favorited).map((m) => ({ chat: c, message: m })),
  )

  const sendMessage = useCallback(
    async (content: string, fileAttach?: FileAttachment, imageAttach?: ImageAttachment) => {
      if (streamingRef.current) return // guard: don't send while already streaming

      if (!currentApiKey) {
        setSettingsOpen(true)
        return
      }

      let chat = activeChat
      if (!chat) {
        chat = createChat()
      }

      // If file attached, prepend its content to the message for the API
      let finalContent = fileAttach
        ? `[Attached file: ${fileAttach.name}]
---
${fileAttach.content}
---

${content}`
        : content

      // ── Run pre-processor plugins ────────────────────
      // Set streaming flag BEFORE pre-processors to prevent race condition
      // Set streaming flag BEFORE pre-processors to prevent race condition
      setStreaming(true)
      streamingRef.current = true

      // ── Run pre-processor plugins ────────────────────
      const ctxMessages = (chat?.messages ?? []).map((m) => ({ role: m.role, content: m.content }))
      finalContent = await runPreProcessors(finalContent, ctxMessages)

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: finalContent,
        timestamp: Date.now(),
        replyTo: replyTo?.messageId,
        fileAttach: fileAttach,
        imageAttach: imageAttach,
      }

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        loading: true,
      }

      const currentReply = replyTo
      setReplyTo(null) // clear reply state

      // Add messages to chat
      setChats((prev) =>
        prev.map((c) =>
          c.id === chat!.id
            ? {
                ...c,
                messages: [...c.messages, userMessage, assistantMessage],
                updatedAt: Date.now(),
              }
            : c,
        ),
      )

      const abortController = new AbortController()
      abortRef.current = abortController

      // Build API messages with proper multimodal support
      const isNewChat = chat.title === DEFAULT_CHAT_TITLE
      const systemContent = buildSystemPrompt(
        settings?.systemPrompt ?? '',
        settings?.responseLanguage,
        settings?.autoTitle,
        settings?.showSuggestions,
        isNewChat && chat.messages.length === 0,
      )
      const apiMessages: { role: string; content: string | ContentPart[] }[] = [
        { role: 'system', content: systemContent },
        ...(chat?.messages ?? []).map((m) => ({
          role: m.role,
          content: m.imageAttach
            ? buildMessageContent(m.content, m.imageAttach)
            : m.content,
        })),
        {
          role: 'user' as const,
          content: currentReply
            ? buildMessageContent(`[Replying to: "${currentReply.preview}"]\n\n${finalContent}`, imageAttach)
            : buildMessageContent(finalContent, imageAttach),
        },
      ]

      let fullContent = ''

      let fullReasoning = ''

      await streamChat(
        currentProviderType,
        currentApiEndpoint,
        currentApiKey,
        currentModel,
        apiMessages,
        systemContent,
        abortController.signal,
        {
          onToken: (token) => {
            fullContent += token
            setChats((prev) =>
              prev.map((c) =>
                c.id === chat!.id
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessage.id ? { ...m, content: fullContent, reasoning: fullReasoning || undefined } : m,
                      ),
                    }
                  : c,
              ),
            )
          },
          onReasoning: (token) => {
            fullReasoning += token
            setChats((prev) =>
              prev.map((c) =>
                c.id === chat!.id
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessage.id ? { ...m, reasoning: fullReasoning } : m,
                      ),
                    }
                  : c,
              ),
            )
          },
          onUsage: (usage) => {
            addTokenUsage(usage)
          },
          onDone: async () => {
            let processedContent = fullContent
            try {
              // ── Run post-processor plugins ────────────────
              const postMessages = (chats.find((c) => c.id === chat!.id)?.messages ?? []).map((m) => ({ role: m.role, content: m.content }))
              processedContent = await runPostProcessors(fullContent, postMessages)
            } catch {
              processedContent = fullContent // fallback on error
            }

            const { cleanContent, titleSuggestion, suggestions } = parseStructuredResponse(processedContent)
            const finalContent = cleanContent || 'No response'

            setChats((prev) =>
              prev.map((c) =>
                c.id === chat!.id
                  ? {
                      ...c,
                      title: (titleSuggestion && c.title === DEFAULT_CHAT_TITLE)
                        ? titleSuggestion
                        : c.title,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessage.id
                          ? {
                              ...m,
                              loading: false,
                              content: finalContent,
                              reasoning: fullReasoning || undefined,
                              titleSuggestion,
                              suggestions,
                            }
                          : m,
                      ),
                    }
                  : c,
              ),
            )
            setStreaming(false)
            abortRef.current = null
          },
          onError: (error) => {
            console.error('Chat error:', error)
            setChats((prev) =>
              prev.map((c) =>
                c.id === chat!.id
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantMessage.id
                          ? { ...m, loading: false, error: true, content: `Error: ${error.message}`, reasoning: fullReasoning || undefined }
                          : m,
                      ),
                    }
                  : c,
              ),
            )
            setStreaming(false)
            abortRef.current = null
          },
        },
        { maxReasoningTokens: settings?.maxReasoningTokens, maxOutputTokens: settings?.maxOutput, temperature: settings?.temperature },
      )
    },
    [activeChat, settings, createChat, currentProviderType, currentApiEndpoint, currentApiKey, currentModel],
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // Force-save chats to disk (bypasses incognito guard)
  const saveChatsToDisk = useCallback(async () => {
    if (chats.length === 0) return false
    await saveChats(chats)
    return true
  }, [chats])

  return {
    chats,
    activeChat,
    activeChatId,
    settings,
    sidebarOpen,
    settingsOpen,
    streaming,
    editing,
    setSidebarOpen,
    setSettingsOpen,
    setSettings: persistSettings,
    createChat,
    deleteChat,
    updateChatTitle,
    selectChat,
    reorderChats,
    sendMessage,
    stopStreaming,
    importChatsFromJson,
    editMessage: startEditing,
    cancelEditing,
    submitEdit,
    cycleMessageVersion,
    regenerateMessage,
    exportChatsToJson,
    replyTo,
    startReplying,
    cancelReplying,
    toggleFavorite,
    favorites,
    activeCharacter,
    setActiveCharacter,
    saveChatsToDisk,
    providers,
    activeProvider,
    activeProviderId,
    setActiveProvider,
    addProvider,
    deleteProvider,
    updateProvider,
    switchProviderModel,
    currentProviderType,
    currentApiEndpoint,
    currentApiKey,
    currentModel,
    tokenStats,
  }
}
