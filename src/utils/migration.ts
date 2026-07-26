/**
 * Migration system for Texter.
 *
 * When the app starts, it checks the stored schema version and runs
 * any pending migrations in order. Each migration transforms the
 * stored data (settings, chats, providers, token stats) to the next
 * version without losing user data.
 *
 * The current version is stored in its own Tauri store file (migration.json).
 * If absent, the migration engine assumes version 0 and runs all migrations.
 */

import { Store } from '@tauri-apps/plugin-store'

// ── Versioning ────────────────────────────────────
// Bump this when you add a new migration below.
export const CURRENT_MIGRATION_VERSION = 2

// Key for migration store
const MIGRATION_STORE_FILE = 'migration.json'
const VERSION_KEY = 'schemaVersion'

let migrationStore: Store | null = null

async function getMigrationStore(): Promise<Store> {
  if (!migrationStore) {
    migrationStore = await Store.load(MIGRATION_STORE_FILE)
  }
  return migrationStore
}

// ── Migration interface ──────────────────────────

export interface MigrationContext {
  /** All Tauri stores — use these to read/write data during migration */
  settingsStore: Store
  chatsStore: Store
  providersStore: Store
  statsStore: Store
}

export type MigrationFn = (ctx: MigrationContext) => Promise<void>

interface Migration {
  fromVersion: number
  toVersion: number
  name: string
  description: string
  run: MigrationFn
}

// ── Migration registry ───────────────────────────
// Add new migrations at the end. Never remove or reorder existing ones.

const migrations: Migration[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    name: 'Initial schema setup',
    description: 'Set default values for new fields in existing data (theme, accentColor, ocrLanguage, responseLanguage, autoTitle, showSuggestions).',
    run: async (ctx: MigrationContext) => {
      // v0 → v1: Ensure AppSettings has all new optional fields with defaults
      const settings = await ctx.settingsStore.get<Record<string, unknown>>('settings')
      if (settings) {
        const updated = {
          ...settings,
          // Ensure theme field exists (default to 'auto')
          theme: (settings as any).theme ?? 'auto',
          accentColor: (settings as any).accentColor ?? '#10a37f',
          ocrLanguage: (settings as any).ocrLanguage ?? 'eng+rus',
          responseLanguage: (settings as any).responseLanguage ?? 'auto',
          autoTitle: (settings as any).autoTitle ?? true,
          showSuggestions: (settings as any).showSuggestions ?? true,
          incognito: (settings as any).incognito ?? false,
        }
        await ctx.settingsStore.set('settings', updated)
        await ctx.settingsStore.save()
      }

      // Ensure token stats have proper structure (session + total)
      const stats = await ctx.statsStore.get<Record<string, unknown>>('tokenStats')
      if (stats) {
        const emptyUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        const updated = {
          session: (stats as any).session ?? { ...emptyUsage },
          total: (stats as any).total ?? { ...emptyUsage },
          lastUpdated: (stats as any).lastUpdated ?? Date.now(),
        }
        await ctx.statsStore.set('tokenStats', updated)
        await ctx.statsStore.save()
      }

      // Ensure providers have createdAt field (backfill for old data)
      const providers = await ctx.providersStore.get<Record<string, unknown>[]>('providers')
      if (providers && Array.isArray(providers)) {
        const updated = providers.map((p: any) => ({
          ...p,
          createdAt: p.createdAt ?? Date.now(),
        }))
        await ctx.providersStore.set('providers', updated)
        await ctx.providersStore.save()
      }

      // Ensure chats have systemPrompt field (backfill)
      const chats = await ctx.chatsStore.get<Record<string, unknown>[]>('chats')
      if (chats && Array.isArray(chats)) {
        const updated = chats.map((c: any) => ({
          ...c,
          systemPrompt: c.systemPrompt ?? undefined,
        }))
        await ctx.chatsStore.set('chats', updated)
        await ctx.chatsStore.save()
      }
    },
  },
  {
    fromVersion: 1,
    toVersion: 2,
    name: 'Multi-Provider: add type field',
    description: 'Add `type: "openai"` to any existing provider that lacks a type field (for Anthropic/Google API compatibility).',
    run: async (ctx: MigrationContext) => {
      const providers = await ctx.providersStore.get<Record<string, unknown>[]>('providers')
      if (providers && Array.isArray(providers)) {
        const updated = providers.map((p: any) => ({
          ...p,
          type: p.type ?? 'openai',
        }))
        await ctx.providersStore.set('providers', updated)
        await ctx.providersStore.save()
      }
    },
  },
]

// ── Backup ───────────────────────────────────────

/** Store names and their backup counterparts */
const STORE_BACKUPS: { name: string; backup: string; key: string }[] = [
  { name: 'settings.json', backup: 'backup-settings.json', key: 'settings' },
  { name: 'chats.json', backup: 'backup-chats.json', key: 'chats' },
  { name: 'providers.json', backup: 'backup-providers.json', key: 'providers' },
  { name: 'stats.json', backup: 'backup-stats.json', key: 'tokenStats' },
]

