import type { Chat, Message } from '../types'

/**
 * Chatbox export JSON structure:
 *
 * {
 *   __exported_items: ["setting","conversations","copilot","key"],
 *   __exported_at: "2026-07-25T09:08:41.248Z",
 *   myCopilots: [],
 *   settings: { ... },
 *   configVersion: 4,
 *   "chat-sessions-list": ["<uuid>", ...],
 *   "session:<uuid>": {
 *     name: "Chat Title",
 *     type: "chat",
 *     messages: [
 *       {
 *         id: "<uuid>",
 *         role: "system" | "user" | "assistant",
 *         contentParts: [
 *           { type: "text", text: "..." },
 *           { type: "reasoning", text: "..." }
 *         ],
 *         timestamp: 1782150882417,
 *         ...
 *       }
 *     ]
 *   }
 * }
 */

/** Prefix Chatbox uses for session keys */
const SESSION_PREFIX = 'session:'

export function parseChatboxExport(json: unknown): Chat[] {
  if (!json || typeof json !== 'object') return []

  const root = json as Record<string, unknown>

  // Collect all session keys, extract UUID from each
  const sessionEntries = Object.entries(root)
    .filter(([k]) => k.startsWith(SESSION_PREFIX))
    .map(([k, v]) => [k.slice(SESSION_PREFIX.length), v] as const)

  if (sessionEntries.length === 0) return []

  const result: Chat[] = []

  for (const [uuid, raw] of sessionEntries) {
    if (!raw || typeof raw !== 'object') continue

    const session = raw as Record<string, unknown>
    if (session.type !== 'chat') continue

    const chat = chatFromSession(session, uuid)
    if (chat) result.push(chat)
  }

  return result
}

/* ── Session → Chat converter ──────────────────── */

