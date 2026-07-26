import type { ImageGenRecord } from '../types'

const STORE_NAME = 'image-gen.json'
const KEY = 'history'

let store: any = null

async function getStore(): Promise<any> {
  if (!store) {
    const { Store } = await import('@tauri-apps/plugin-store')
    store = await Store.load(STORE_NAME)
  }
  return store
}

export async function getGenerationHistory(): Promise<ImageGenRecord[]> {
  try {
    const s = await getStore()
    const data = await s.get(KEY) as ImageGenRecord[] | null
    return data ?? []
  } catch {
    return []
  }
}

export async function addGeneration(record: ImageGenRecord): Promise<void> {
  try {
    const s = await getStore()
    const history = (await s.get(KEY) as ImageGenRecord[] | null) ?? []
    history.unshift(record) // newest first
    // Keep max 100 records
    if (history.length > 100) history.length = 100
    await s.set(KEY, history)
    await s.save()
  } catch {
    // Silently fail — not critical
  }
}

export async function clearGenerationHistory(): Promise<void> {
  try {
    const s = await getStore()
    await s.set(KEY, [])
    await s.save()
  } catch {}
}
