import type { TokenUsage, ContentPart, ProviderType } from '../types'

interface StreamCallbacks {
  onToken: (token: string) => void
  onReasoning?: (token: string) => void  // chain-of-thought (DeepSeek R1, Claude thinking, etc.)
  onUsage?: (usage: TokenUsage) => void  // token usage from response
  onDone: () => void
  onError: (error: Error) => void
}

/** API message with support for multimodal content */
export type ApiMessage = {
  role: string
  content: string | ContentPart[]
}

/** Unified streaming — routes to the correct implementation based on provider type */
export interface StreamOptions {
  maxReasoningTokens?: number
  maxOutputTokens?: number
  temperature?: number
}

// ── Retry helper ────────────────────────────────────────

const MAX_RETRIES = 3
const BASE_DELAY = 1000 // 1s

/**
 * Whether a fetch error is retryable (network error or 5xx server error).
 * 4xx errors (auth, not found, etc.) are NOT retried.
 */
function isRetryable(err: unknown, status?: number): boolean {
  if (status && status >= 500) return true
  // Network errors: TypeError, AbortError (not abort), etc.
  if (err instanceof TypeError) return true
  if (err instanceof DOMException && err.name === 'AbortError') return false
  if (err instanceof Error && err.message.includes('Failed to fetch')) return true
  return false
}

/**
 * Wait for `ms` milliseconds — used for exponential backoff.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wraps fetch with retry logic.
 * Returns the response if successful, throws on final failure.
 */
async function fetchWithRetry(
  input: string,
  init: RequestInit,
  attempt: number = 0,
): Promise<Response> {
  try {
    const response = await fetch(input, init)
    if (!response.ok && isRetryable(null, response.status) && attempt < MAX_RETRIES) {
      const backoff = BASE_DELAY * Math.pow(2, attempt)
      console.warn(`[API] HTTP ${response.status} — retry ${attempt + 1}/${MAX_RETRIES} in ${backoff}ms`)
      await delay(backoff + Math.random() * 500) // jitter
      return fetchWithRetry(input, init, attempt + 1)
    }
    return response
  } catch (err) {
    if (isRetryable(err, undefined) && attempt < MAX_RETRIES) {
      const backoff = BASE_DELAY * Math.pow(2, attempt)
      console.warn(`[API] Network error (${(err as Error).message}) — retry ${attempt + 1}/${MAX_RETRIES} in ${backoff}ms`)
      await delay(backoff + Math.random() * 500)
      return fetchWithRetry(input, init, attempt + 1)
    }
    throw err
  }
}

export async function streamChat(
  providerType: ProviderType,
  apiEndpoint: string,
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  systemPrompt: string,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
  options?: StreamOptions,
): Promise<void> {
  const opts = options ?? {}
  switch (providerType) {
    case 'anthropic':
      return streamChatAnthropic(apiEndpoint, apiKey, model, messages, systemPrompt, signal, callbacks, opts)
    case 'google':
      return streamChatGoogle(apiEndpoint, apiKey, model, messages, systemPrompt, signal, callbacks, opts)
    default:
      return streamChatOpenAI(apiEndpoint, apiKey, model, messages, signal, callbacks, opts)
  }
}

// ══════════════════════════════════════════════════
// OpenAI-compatible (/v1/chat/completions)
// ══════════════════════════════════════════════════

async function streamChatOpenAI(
  apiEndpoint: string,
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  signal: AbortSignal,
  callbacks: StreamCallbacks,
  options?: StreamOptions,
): Promise<void> {
  const { onToken, onDone, onError, onReasoning, onUsage } = callbacks

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  }

  if (options?.maxReasoningTokens && options.maxReasoningTokens > 0) {
    body.max_reasoning_tokens = options.maxReasoningTokens
  }

  try {
    const response = await fetchWithRetry(`${apiEndpoint.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'No error details')
      throw new Error(`API error ${response.status}: ${response.statusText}\n${errorBody}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          onDone()
          return
        }

        try {
          const parsed = JSON.parse(data)

          if (parsed.usage && onUsage) {
            onUsage({
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
              totalTokens: parsed.usage.total_tokens ?? 0,
            })
          }

          const delta = parsed.choices?.[0]?.delta || {}

          const content = delta.content || ''
          if (content) onToken(content)

          const reasoning = delta.reasoning_content || delta.thinking || ''
          if (reasoning && onReasoning) onReasoning(reasoning)
        } catch {
          // Skip malformed chunks
        }
      }
    }

    onDone()
  } catch (error) {
    if ((error as Error).name === 'AbortError') { onDone(); return }
    onError(error as Error)
  }
}

// ══════════════════════════════════════════════════
// Anthropic Claude (/v1/messages)
// ══════════════════════════════════════════════════

