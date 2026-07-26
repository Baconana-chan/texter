import { Store } from '@tauri-apps/plugin-store'
import type { AppSettings, Chat } from '../types'
import { DEFAULT_SETTINGS } from '../types'

let settingsStore: Store | null = null
let chatsStore: Store | null = null

async function getSettingsStore(): Promise<Store> {
  if (!settingsStore) {
    settingsStore = await Store.load('settings.json')
  }
  return settingsStore
}

async function getChatsStore(): Promise<Store> {
  if (!chatsStore) {
    chatsStore = await Store.load('chats.json')
  }
  return chatsStore
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const store = await getSettingsStore()
    const settings = await store.get<AppSettings>('settings')
    return settings ?? DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await getSettingsStore()
  await store.set('settings', settings)
  await store.save()
}

export async function loadChats(): Promise<Chat[]> {
  try {
    const store = await getChatsStore()
    const chats = await store.get<Chat[]>('chats')
    return chats ?? []
  } catch {
    return []
  }
}

export async function saveChats(chats: Chat[]): Promise<void> {
  const store = await getChatsStore()
  await store.set('chats', chats)
  await store.save()
}

// ── PIN ───────────────────────────────────────────

export function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + 'texter-salt')
  return crypto.subtle.digest('SHA-256', data).then((buf) => {
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return hex
  })
}

async function getSettingsStoreForPin(): Promise<Store> {
  // Reuse the same settings store
  if (!settingsStore) {
    settingsStore = await Store.load('settings.json')
  }
  return settingsStore
}

export async function savePinHash(hash: string): Promise<void> {
  const store = await getSettingsStoreForPin()
  await store.set('pinHash', hash)
  await store.save()
}

export async function loadPinHash(): Promise<string | null> {
  try {
    const store = await getSettingsStoreForPin()
    const h = await store.get<string>('pinHash')
    return h ?? null
  } catch {
    return null
  }
}

export async function removePinHash(): Promise<void> {
  const store = await getSettingsStoreForPin()
  await store.set('pinHash', null)
  await store.save()
}
