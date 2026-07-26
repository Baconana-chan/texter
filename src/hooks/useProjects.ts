import { useState, useCallback, useEffect } from 'preact/hooks'
import type { Character, Scene } from '../types'
import { DEFAULT_CHARACTER } from '../types'
import { loadCharacters, saveCharacters, loadScenes, saveScenes } from '../utils/projectStore'

function genId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useProjects() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [charEditorOpen, setCharEditorOpen] = useState(false)
  const [sceneEditorOpen, setSceneEditorOpen] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [editingScene, setEditingScene] = useState<Scene | null>(null)

  // Load on mount
  useEffect(() => {
    loadCharacters().then(setCharacters)
    loadScenes().then(setScenes)
  }, [])

  // Persist on change (save even when empty to propagate deletions)
  useEffect(() => { saveCharacters(characters) }, [characters])
  useEffect(() => { saveScenes(scenes) }, [scenes])

  // ── Characters ──────────────────────────────────
  const openNewCharacter = useCallback(() => {
    setEditingCharacter(null)
    setCharEditorOpen(true)
  }, [])

  const openEditCharacter = useCallback((char: Character) => {
    setEditingCharacter(char)
    setCharEditorOpen(true)
  }, [])

  const closeCharacterEditor = useCallback(() => {
    setCharEditorOpen(false)
    setEditingCharacter(null)
  }, [])

  const saveCharacter = useCallback((data: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingCharacter) {
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === editingCharacter.id
            ? { ...c, ...data, updatedAt: Date.now() }
            : c,
        ),
      )
    } else {
      const now = Date.now()
      const char: Character = {
        ...data,
        id: genId(),
        createdAt: now,
        updatedAt: now,
      }
      setCharacters((prev) => [...prev, char])
    }
    closeCharacterEditor()
  }, [editingCharacter, closeCharacterEditor])

  const deleteCharacter = useCallback((id: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const duplicateCharacter = useCallback((char: Character) => {
    const now = Date.now()
    const copy: Character = {
      ...char,
      id: genId(),
      name: `${char.name} (copy)`,
      createdAt: now,
      updatedAt: now,
    }
    setCharacters((prev) => [...prev, copy])
  }, [])

  // ── Scenes ──────────────────────────────────────
  const openNewScene = useCallback(() => {
    setEditingScene(null)
    setSceneEditorOpen(true)
  }, [])

  const openEditScene = useCallback((scene: Scene) => {
    setEditingScene(scene)
    setSceneEditorOpen(true)
  }, [])

  const closeSceneEditor = useCallback(() => {
    setSceneEditorOpen(false)
    setEditingScene(null)
  }, [])

  const saveScene = useCallback((data: Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingScene) {
      setScenes((prev) =>
        prev.map((s) =>
          s.id === editingScene.id
            ? { ...s, ...data, updatedAt: Date.now() }
            : s,
        ),
      )
    } else {
      const now = Date.now()
      const scene: Scene = {
        ...data,
        id: genId(),
        createdAt: now,
        updatedAt: now,
      }
      setScenes((prev) => [...prev, scene])
    }
    closeSceneEditor()
  }, [editingScene, closeSceneEditor])

  const deleteScene = useCallback((id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return {
    characters,
    scenes,
    charEditorOpen,
    sceneEditorOpen,
    editingCharacter,
    editingScene,
    openNewCharacter,
    openEditCharacter,
    closeCharacterEditor,
    saveCharacter,
    deleteCharacter,
    duplicateCharacter,
    openNewScene,
    openEditScene,
    closeSceneEditor,
    saveScene,
    deleteScene,
    DEFAULT_CHARACTER,
  }
}
