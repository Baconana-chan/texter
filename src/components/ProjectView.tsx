import { useState } from 'preact/hooks'
import type { Character, Scene } from '../types'

interface Props {
  characters: Character[]
  scenes: Scene[]
  onNewCharacter: () => void
  onEditCharacter: (char: Character) => void
  onDeleteCharacter: (id: string) => void
  onDuplicateCharacter: (char: Character) => void
  onNewScene: () => void
  onEditScene: (scene: Scene) => void
  onDeleteScene: (id: string) => void
  onSwitchToChat: () => void
  onStartChatWithCharacter?: (char: Character, scene?: Scene) => void
  onExportProjects?: () => void
  onImportProjects?: () => void
}

export function ProjectView({
  characters,
  scenes,
  onNewCharacter,
  onEditCharacter,
  onDeleteCharacter,
  onDuplicateCharacter,
  onNewScene,
  onEditScene,
  onDeleteScene,
  onSwitchToChat,
  onStartChatWithCharacter,
  onExportProjects,
  onImportProjects,
}: Props) {
  const [tab, setTab] = useState<'characters' | 'scenes'>('characters')
  const [selectedScene, setSelectedScene] = useState<string | null>(null)

  return (
    <main class="project-view">
      <header class="project-view__header">
        <h1 class="project-view__title">Projects</h1>
        <div class="project-view__header-actions">
          {onImportProjects && (
            <button class="btn btn--ghost btn--small" onClick={onImportProjects} title="Import projects">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Import
            </button>
          )}
          {onExportProjects && (
            <button class="btn btn--ghost btn--small" onClick={onExportProjects} title="Export projects">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Export
            </button>
          )}
          <button class="btn btn--ghost btn--icon" onClick={onSwitchToChat} title="Back to chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </header>

      <div class="project-view__tabs">
        <button
          class={`project-view__tab ${tab === 'characters' ? 'project-view__tab--active' : ''}`}
          onClick={() => setTab('characters')}
        >
          Characters ({characters.length})
        </button>
        <button
          class={`project-view__tab ${tab === 'scenes' ? 'project-view__tab--active' : ''}`}
          onClick={() => setTab('scenes')}
        >
          Scenes ({scenes.length})
        </button>
      </div>

      <div class="project-view__body">
        {tab === 'characters' && (
          <CharactersTab
            characters={characters}
            scenes={scenes}
            selectedScene={selectedScene}
            onSelectScene={setSelectedScene}
            onNew={onNewCharacter}
            onEdit={onEditCharacter}
            onDelete={onDeleteCharacter}
            onDuplicate={onDuplicateCharacter}
            onStartChat={onStartChatWithCharacter}
          />
        )}
        {tab === 'scenes' && (
          <ScenesTab
            scenes={scenes}
            onNew={onNewScene}
            onEdit={onEditScene}
            onDelete={onDeleteScene}
          />
        )}
      </div>
    </main>
  )
}

function CharactersTab({
  characters,
  scenes,
  selectedScene,
  onSelectScene,
  onNew,
  onEdit,
  onDelete,
  onDuplicate,
  onStartChat,
}: {
  characters: Character[]
  scenes: Scene[]
  selectedScene: string | null
  onSelectScene: (id: string | null) => void
  onNew: () => void
  onEdit: (c: Character) => void
  onDelete: (id: string) => void
  onDuplicate: (c: Character) => void
  onStartChat?: (char: Character, scene?: Scene) => void
}) {
  if (characters.length === 0) {
    return (
      <div class="project-view__empty">
        <span class="project-view__empty-icon">🎭</span>
        <h3>No characters yet</h3>
        <p>Create your first character to start roleplaying</p>
        <button class="btn btn--primary" onClick={onNew}>Create Character</button>
      </div>
    )
  }

  return (
    <div>
      {/* Scene selector for chat context */}
      {onStartChat && scenes.length > 0 && (
        <div class="pv-scene-picker">
          <label class="form-label">Optional scene context:</label>
          <select
            class="form-input pv-scene-select"
            value={selectedScene ?? ''}
            onChange={(e) => onSelectScene((e.target as HTMLSelectElement).value || null)}
          >
            <option value="">— No scene —</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div class="project-view__grid">
        {characters.map((char) => {
          const scene = selectedScene ? scenes.find((s) => s.id === selectedScene) : undefined
          return (
            <div key={char.id} class="project-card">
              <div class="project-card__avatar">{char.avatar}</div>
              <div class="project-card__body">
                <h3 class="project-card__name">{char.name}</h3>
                {char.description && <p class="project-card__desc">{char.description}</p>}
                <span class="project-card__model">{char.model}</span>
                {char.systemPrompt && (
                  <div class="project-card__prompt-preview">
                    {char.systemPrompt.slice(0, 100)}{char.systemPrompt.length > 100 ? '...' : ''}
                  </div>
                )}
                {scene && (
                  <div class="project-card__scene-badge">
                    🎬 {scene.name}
                  </div>
                )}
              </div>
              <div class="project-card__actions">
                {onStartChat && (
                  <button
                    class="btn btn--primary btn--small project-card__start-btn"
                    onClick={() => onStartChat(char, scene)}
                    title="Start chat with this character"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Chat
                  </button>
                )}
                <button class="btn btn--ghost btn--icon btn--small" onClick={() => onEdit(char)} title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button class="btn btn--ghost btn--icon btn--small" onClick={() => onDuplicate(char)} title="Duplicate">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button class="btn btn--ghost btn--icon btn--small" onClick={() => onDelete(char.id)} title="Delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
        <button class="project-card project-card--new" onClick={onNew}>
          <span class="project-card__new-icon">+</span>
          <span>New Character</span>
        </button>
      </div>
    </div>
  )
}

function ScenesTab({
  scenes,
  onNew,
  onEdit,
  onDelete,
}: {
  scenes: Scene[]
  onNew: () => void
  onEdit: (s: Scene) => void
  onDelete: (id: string) => void
}) {
  if (scenes.length === 0) {
    return (
      <div class="project-view__empty">
        <span class="project-view__empty-icon">🎬</span>
        <h3>No scenes yet</h3>
        <p>Save scenario prompts to quickly set the mood</p>
        <button class="btn btn--primary" onClick={onNew}>Create Scene</button>
      </div>
    )
  }

  return (
    <div class="project-view__grid">
      {scenes.map((scene) => (
        <div key={scene.id} class="project-card">
          <div class="project-card__body">
            <h3 class="project-card__name">{scene.name}</h3>
            {scene.description && <p class="project-card__desc">{scene.description}</p>}
            {scene.prompt && (
              <div class="project-card__prompt-preview">{scene.prompt.slice(0, 120)}{scene.prompt.length > 120 ? '...' : ''}</div>
            )}
          </div>
          <div class="project-card__actions">
            <button class="btn btn--ghost btn--icon btn--small" onClick={() => onEdit(scene)} title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
            <button class="btn btn--ghost btn--icon btn--small" onClick={() => onDelete(scene.id)} title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      <button class="project-card project-card--new" onClick={onNew}>
        <span class="project-card__new-icon">+</span>
        <span>New Scene</span>
      </button>
    </div>
  )
}