/** Create backups of all stores before running migrations */
async function createBackups(ctx: MigrationContext): Promise<void> {
  const storeKeys: { store: Store; backup: string; key: string }[] = [
    { store: ctx.settingsStore, backup: 'backup-settings.json', key: 'settings' },
    { store: ctx.chatsStore, backup: 'backup-chats.json', key: 'chats' },
    { store: ctx.providersStore, backup: 'backup-providers.json', key: 'providers' },
    { store: ctx.statsStore, backup: 'backup-stats.json', key: 'tokenStats' },
  ]

  for (const { store, backup, key } of storeKeys) {
    try {
      // Read current data from the context store (pre-migration state)
      const data = await store.get<any>(key)

      // Save it to the backup store
      const backupStore = await Store.load(backup)
      await backupStore.set(key, data)
      await backupStore.save()

      console.log(`[Backup] ✅ Created ${backup}`)
    } catch (err) {
      console.warn(`[Backup] ⚠️ Failed to backup ${store} (${key}):`, err)
    }
  }
}

/** Restore all stores from backups (for recovery) */
export async function restoreFromBackups(): Promise<boolean> {
  let restored = false

  for (const { name, backup, key } of STORE_BACKUPS) {
    try {
      const backupStore = await Store.load(backup)
      const data = await backupStore.get<any>(key)

      if (data !== undefined && data !== null) {
        const targetStore = await Store.load(name)
        await targetStore.set(key, data)
        await targetStore.save()
        console.log(`[Restore] ✅ Restored ${name} from ${backup}`)
        restored = true
      }
    } catch (err) {
      console.warn(`[Restore] ⚠️ Failed to restore ${name}:`, err)
    }
  }

  return restored
}

/** Delete old backup files */
export async function clearBackups(): Promise<void> {
  for (const { backup, key } of STORE_BACKUPS) {
    try {
      const store = await Store.load(backup)
      await store.set(key, null)
      await store.save()
    } catch {
      // ignore
    }
  }
}

// ── Migration engine ─────────────────────────────

/** Promise that resolves after migration completes. Other code can await this. */
let migrationPromise: Promise<void> | null = null

async function loadStoredVersion(): Promise<number> {
  try {
    const store = await getMigrationStore()
    const v = await store.get<number>(VERSION_KEY)
    return v ?? 0
  } catch {
    return 0
  }
}

async function saveVersion(version: number): Promise<void> {
  const store = await getMigrationStore()
  await store.set(VERSION_KEY, version)
  await store.save()
}

async function loadStore(name: string): Promise<Store> {
  return await Store.load(name)
}

/**
 * Run all pending migrations.
 * Should be called once at app startup, before loading any data.
 */
export async function runMigrations(): Promise<void> {
  // If already running, return the existing promise
  if (migrationPromise) return migrationPromise

  migrationPromise = (async () => {
    const currentVersion = await loadStoredVersion()

    if (currentVersion >= CURRENT_MIGRATION_VERSION) {
      // Already up to date — clear old backups
      await clearBackups()
      return
    }

    console.log(
      `[Migration] Starting migration from v${currentVersion} to v${CURRENT_MIGRATION_VERSION}`,
    )

    // Load all stores once
    const ctx: MigrationContext = {
      settingsStore: await loadStore('settings.json'),
      chatsStore: await loadStore('chats.json'),
      providersStore: await loadStore('providers.json'),
      statsStore: await loadStore('stats.json'),
    }

    // ── Create backups BEFORE running any migrations ──
    console.log('[Migration] Creating store backups...')
    await createBackups(ctx)

    let allSucceeded = true

    // Run pending migrations in order
    for (const migration of migrations) {
      if (migration.fromVersion >= currentVersion && migration.toVersion <= CURRENT_MIGRATION_VERSION) {
        console.log(`[Migration] Running: ${migration.name} (v${migration.fromVersion} → v${migration.toVersion})`)
        try {
          await migration.run(ctx)
          console.log(`[Migration] ✅ ${migration.name} complete`)
        } catch (err) {
          console.error(`[Migration] ❌ ${migration.name} failed:`, err)
          allSucceeded = false
        }
      }
    }

    if (allSucceeded) {
      await saveVersion(CURRENT_MIGRATION_VERSION)
      console.log(`[Migration] Complete — now at v${CURRENT_MIGRATION_VERSION}`)
      // Clear backups after successful migration
      await clearBackups()
    } else {
      console.warn('[Migration] Some migrations failed — version NOT saved, will retry on next start')
      console.warn('[Migration] Backups preserved — you can restore with restoreFromBackups()')
    }
  })()

  return migrationPromise
}

/**
 * Returns a promise that resolves when migration is complete.
 * Other modules (e.g. useChat) can await this before reading stores.
 */
export function getMigrationReady(): Promise<void> {
  return migrationPromise ?? Promise.resolve()
}
