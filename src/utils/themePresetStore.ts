import { Store } from '@tauri-apps/plugin-store'
import type { ThemePreset } from '../types'
import { DEFAULT_THEME_PRESETS } from '../types'

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await Store.load('theme-presets.json')
  }
  return _store
}

const CUSTOM_KEY = 'customPresets'

/** Load custom presets (built-in presets are returned separately) */
export async function loadCustomPresets(): Promise<ThemePreset[]> {
  try {
    const store = await getStore()
    const data = await store.get<ThemePreset[]>(CUSTOM_KEY)
    return data ?? []
  } catch {
    return []
  }
}

/** Save custom presets */
export async function saveCustomPresets(presets: ThemePreset[]): Promise<void> {
  const store = await getStore()
  await store.set(CUSTOM_KEY, presets)
  await store.save()
}

/** Get all presets: built-in defaults + custom saved ones */
export async function getAllPresets(): Promise<ThemePreset[]> {
  const custom = await loadCustomPresets()
  return [...DEFAULT_THEME_PRESETS, ...custom]
}

/** Save a new custom preset */
export async function addPreset(name: string, colors: Record<string, string>): Promise<ThemePreset> {
  const preset: ThemePreset = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    colors,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const custom = await loadCustomPresets()
  custom.push(preset)
  await saveCustomPresets(custom)
  return preset
}

/** Update an existing custom preset */
export async function updatePreset(id: string, data: Partial<Pick<ThemePreset, 'name' | 'colors'>>): Promise<void> {
  const custom = await loadCustomPresets()
  const idx = custom.findIndex((p) => p.id === id)
  if (idx === -1) return

  custom[idx] = { ...custom[idx], ...data, updatedAt: Date.now() }
  await saveCustomPresets(custom)
}

/** Delete a custom preset */
export async function deletePreset(id: string): Promise<void> {
  const custom = await loadCustomPresets()
  const filtered = custom.filter((p) => p.id !== id)
  await saveCustomPresets(filtered)
}

/** Duplicate a preset (from built-in or custom) */
export async function duplicatePreset(preset: ThemePreset, newName: string): Promise<ThemePreset> {
  return addPreset(newName, { ...preset.colors })
}
