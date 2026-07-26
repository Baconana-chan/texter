import { useState, useEffect, useRef } from 'preact/hooks'
import type { ThemePreset } from '../types'
import { COLOR_KEY_GROUPS, DEFAULT_THEME_PRESETS } from '../types'
import { getAllPresets, addPreset, updatePreset, deletePreset, duplicatePreset } from '../utils/themePresetStore'

interface ThemeEditorDialogProps {
  onClose: () => void
  onApplyColors: (colors: Record<string, string>, presetId?: string) => void
}

export function ThemeEditorDialog({ onClose, onApplyColors }: ThemeEditorDialogProps) {
  const [presets, setPresets] = useState<ThemePreset[]>([])
  const [activeId, setActiveId] = useState<string>('texter-light')
  const [editColors, setEditColors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load presets on mount
  useEffect(() => {
    getAllPresets().then((all) => {
      setPresets(all)
      const active = all.find((p) => p.id === activeId) ?? all[0]
      if (active) {
        setEditColors({ ...active.colors })
      }
    })
  }, [])

  const activePreset = presets.find((p) => p.id === activeId)
  const isBuiltIn = activePreset ? DEFAULT_THEME_PRESETS.some((d) => d.id === activeId) : false

  // Switch to a preset
  const handleSelectPreset = (id: string) => {
    setActiveId(id)
    const p = presets.find((pr) => pr.id === id)
    if (p) setEditColors({ ...p.colors })
    setRenaming(null)
  }

  // Update a single color
  const handleColorInput = (key: string, value: string) => {
    setEditColors((prev) => ({ ...prev, [key]: value }))
  }

  // Apply the current colors to the app
  const handleApply = () => {
    onApplyColors(editColors, activePreset?.id !== 'texter-light' && activePreset?.id !== 'texter-dark' ? activePreset?.id : undefined)
  }

  // Save current colors as a new preset
  const handleSaveAs = async () => {
    const name = prompt('Preset name:', activePreset?.name ? `${activePreset.name} (modified)` : 'My Custom Theme')
    if (!name?.trim()) return
    setSaving(true)
    await addPreset(name.trim(), editColors)
    const all = await getAllPresets()
    setPresets(all)
    setActiveId(all[all.length - 1].id)
    setSaving(false)
  }

  // Update existing custom preset
  const handleUpdate = async () => {
    if (!activePreset || isBuiltIn) return
    setSaving(true)
    await updatePreset(activeId, { colors: editColors })
    const all = await getAllPresets()
    setPresets(all)
    setSaving(false)
  }

  // Delete a custom preset
  const handleDelete = async () => {
    if (!activePreset || isBuiltIn) return
    if (!confirm(`Delete "${activePreset.name}"?`)) return
    await deletePreset(activeId)
    const all = await getAllPresets()
    setPresets(all)
    setActiveId('texter-light')
    const light = all.find((p) => p.id === 'texter-light')
    if (light) setEditColors({ ...light.colors })
  }

  // Duplicate active preset
  const handleDuplicate = async () => {
    if (!activePreset) return
    const name = prompt('Name for duplicate:', `${activePreset.name} Copy`)
    if (!name?.trim()) return
    await duplicatePreset(activePreset, name.trim())
    const all = await getAllPresets()
    setPresets(all)
    setActiveId(all[all.length - 1].id)
  }

  // Export all presets as JSON
  const handleExport = () => {
    const data = JSON.stringify(presets, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `texter-themes-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import presets from JSON
  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string)
        if (Array.isArray(imported)) {
          for (const p of imported) {
            if (p.name && p.colors) {
              await addPreset(p.name, p.colors)
            }
          }
          const all = await getAllPresets()
          setPresets(all)
        }
      } catch {
        // ignore invalid imports
      }
    }
    reader.readAsText(file)
    input.value = ''
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog dialog--theme-editor" onClick={(e) => e.stopPropagation()}>
        <div class="dialog__header">
          <h2 class="dialog__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Theme Editor
          </h2>
          <div class="dialog__header-actions">
            <button class="btn btn--ghost btn--icon" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div class="dialog__body">
          {/* Preset selector */}
          <div class="theme-editor__presets">
            <div class="theme-editor__presets-header">
              <span class="form-label">Presets</span>
              <div class="theme-editor__preset-actions">
                <button class="btn btn--ghost btn--small" onClick={handleExport} title="Export all presets">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export
                </button>
                <button class="btn btn--ghost btn--small" onClick={handleImport} title="Import presets from JSON">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Import
                </button>
              </div>
            </div>
            <div class="theme-editor__preset-list">
              {presets.map((p) => (
                <div
                  key={p.id}
                  class={`theme-editor__preset ${p.id === activeId ? 'theme-editor__preset--active' : ''}`}
                  onClick={() => handleSelectPreset(p.id)}
                >
                  <div class="theme-editor__preset-swatches">
                    <span class="theme-editor__swatch" style={{ background: p.colors['--bg'] ?? 'var(--bg)' }} />
                    <span class="theme-editor__swatch" style={{ background: p.colors['--bg-secondary'] ?? 'var(--bg-secondary)' }} />
                    <span class="theme-editor__swatch" style={{ background: p.colors['--text'] ?? 'var(--text)' }} />
                    <span class="theme-editor__swatch" style={{ background: p.colors['--border'] ?? 'var(--border)' }} />
                  </div>
                  <div class="theme-editor__preset-info">
                    {renaming === p.id ? (
                      <input
                        class="form-input"
                        type="text"
                        value={renameValue}
                        onInput={(e) => setRenameValue((e.target as HTMLInputElement).value)}
                        onBlur={async () => {
                          if (renameValue.trim() && renameValue.trim() !== p.name && !DEFAULT_THEME_PRESETS.some((d) => d.id === p.id)) {
                            await updatePreset(p.id, { name: renameValue.trim() })
                            const all = await getAllPresets()
                            setPresets(all)
                          }
                          setRenaming(null)
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            if (renameValue.trim() && renameValue.trim() !== p.name && !DEFAULT_THEME_PRESETS.some((d) => d.id === p.id)) {
                              await updatePreset(p.id, { name: renameValue.trim() })
                              const all = await getAllPresets()
                              setPresets(all)
                            }
                            setRenaming(null)
                          }
                          if (e.key === 'Escape') setRenaming(null)
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 12, padding: '2px 6px' }}
                      />
                    ) : (
                      <span class="theme-editor__preset-name">{p.name}</span>
                    )}
                    <span class="theme-editor__preset-badge">
                      {DEFAULT_THEME_PRESETS.some((d) => d.id === p.id) ? 'Built-in' : 'Custom'}
                    </span>
                  </div>
                  {p.id === activeId && (
                    <div class="theme-editor__preset-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div class="theme-editor__preset-actions-row">
              <button class="btn btn--ghost btn--small" onClick={handleSaveAs} disabled={saving}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
                Save As
              </button>
              {!isBuiltIn && (
                <button class="btn btn--ghost btn--small" onClick={handleUpdate} disabled={saving}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34" />
                    <polygon points="18 2 22 6 12 16 8 16 8 12 18 2" />
                  </svg>
                  Update
                </button>
              )}
              <button class="btn btn--ghost btn--small" onClick={handleDuplicate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Duplicate
              </button>
              {!isBuiltIn && (
                <button class="btn btn--ghost btn--small theme-editor__delete-btn" onClick={handleDelete}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Color editor */}
          <div class="theme-editor__colors">
            {COLOR_KEY_GROUPS.map((group) => (
              <div key={group.label} class="theme-editor__group">
                <div class="theme-editor__group-title">{group.label}</div>
                <div class="theme-editor__group-colors">
                  {group.keys.map((key) => {
                    const cssVar = `--${key}`
                    const val = editColors[cssVar] ?? ''
                    return (
                      <div key={key} class="theme-editor__color-row">
                        <div class="theme-editor__color-preview" style={{ background: val || 'transparent' }} />
                        <div class="theme-editor__color-info">
                          <label class="theme-editor__color-label">{cssVar}</label>
                          <input
                            class="theme-editor__color-input"
                            type="text"
                            value={val}
                            onInput={(e) => handleColorInput(cssVar, (e.target as HTMLInputElement).value)}
                            placeholder="#hex or rgb(...)"
                            spellcheck={false}
                          />
                        </div>
                        <input
                          class="theme-editor__color-picker"
                          type="color"
                          value={val || '#000000'}
                          onInput={(e) => handleColorInput(cssVar, (e.target as HTMLInputElement).value)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div class="dialog__footer">
          <div class="dialog__footer-right">
            <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button class="btn btn--primary" onClick={handleApply}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Apply Theme
            </button>
          </div>
        </div>

        {/* Hidden file input for import */}
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelected} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
