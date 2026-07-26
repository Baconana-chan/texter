const STORE_NAME = 'drafts.json'
const KEY = 'drafts'

let store: any = null
let cache: Record<string, string> | null = null

async function getStore(): Promise<any> {
  if (!store) {
    const { Store } = await import('@tauri-apps/plugin-store')
    store = await Store.load(STORE_NAME)
  }
  return store
}

/** Load all drafts into memory cache */
async function loadAll(): Promise<Record<string, string>> {
  if (cache) return cache
  try {
    const s = await getStore()
    const data = await s.get(KEY) as Record<string, string> | null
    cache = data ?? {}
  } catch {
    cache = {}
  }
  return cache!
}

/** Save drafts from cache to disk — debounced via timer outside */
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    if (cache) {
      try {
        const s = await getStore()
        await s.set(KEY, cache)
        await s.save()
      } catch {}
    }
    saveTimer = null
  }, 1500)
}

/** Get draft for a specific chat */
export async function getDraft(chatId: string): Promise<string> {
  const all = await loadAll()
  return all[chatId] ?? ''
}

/** Save draft for a specific chat */
export async function saveDraft(chatId: string, text: string): Promise<void> {
  const all = await loadAll()
  if (text) {
    all[chatId] = text
  } else {
    delete all[chatId]  // remove empty drafts
  }
  cache = all
  scheduleSave()
}

/** Remove draft for a specific chat (e.g. after sending) */
export async function removeDraft(chatId: string): Promise<void> {
  const all = await loadAll()
  delete all[chatId]
  cache = all
  scheduleSave()
}

/** Force-save drafts now (for cleanup on unmount) */
export async function flushDrafts(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (cache) {
    try {
      const s = await getStore()
      await s.set(KEY, cache)
      await s.save()
    } catch {}
  }
}
