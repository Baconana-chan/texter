import type { Chat } from '../types'

export interface AutocompleteSuggestion {
  text: string
  source: string
  sourceChatId: string
}

/**
 * Search through all chat titles and messages for text matching the current input.
 * Returns up to `maxResults` suggestions sorted by relevance.
 */
export function getAutocompleteSuggestions(
  chats: Chat[],
  query: string,
  maxResults: number = 8,
): AutocompleteSuggestion[] {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.length < 2) return []

  const seen = new Set<string>()
  const results: AutocompleteSuggestion[] = []

  // ── Search chat titles ──────────────────────
  for (const chat of chats) {
    const t = chat.title.toLowerCase()
    if (t.includes(trimmed) && !seen.has(chat.title)) {
      seen.add(chat.title)
      results.push({ text: chat.title, source: 'Chat', sourceChatId: chat.id })
      if (results.length >= maxResults) return results
    }
  }

  // ── Search message content ──────────────────
  for (const chat of chats) {
    for (const msg of chat.messages) {
      if (results.length >= maxResults) break
      const content = msg.content.toLowerCase()
      if (!content.includes(trimmed)) continue

      // Skip very short or already seen exact matches
      const preview = msg.content.length > 100
        ? msg.content.slice(0, 100).trim() + '…'
        : msg.content
      if (seen.has(preview)) continue
      seen.add(preview)

      const label = msg.role === 'user' ? 'You' : 'Assistant'
      results.push({
        text: preview,
        source: `${label} · ${chat.title}`,
        sourceChatId: chat.id,
      })
    }
  }

  return results.slice(0, maxResults)
}
