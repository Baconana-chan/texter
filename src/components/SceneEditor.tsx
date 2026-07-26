import { useState } from 'preact/hooks'
import type { Scene } from '../types'

interface Props {
  scene: Scene | null
  onSave: (data: Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}

export function SceneEditor({ scene, onSave, onClose }: Props) {
  const [name, setName] = useState(scene?.name ?? '')
  const [prompt, setPrompt] = useState(scene?.prompt ?? '')
  const [description, setDescription] = useState(scene?.description ?? '')

  const handleSave = () => {
    if (!name.trim()) return
    onSave({ name: name.trim(), prompt: prompt.trim(), description: description.trim() })
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog" onClick={(e) => e.stopPropagation()}>
        <div class="dialog__header">
          <h2 class="dialog__title">{scene ? 'Edit Scene' : 'New Scene'}</h2>
          <button class="btn btn--ghost btn--icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="dialog__body">
          <div class="form-group">
            <label class="form-label" for="scene-name">Scene Name</label>
            <input id="scene-name" class="form-input" type="text" value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="e.g., Morning at the beach" />
          </div>
          <div class="form-group">
            <label class="form-label" for="scene-desc">Description</label>
            <input id="scene-desc" class="form-input" type="text" value={description}
              onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
              placeholder="Brief description of the scene" />
          </div>
          <div class="form-group">
            <label class="form-label" for="scene-prompt">Scenario Prompt</label>
            <textarea id="scene-prompt" class="form-input form-textarea" value={prompt}
              onInput={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
              rows={6}
              placeholder="Describe the setting, mood, and situation. This will be sent as context to the AI along with the character's system prompt." />
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
