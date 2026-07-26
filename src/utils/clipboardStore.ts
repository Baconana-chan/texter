import { Store } from '@tauri-apps/plugin-store'

export interface ClipboardEntry {
  id: string
  content: string
  source: string         // chat title or "manual"
  timestamp: number
}

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('clipboard.json')
  }
  return store
}

export async function loadClipboard(): Promise<ClipboardEntry[]> {
  try {
    const s = await getStore()
    const items = await s.get<ClipboardEntry[]>('items')
    return items ?? []
  } catch {
    return []
  }
}

export async function saveClipboard(items: ClipboardEntry[]): Promise<void> {
  const s = await getStore()
  await s.set('items', items)
  await s.save()
}

export async function addClipboardItem(content: string, source: string): Promise<ClipboardEntry> {
  const items = await loadClipboard()
  const entry: ClipboardEntry = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    content,
    source,
    timestamp: Date.now(),
  }
  // Add to front, cap at 500 items (for performance / storage)
  const next = [entry, ...items].slice(0, 500)
  await saveClipboard(next)
  return entry
}

export async function deleteClipboardItem(id: string): Promise<void> {
  const items = await loadClipboard()
  const next = items.filter((i) => i.id !== id)
  await saveClipboard(next)
}

export async function clearClipboard(): Promise<void> {
  await saveClipboard([])
}

/** Copy text to system clipboard with fallback for non-secure contexts */
export async function copyToSystem(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
