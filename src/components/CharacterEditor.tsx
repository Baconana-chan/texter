import { useState } from 'preact/hooks'
import type { Character } from '../types'
import { DEFAULT_CHARACTER } from '../types'

const AVATARS = ['🎭', '🎪', '🎯', '🌟', '🔥', '💀', '👸', '🤴', '🧙', '🧝', '🦊', '🐉', '⚔️', '🛡️', '💎', '🌙']

interface Props {
  character: Character | null   // null = new
  onSave: (data: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}

export function CharacterEditor({ character, onSave, onClose }: Props) {
  const def = character ?? DEFAULT_CHARACTER
  const [name, setName] = useState(def.name)
  const [avatar, setAvatar] = useState(def.avatar)
  const [systemPrompt, setSystemPrompt] = useState(def.systemPrompt)
  const [model, setModel] = useState(def.model)
  const [temperature, setTemperature] = useState(def.temperature)
  const [description, setDescription] = useState(def.description)
  const [showPicker, setShowPicker] = useState(false)

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), avatar, systemPrompt: systemPrompt.trim(), model: model.trim(), temperature, description: description.trim() })
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div class="dialog__header">
          <h2 class="dialog__title">{character ? 'Edit Character' : 'New Character'}</h2>
          <button class="btn btn--ghost btn--icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="dialog__body">
          {/* Avatar + Name */}
          <div class="form-row">
            <div class="char-editor__avatar-section">
              <label class="form-label">Avatar</label>
              <button class="char-editor__avatar-btn" onClick={() => setShowPicker(!showPicker)}>
                <span class="char-editor__avatar-emoji">{avatar}</span>
              </button>
              {showPicker && (
                <div class="char-editor__avatar-grid">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      class={`char-editor__avatar-option ${a === avatar ? 'char-editor__avatar-option--active' : ''}`}
                      onClick={() => { setAvatar(a); setShowPicker(false) }}
                    >{a}</button>
                  ))}
                </div>
              )}
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label" for="char-name">Name</label>
              <input id="char-name" class="form-input" type="text" value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="Character name" />
            </div>
          </div>

          {/* Description */}
          <div class="form-group">
            <label class="form-label" for="char-desc">Description</label>
            <textarea id="char-desc" class="form-input form-textarea" value={description}
              onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              rows={2} placeholder="Brief description of the character" />
          </div>

          {/* System Prompt */}
          <div class="form-group">
            <label class="form-label" for="char-prompt">System Prompt</label>
            <textarea id="char-prompt" class="form-input form-textarea" value={systemPrompt}
              onInput={(e) => setSystemPrompt((e.target as HTMLTextAreaElement).value)}
              rows={5} placeholder="Describe personality, behavior, style..." />
          </div>

          {/* Model + Temperature */}
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="char-model">Model</label>
              <input id="char-model" class="form-input" type="text" value={model}
                onInput={(e) => setModel((e.target as HTMLInputElement).value)}
                placeholder="openai/gpt-4o-mini" />
            </div>
            <div class="form-group">
              <label class="form-label" for="char-temp">Temperature: {temperature}</label>
              <input id="char-temp" class="form-range" type="range" min="0" max="2" step="0.1"
                value={temperature}
                onInput={(e) => setTemperature(parseFloat((e.target as HTMLInputElement).value))} />
            </div>
          </div>
        </div>

        <div class="dialog__footer">
          <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button class="btn btn--primary" onClick={handleSave} disabled={!name.trim()}>Save</button>
        </div>
      </div>
    </div>
  )
}
