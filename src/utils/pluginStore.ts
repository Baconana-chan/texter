/**
 * Plugin system for Texter.
 *
 * Each plugin is a JS function that runs in a sandboxed context:
 * - Pre-processors: modify user message content before sending to API
 * - Post-processors: modify AI response content after receiving from API
 *
 * Pipeline: content → prePlugins → API → postPlugins → final content
 */

export interface Plugin {
  id: string
  name: string
  description: string
  /** 'pre' = runs on user message before API, 'post' = runs on AI response after API */
  type: 'pre' | 'post'
  /** Raw source code of the plugin function (async fn(context) => result) */
  code: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface PluginContext {
  /** The message content being processed */
  content: string
  /** All messages in the current chat so far (read-only) */
  messages: { role: string; content: string }[]
}

export interface PluginResult {
  content: string
}

type Listener = (plugins: Plugin[]) => void

const STORAGE_KEY = 'texter-plugins'

let plugins: Plugin[] = []
const listeners = new Set<Listener>()

// ── Persistence ───────────────────────────────────

function loadPlugins(): Plugin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePlugins(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins))
  } catch { /* quota exceeded — ignore */ }
}

// Init from storage
plugins = loadPlugins()

// ── Internal ──────────────────────────────────────

function notify(): void {
  for (const fn of listeners) fn(plugins)
}

// ── Public API ────────────────────────────────────

/** Get all plugins */
export function getPlugins(): Plugin[] {
  return plugins
}

/** Register a new plugin */
export function register(plugin: Omit<Plugin, 'id' | 'createdAt' | 'updatedAt'>): Plugin {
  const p: Plugin = {
    ...plugin,
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  plugins = [...plugins, p]
  savePlugins()
  notify()
  return p
}

/** Unregister a plugin by id */
export function unregister(id: string): void {
  plugins = plugins.filter((p) => p.id !== id)
  savePlugins()
  notify()
}

/** Toggle enabled state */
export function togglePlugin(id: string): void {
  plugins = plugins.map((p) =>
    p.id === id ? { ...p, enabled: !p.enabled, updatedAt: Date.now() } : p,
  )
  savePlugins()
  notify()
}

/** Update a plugin's metadata (name, description, code, type) */
export function updatePlugin(id: string, data: Partial<Pick<Plugin, 'name' | 'description' | 'code' | 'type'>>): void {
  plugins = plugins.map((p) =>
    p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p,
  )
  savePlugins()
  notify()
}

/** Subscribe to plugin changes */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ── Pipeline execution ────────────────────────────

/**
 * Safely execute a plugin's code in a sandboxed async function.
 * Returns the result or the original content if the plugin throws.
 */
async function runPluginCode(code: string, ctx: PluginContext): Promise<PluginResult> {
  try {
    // Create an async function from the user's code
    // The function receives (context) and must return { content } or a promise of it
    const fn = new Function('context', `return (async () => { ${code} })()`)
    const result = await fn(ctx)

    // Validate result
    if (!result || typeof result !== 'object' || typeof result.content !== 'string') {
      console.warn('[Plugin] Invalid return value — expected { content: string }')
      return { content: ctx.content }
    }

    return result as PluginResult
  } catch (err) {
    console.warn('[Plugin] Execution error:', err)
    return { content: ctx.content } // fail-safe: return original content
  }
}

/**
 * Run all enabled pre-processors in sequence.
 * Each plugin receives the output of the previous one.
 */
export async function runPreProcessors(
  content: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  let current = content

  const prePlugins = plugins.filter((p) => p.type === 'pre' && p.enabled)
  for (const plugin of prePlugins) {
    const result = await runPluginCode(plugin.code, { content: current, messages })
    current = result.content
  }

  return current
}

/**
 * Run all enabled post-processors in sequence.
 * Each plugin receives the output of the previous one.
 */
export async function runPostProcessors(
  content: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  let current = content

  const postPlugins = plugins.filter((p) => p.type === 'post' && p.enabled)
  for (const plugin of postPlugins) {
    const result = await runPluginCode(plugin.code, { content: current, messages })
    current = result.content
  }

  return current
}
