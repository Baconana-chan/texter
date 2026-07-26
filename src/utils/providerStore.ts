import type { Provider } from '../types'
import { Store } from '@tauri-apps/plugin-store'

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await Store.load('providers.json')
  }
  return _store
}

export async function loadProviders(): Promise<Provider[]> {
  try {
    const store = await getStore()
    return (await store.get<Provider[]>('providers')) ?? []
  } catch {
    return []
  }
}

export async function saveProviders(providers: Provider[]): Promise<void> {
  const store = await getStore()
  await store.set('providers', providers)
  await store.save()
}

export async function loadActiveProviderId(): Promise<string | null> {
  try {
    const store = await getStore()
    return (await store.get<string>('activeProviderId')) ?? null
  } catch {
    return null
  }
}

export async function saveActiveProviderId(id: string | null): Promise<void> {
  const store = await getStore()
  await store.set('activeProviderId', id)
  await store.save()
}
