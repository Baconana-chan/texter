import type { Plugin } from '../utils/pluginStore'

interface PluginEditorProps {
  plugin?: Partial<Plugin>
  onSave: (data: { name: string; description: string; type: 'pre' | 'post'; code: string }) => void
  onClose: () => void
}

export function PluginEditor({ plugin, onSave, onClose }: PluginEditorProps) {
  let name = plugin?.name ?? ''
  let description = plugin?.description ?? ''
  let type: 'pre' | 'post' = plugin?.type ?? 'pre'
  let code = plugin?.code ?? ''

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div class="dialog__header">
          <h2 class="dialog__title">{plugin?.id ? 'Edit Plugin' : 'New Plugin'}</h2>
          <button class="btn btn--ghost btn--icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="dialog__body">
          <div class="form-group">
            <label class="form-label" for="plugin-name">Name</label>
            <input
              id="plugin-name"
              class="form-input"
              type="text"
              value={name}
              onInput={(e) => { name = (e.target as HTMLInputElement).value; (e.target as HTMLInputElement).dataset.val = name }}
              placeholder="e.g. Format as haiku"
              onChange={(e) => { name = (e.target as HTMLInputElement).value }}
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="plugin-desc">Description</label>
            <input
              id="plugin-desc"
              class="form-input"
              type="text"
              value={description}
              onInput={(e) => { description = (e.target as HTMLInputElement).value; (e.target as HTMLInputElement).dataset.val = description }}
              placeholder="What does this plugin do?"
              onChange={(e) => { description = (e.target as HTMLInputElement).value }}
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="plugin-type">Type</label>
            <select
              id="plugin-type"
              class="form-input"
              value={type}
              onChange={(e) => { type = (e.target as HTMLSelectElement).value as 'pre' | 'post' }}
            >
              <option value="pre">🔧 Pre-processor (modifies user message before sending)</option>
              <option value="post">⚙️ Post-processor (modifies AI response after receiving)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="plugin-code">Code</label>
            <div class="plugin-editor__hint">
              Your function receives <code>context</code> with <code>{'{ content, messages }'}</code> and must return <code>{'{ content: string }'}</code>.
            </div>
            <textarea
              id="plugin-code"
              class="form-input plugin-editor__textarea"
              value={code}
              onInput={(e) => { code = (e.target as HTMLTextAreaElement).value; (e.target as HTMLTextAreaElement).dataset.val = code }}
              onChange={(e) => { code = (e.target as HTMLTextAreaElement).value }}
              rows={10}
              spellcheck={false}
              placeholder={`// Example: Capitalize everything
return {
  content: context.content.toUpperCase()
}`}
            />
          </div>

          <details class="plugin-editor__docs">
            <summary>📖 API Reference</summary>
            <div class="plugin-editor__docs-body">
              <h4>Context object</h4>
              <table class="plugin-docs-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>context.content</code></td>
                    <td><code>string</code></td>
                    <td>The current message text</td>
                  </tr>
                  <tr>
                    <td><code>context.messages</code></td>
                    <td><code>{'{ role, content }[]'}</code></td>
                    <td>Chat history (read-only, last N messages)</td>
                  </tr>
                </tbody>
              </table>

              <h4>Return value</h4>
              <p>Must return an object: <code>{'{ content: string }'}</code></p>

              <h4>Examples</h4>
              <pre class="plugin-editor__example">{`// Pre: Add timestamp to every message
return {
  content: \`[\\${new Date().toLocaleTimeString()}]: \${context.content}\`
}

// Post: Remove markdown bold formatting
return {
  content: context.content.replace(/\\*\\*/g, '')
}

// Post: Word count check
const wordCount = context.content.split(/\\s+/).length
if (wordCount < 50) {
  return { content: context.content + '\\n\\n_^(Word count: ' + wordCount + ')_' }
}
return { content: context.content }`}</pre>
            </div>
          </details>
        </div>

        <div class="dialog__footer">
          <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button
            class="btn btn--primary"
            onClick={() => {
              // Read values from DOM since Preact may not have updated local vars
              const nameEl = document.getElementById('plugin-name') as HTMLInputElement
              const descEl = document.getElementById('plugin-desc') as HTMLInputElement
              const typeEl = document.getElementById('plugin-type') as HTMLSelectElement
              const codeEl = document.getElementById('plugin-code') as HTMLTextAreaElement
              onSave({
                name: nameEl?.value || name || 'Unnamed Plugin',
                description: descEl?.value || description || '',
                type: (typeEl?.value || type) as 'pre' | 'post',
                code: codeEl?.value || code || 'return { content: context.content }',
              })
            }}
          >
            {plugin?.id ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