async function streamChatAnthropic(
  apiEndpoint: string,
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  systemPrompt: string,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
  options?: StreamOptions,
): Promise<void> {
  const { onToken, onDone, onError, onReasoning, onUsage } = callbacks

  // Anthropic doesn't include system messages in the messages array
  const apiMessages = messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : m.content.map((p) => p),
  }))

  const body: Record<string, unknown> = {
    model,
    messages: apiMessages,
    max_tokens: options?.maxOutputTokens ?? 4096,
    stream: true,
  }

  // Anthropic puts system prompt in a separate field
  if (systemPrompt) body.system = systemPrompt

  // Anthropic thinking/reasoning support (Claude 3.7 Sonnet+)
  if (options?.maxReasoningTokens && options.maxReasoningTokens > 0) {
    body.thinking = { type: 'enabled', budget_tokens: options.maxReasoningTokens }
  }

  try {
    const endpoint = `${apiEndpoint.replace(/\/$/, '')}/v1/messages`
    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'No error details')
      throw new Error(`Anthropic API error ${response.status}: ${response.statusText}\n${errorBody}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Anthropic SSE: event: ...\ndata: ...
        if (trimmed.startsWith('event: ')) continue  // event type, we handle by data content

        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)

        try {
          const parsed = JSON.parse(data)
          const type = parsed.type

          if (type === 'content_block_delta') {
            const delta = parsed.delta
            if (delta?.type === 'text_delta' && delta.text) {
              onToken(delta.text)
            }
            if (delta?.type === 'thinking_delta' && delta.thinking && onReasoning) {
              onReasoning(delta.thinking)
            }
          } else if (type === 'message_delta' && parsed.usage && onUsage) {
            onUsage({
              promptTokens: parsed.usage.input_tokens ?? 0,
              completionTokens: parsed.usage.output_tokens ?? 0,
              totalTokens: (parsed.usage.input_tokens ?? 0) + (parsed.usage.output_tokens ?? 0),
            })
          } else if (type === 'message_stop') {
            onDone()
            return
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    onDone()
  } catch (error) {
    if ((error as Error).name === 'AbortError') { onDone(); return }
    onError(error as Error)
  }
}

// ══════════════════════════════════════════════════
// Google Gemini (/v1beta/models/{model}:streamGenerateContent)
// ══════════════════════════════════════════════════

async function streamChatGoogle(
  apiEndpoint: string,
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  systemPrompt: string,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
  options?: StreamOptions,
): Promise<void> {
  const { onToken, onDone, onError, onUsage } = callbacks

  // Gemini uses 'model' role instead of 'assistant'
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : m.content.filter(p => p.type === 'text').map(p => (p as any).text).join('\n') }],
    }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 4096,
    },
  }

  // Gemini puts system prompt in system_instruction
  if (systemPrompt) {
    body.system_instruction = { parts: [{ text: systemPrompt }] }
  }

  const endpoint = `${apiEndpoint.replace(/\/$/, '')}/v1beta/models/${model}:streamGenerateContent?alt=sse`

  try {
    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'No error details')
      throw new Error(`Gemini API error ${response.status}: ${response.statusText}\n${errorBody}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          onDone()
          return
        }

        try {
          const parsed = JSON.parse(data)

          const candidate = parsed.candidates?.[0]
          if (!candidate) continue

          const part = candidate.content?.parts?.[0]
          if (part?.text) onToken(part.text)

          // Gemini doesn't have a separate reasoning endpoint
          // But usage is in usageMetadata
          if (parsed.usageMetadata && onUsage) {
            onUsage({
              promptTokens: parsed.usageMetadata.promptTokenCount ?? 0,
              completionTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: parsed.usageMetadata.totalTokenCount ?? 0,
            })
          }

          // Finish reason signals completion
          if (candidate.finishReason && candidate.finishReason !== 'FINISH_REASON_UNSPECIFIED') {
            // Don't call onDone here — wait for [DONE] or end of stream
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    onDone()
  } catch (error) {
    if ((error as Error).name === 'AbortError') { onDone(); return }
    onError(error as Error)
  }
}

/**
 * Non-streaming completion — collects full response from any provider.
 * Internally wraps streamChat in a Promise for universal provider support.
 */
export async function generateText(
  providerType: ProviderType,
  apiEndpoint: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
  temperature: number = 0.8,
): Promise<string> {
  // Extract system message if present (providers handle it differently)
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? ''
  const chatMessages = messages.filter((m) => m.role !== 'system')

  return new Promise<string>((resolve, reject) => {
    let full = ''

    streamChat(
      providerType,
      apiEndpoint,
      apiKey,
      model,
      chatMessages.map((m) => ({ role: m.role, content: m.content })),
      systemMsg,
      signal ?? new AbortController().signal,
      {
        onToken: (token) => { full += token },
        onDone: () => resolve(full),
        onError: (err) => reject(err),
      },
      { temperature },
    )
  })
}

/** Generate an image via OpenAI-compatible /images/generations endpoint */
export async function generateImage(
  apiEndpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
  n: number,
  size: string,
  quality: string,
  signal: AbortSignal,
): Promise<{ dataUrl: string; revisedPrompt?: string }[]> {
  const base = apiEndpoint.replace(/\/chat\/completions$/, '').replace(/\/?v1$/, '')
  const url = `${base}/v1/images/generations`

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: Math.min(Math.max(1, n), 10),
      size,
      quality,
      response_format: 'b64_json',
    }),
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'No error details')
    throw new Error(`Image generation error ${response.status}: ${response.statusText}\n${errorBody}`)
  }

  const data = await response.json()

  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error('No image data in response')
  }

  return data.data.map((item: any) => ({
    dataUrl: item.b64_json
      ? `data:image/png;base64,${item.b64_json}`
      : item.url ?? '',
    revisedPrompt: item.revised_prompt || undefined,
  }))
}
