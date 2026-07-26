import { useState, useEffect, useRef } from 'preact/hooks'
import {
  getPlugins,
  subscribe,
  register,
  unregister,
  togglePlugin,
  updatePlugin,
  type Plugin,
} from '../utils/pluginStore'
import { addToast } from '../utils/toastStore'
import { PluginEditor } from './PluginEditor'

interface PluginManagerDialogProps {
  onClose: () => void
}

export function PluginManagerDialog({ onClose }: PluginManagerDialogProps) {
  const [plugins, setPlugins] = useState<Plugin[]>(getPlugins())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPlugin, setEditingPlugin] = useState<Plugin | undefined>(undefined)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = subscribe(setPlugins)
    return unsub
  }, [])

  const handleNew = () => {
    setEditingPlugin(undefined)
    setEditorOpen(true)
  }

  const handleEdit = (p: Plugin) => {
    setEditingPlugin(p)
    setEditorOpen(true)
  }

  const handleSave = (data: { name: string; description: string; type: 'pre' | 'post'; code: string }) => {
    if (editingPlugin?.id) {
      updatePlugin(editingPlugin.id, data)
    } else {
      register({ ...data, enabled: true })
    }
    setEditorOpen(false)
    setEditingPlugin(undefined)
  }

  // ── Export ────────────────────────────────────────
  const handleExportPlugins = () => {
    if (plugins.length === 0) {
      addToast('No plugins to export', 'warning')
      return
    }
    const data = JSON.stringify(plugins, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `texter-plugins-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    addToast(`Exported ${plugins.length} plugin${plugins.length > 1 ? 's' : ''}`, 'success')
  }

  // ── Import ────────────────────────────────────────
  const handleImportPlugins = () => {
    importRef.current?.click()
  }

  const handleImportFile = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        const items = Array.isArray(data) ? data : [data]
        let count = 0

        for (const item of items) {
          if (item.name && item.code && (item.type === 'pre' || item.type === 'post')) {
            register({
              name: item.name,
              description: item.description || '',
              type: item.type,
              code: item.code,
              enabled: item.enabled !== undefined ? item.enabled : true,
            })
            count++
          }
        }

        if (count > 0) {
          addToast(`Imported ${count} plugin${count > 1 ? 's' : ''}`, 'success')
        } else {
          addToast('No valid plugins found in file', 'warning')
        }
      } catch {
        addToast('Invalid plugins file', 'error')
      }
    }
    reader.readAsText(file)
    input.value = ''
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this plugin?')) {
      unregister(id)
    }
  }

  const preCount = plugins.filter((p) => p.type === 'pre').length
  const postCount = plugins.filter((p) => p.type === 'post').length
  const enabledCount = plugins.filter((p) => p.enabled).length

  return (
    <>
      <div class="dialog-overlay" onClick={onClose}>
        <div class="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
          <div class="dialog__header">
            <h2 class="dialog__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style={{ verticalAlign: 'middle', marginRight: 8 }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Plugins & Scripts
            </h2>
            <div class="dialog__header-actions">
              <button class="btn btn--ghost btn--small" onClick={handleExportPlugins} title="Export all plugins">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export
              </button>
              <button class="btn btn--ghost btn--small" onClick={handleImportPlugins} title="Import plugins from JSON">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import
              </button>
              <button class="btn btn--ghost btn--icon" onClick={onClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div class="dialog__body">
            {/* Stats bar */}
            <div class="plugin-stats">
              <span class="plugin-stats__item">
                <span class="plugin-stats__count">{plugins.length}</span>
                Total
              </span>
              <span class="plugin-stats__item">
                <span class="plugin-stats__count plugin-stats__count--pre">{preCount}</span>
                Pre
              </span>
              <span class="plugin-stats__item">
                <span class="plugin-stats__count plugin-stats__count--post">{postCount}</span>
                Post
              </span>
              <span class="plugin-stats__item">
                <span class="plugin-stats__count plugin-stats__count--active">{enabledCount}</span>
                Active
              </span>
            </div>

            {/* Plugin list */}
            {plugins.length === 0 ? (
              <div class="plugin-empty">
                <div class="plugin-empty__icon">🧩</div>
                <p>No plugins yet</p>
                <p class="plugin-empty__hint">
                  Plugins are JavaScript functions that run before sending a message (pre-processor) or after receiving a response (post-processor).
                </p>
                <button class="btn btn--primary" onClick={handleNew}>
                  Create your first plugin
                </button>
              </div>
            ) : (
              <div class="plugin-list">
                {/* Pre-processors section */}
                {preCount > 0 && (
                  <>
                    <div class="plugin-list__section-title">🔧 Pre-processors</div>
                    {plugins.filter((p) => p.type === 'pre').map((p) => (
                      <PluginCard
                        key={p.id}
                        plugin={p}
                        onEdit={() => handleEdit(p)}
                        onDelete={() => handleDelete(p.id)}
                        onToggle={() => togglePlugin(p.id)}
                      />
                    ))}
                  </>
                )}

                {/* Post-processors section */}
                {postCount > 0 && (
                  <>
                    <div class="plugin-list__section-title">⚙️ Post-processors</div>
                    {plugins.filter((p) => p.type === 'post').map((p) => (
                      <PluginCard
                        key={p.id}
                        plugin={p}
                        onEdit={() => handleEdit(p)}
                        onDelete={() => handleDelete(p.id)}
                        onToggle={() => togglePlugin(p.id)}
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {plugins.length > 0 && (
              <div class="plugin-add-row">
                <button class="btn btn--ghost" onClick={handleNew}>
                  + Add Plugin
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input ref={importRef} type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />

      {editorOpen && (
        <PluginEditor
          plugin={editingPlugin ? { ...editingPlugin } : undefined}
          onSave={handleSave}
          onClose={() => { setEditorOpen(false); setEditingPlugin(undefined) }}
        />
      )}
    </>
  )
}

// ── Plugin Card ───────────────────────────────────

function PluginCard({ plugin, onEdit, onDelete, onToggle }: {
  plugin: Plugin
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  return (
    <div class={`plugin-card ${plugin.enabled ? '' : 'plugin-card--disabled'}`}>
      <div class="plugin-card__header">
        <label class="settings__toggle plugin-card__toggle">
          <input
            type="checkbox"
            checked={plugin.enabled}
            onChange={onToggle}
          />
          <span class="settings__toggle-track">
            <span class="settings__toggle-knob" />
          </span>
        </label>
        <div class="plugin-card__info">
          <div class="plugin-card__name">{plugin.name}</div>
          <div class="plugin-card__meta">
            <span class={`plugin-card__badge plugin-card__badge--${plugin.type}`}>
              {plugin.type === 'pre' ? 'Pre' : 'Post'}
            </span>
            {plugin.description && (
              <span class="plugin-card__desc">{plugin.description}</span>
            )}
          </div>
        </div>
        <div class="plugin-card__actions">
          <TooltipBtn label="Edit" onClick={onEdit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </TooltipBtn>
          <TooltipBtn label="Delete" onClick={onDelete}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </TooltipBtn>
        </div>
      </div>
      <div class="plugin-card__preview">
        <code>{plugin.code.slice(0, 120)}{plugin.code.length > 120 ? '...' : ''}</code>
      </div>
    </div>
  )
}

// ── Tiny tooltip wrapper (inline, not the shared one) ──────────

function TooltipBtn({ label, onClick, children }: { label: string; onClick: () => void; children: any }) {
  return (
    <span class="tooltip-wrap">
      <button class="btn btn--ghost btn--icon btn--small" onClick={onClick}>
        {children}
      </button>
      <span class="tooltip" role="tooltip">{label}</span>
    </span>
  )
}
