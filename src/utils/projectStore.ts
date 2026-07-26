import type { Character, Scene, Project } from '../types'

let store: Awaited<ReturnType<typeof getStore>> | null = null

async function getStore() {
  const { Store } = await import('@tauri-apps/plugin-store')
  return Store.load('projects.json')
}

async function withStore<T>(fn: (s: typeof store) => T): Promise<T> {
  if (!store) store = await getStore()
  return fn(store)
}

export async function loadCharacters(): Promise<Character[]> {
  return withStore(async (s) => (await s!.get<Character[]>('characters')) ?? [])
}

export async function saveCharacters(characters: Character[]): Promise<void> {
  return withStore(async (s) => {
    await s!.set('characters', characters)
    await s!.save()
  })
}

export async function loadScenes(): Promise<Scene[]> {
  return withStore(async (s) => (await s!.get<Scene[]>('scenes')) ?? [])
}

export async function saveScenes(scenes: Scene[]): Promise<void> {
  return withStore(async (s) => {
    await s!.set('scenes', scenes)
    await s!.save()
  })
}

export async function loadProjectsStore(): Promise<Project[]> {
  return withStore(async (s) => (await s!.get<Project[]>('projects')) ?? [])
}

export async function saveProjectsStore(projects: Project[]): Promise<void> {
  return withStore(async (s) => {
    await s!.set('projects', projects)
    await s!.save()
  })
}
