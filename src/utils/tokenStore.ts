import { Store } from '@tauri-apps/plugin-store'
import type { TokenStats, TokenUsage } from '../types'

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await Store.load('stats.json')
  }
  return _store
}

const EMPTY_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

export async function loadTokenStats(): Promise<TokenStats> {
  try {
    const store = await getStore()
    const s = await store.get<TokenStats>('tokenStats')
    return s ?? { session: { ...EMPTY_USAGE }, total: { ...EMPTY_USAGE }, lastUpdated: 0 }
  } catch {
    return { session: { ...EMPTY_USAGE }, total: { ...EMPTY_USAGE }, lastUpdated: 0 }
  }
}

export async function saveTokenStats(stats: TokenStats): Promise<void> {
  const store = await getStore()
  await store.set('tokenStats', stats)
  await store.save()
}