function chatFromSession(session: Record<string, unknown>, uuid: string): Chat | null {
  const rawMessages = session.messages
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) return null

  const allMessages = rawMessages
    .map(messageFromChatbox)
    .filter((m): m is Message => m !== null)

  if (allMessages.length === 0) return null

  // Extract system prompt from system messages (Chatbox puts them as regular messages)
  let systemPrompt: string | undefined
  const nonSystemMessages = allMessages.filter((m) => {
    if (m.role === 'system') {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${m.content}`
        : m.content
      return false // remove system messages from visible chat
    }
    return true
  })

  const messages = nonSystemMessages.length > 0 ? nonSystemMessages : allMessages

  const now = Date.now()

  // Derive timestamps from messages
  const timestamps = messages
    .map((m) => m.timestamp)
    .filter((t): t is number => t > 0)

  return {
    id: `chatbox-${uuid}`,
    title:
      (session.name as string)?.trim() ||
      messages[0]?.content?.slice(0, 50).trim() ||
      'Imported Chat',
    messages,
    model: 'openrouter/auto', // Chatbox export doesn't always include model
    createdAt: timestamps.length > 0 ? Math.min(...timestamps) : now,
    updatedAt: timestamps.length > 0 ? Math.max(...timestamps) : now,
    systemPrompt: systemPrompt || undefined,
  }
}

/**
 * Extract potential characters (system prompts) from a Chatbox export.
 * Returns items that can be saved as characters in the Project Mode library.
 */
export function extractCharactersFromChatbox(json: unknown): { name: string; systemPrompt: string }[] {
  if (!json || typeof json !== 'object') return []

  const root = json as Record<string, unknown>
  const sessionEntries = Object.entries(root)
    .filter(([k]) => k.startsWith(SESSION_PREFIX))
    .map(([, v]) => v as Record<string, unknown>)
    .filter((v) => v && typeof v === 'object' && v.type === 'chat')

  const result: { name: string; systemPrompt: string }[] = []
  const seen = new Set<string>()

  for (const session of sessionEntries) {
    const rawMessages = session.messages
    if (!Array.isArray(rawMessages)) continue

    for (const raw of rawMessages) {
      if (!raw || typeof raw !== 'object') continue
      const m = raw as Record<string, unknown>
      const role = normalizeRole(m.role as string | undefined)
      if (role !== 'system') continue

      const content = extractContent(m.contentParts) ?? ''
      if (!content.trim()) continue

      // Deduplicate by first 100 chars of content
      const key = content.trim().slice(0, 100)
      if (seen.has(key)) continue
      seen.add(key)

      const name = (session.name as string)?.trim() || 'Chatbot'
      result.push({ name, systemPrompt: content.trim() })
    }
  }

  return result
}

/* ── Single message converter ──────────────────── */

function messageFromChatbox(raw: unknown): Message | null {
  if (!raw || typeof raw !== 'object') return null

  const m = raw as Record<string, unknown>
  const role = normalizeRole(m.role as string | undefined)
  const content = extractContent(m.contentParts)
  const reasoning = extractReasoning(m.contentParts)

  if (!content && !reasoning) return null

  // Parse edit history — Chatbox may store previous versions in an `edits` array
  let edits: { content: string; timestamp: number }[] | undefined
  const rawEdits = m.edits as unknown[] | undefined
  if (Array.isArray(rawEdits)) {
    edits = rawEdits
      .map((e: unknown) => {
        if (!e || typeof e !== 'object') return null
        const edit = e as Record<string, unknown>
        const editContent = extractContent(edit.contentParts) ?? (typeof edit.text === 'string' ? edit.text : null) ?? (edit.content as string | undefined)
        if (!editContent) return null
        return {
          content: editContent,
          timestamp: safeNumber(edit.timestamp) || Date.now(),
        }
      })
      .filter((e): e is { content: string; timestamp: number } => e !== null)
    // Sort oldest-first to match our schema (newest first)
    edits.sort((a, b) => b.timestamp - a.timestamp)
    if (edits.length === 0) edits = undefined
  }

  return {
    id: (m.id as string) || generateId(),
    role,
    content: content || '',
    reasoning: reasoning || undefined,
    edits,
    editIndex: 0,
    timestamp: safeNumber(m.timestamp) || Date.now(),
  }
}

/**
 * Chatbox stores message content as an array of `contentParts`.
 * Each part has `type` ("text" | "reasoning") and `text`.
 * For user messages it may also store `contentParts` directly as objects
 * with a `text` property.
 */
function extractContent(contentParts: unknown): string | null {
  if (!contentParts) return null

  // Direct string
  if (typeof contentParts === 'string') return contentParts || null

  // Array of parts
  if (Array.isArray(contentParts)) {
    // Collect text parts only (skip reasoning)
    const parts: string[] = []
    for (const part of contentParts) {
      if (!part || typeof part !== 'object') continue
      const p = part as Record<string, unknown>
      if (p.type === 'reasoning') continue
      if (typeof p.text === 'string' && p.text) {
        parts.push(p.text)
      }
    }
    return parts.length > 0 ? parts.join('\n\n') : null
  }

  // Object with text property
  if (typeof contentParts === 'object') {
    const cp = contentParts as Record<string, unknown>
    if (typeof cp.text === 'string') return cp.text
  }

  return null
}

/** Extract reasoning (chain-of-thought) content from contentParts */
function extractReasoning(contentParts: unknown): string | null {
  if (!contentParts || !Array.isArray(contentParts)) return null

  const parts: string[] = []
  for (const part of contentParts) {
    if (!part || typeof part !== 'object') continue
    const p = part as Record<string, unknown>
    if (p.type === 'reasoning' && typeof p.text === 'string' && p.text) {
      parts.push(p.text)
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : null
}

/* ── Helpers ───────────────────────────────────── */

function normalizeRole(role: string | undefined): 'user' | 'assistant' | 'system' {
  switch (role?.toLowerCase()) {
    case 'user':
    case 'human':
      return 'user'
    case 'assistant':
    case 'ai':
    case 'bot':
      return 'assistant'
    default:
      return 'system'
  }
}

function safeNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (!isNaN(n)) return n
  }
  return undefined
}

let _idCounter = 0
function generateId(): string {
  return `imported-${Date.now()}-${++_idCounter}`
}
