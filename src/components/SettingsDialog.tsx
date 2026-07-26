import { useState, useEffect } from 'preact/hooks'
import type { AppSettings, Provider, ProviderType } from '../types'
import { restoreFromBackups } from '../utils/migration'
import { addToast } from '../utils/toastStore'
import { DEFAULT_SETTINGS, ACCENT_COLORS, CHAT_BACKGROUNDS } from '../types'
import { formatTokens, parseTokens } from '../utils/format'
import { isLanguageCached, preCacheLanguage } from '../utils/ocr'
import { loadVoices, onVoicesChanged, getVoices, setVoiceURI, setRate, getSettings } from '../utils/tts'

interface SettingsDialogProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  onClose: () => void
  pinHash?: string | null
  onSetPin?: (pin: string) => Promise<void>
  onRemovePin?: () => Promise<void>
  providers?: Provider[]
  activeProviderId?: string | null
  onAddProvider?: (p: Provider) => void
  onDeleteProvider?: (id: string) => void
  onUpdateProvider?: (id: string, data: Partial<Provider>) => void
  onSetActiveProvider?: (id: string) => void
  onOpenThemeEditor?: () => void
}

export function SettingsDialog({ settings, onSave, onClose, pinHash, onSetPin, onRemovePin, providers, activeProviderId, onAddProvider, onDeleteProvider, onUpdateProvider, onSetActiveProvider, onOpenThemeEditor }: SettingsDialogProps) {
  const [local, setLocal] = useState<AppSettings>({ ...settings })
  const [showKey, setShowKey] = useState(false)

  // String inputs for token fields so partial typing doesn't re-format
  const [ctxInput, setCtxInput] = useState(String(settings.maxContext))
  const [outInput, setOutInput] = useState(String(settings.maxOutput))
  const [pinSection, setPinSection] = useState<'none' | 'set' | 'change' | 'remove'>('none')
  const [pinInput, setPinInput] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [showNewProvider, setShowNewProvider] = useState(false)
  const [newProvName, setNewProvName] = useState('')
  const [newProvType, setNewProvType] = useState<ProviderType>('openai')
  const [newProvEndpoint, setNewProvEndpoint] = useState('')
  const [newProvKey, setNewProvKey] = useState('')
  const [newProvModel, setNewProvModel] = useState('gpt-4o-mini')

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }))
  }

  const commitTokens = () => {
    const ctx = parseTokens(ctxInput)
    const out = parseTokens(outInput)
    if (ctx > 0) update('maxContext', ctx)
    if (out > 0) update('maxOutput', out)
    // Re-sync string fields to the committed numeric values
    setCtxInput(String(ctx > 0 ? ctx : local.maxContext))
    setOutInput(String(out > 0 ? out : local.maxOutput))
  }

  const handleSave = () => {
    const ctx = parseTokens(ctxInput)
    const out = parseTokens(outInput)
    onSave({
      ...local,
      incognito: local.incognito ?? false,
      maxContext: ctx > 0 ? ctx : local.maxContext,
      maxOutput: out > 0 ? out : local.maxOutput,
    })
    onClose()
  }

  const handleReset = () => {
    setLocal({ ...DEFAULT_SETTINGS })
    setCtxInput(String(DEFAULT_SETTINGS.maxContext))
    setOutInput(String(DEFAULT_SETTINGS.maxOutput))
  }

  const handlePinSubmit = async () => {
    if (pinSection === 'remove') {
      if (!onRemovePin) return
      setPinLoading(true)
      try {
        await onRemovePin()
        setPinSection('none')
        setPinInput('')
      } catch { setPinError('Failed to remove PIN') }
      setPinLoading(false)
      return
    }

    if (!onSetPin) return

    if (pinInput.length < 4) {
      setPinError('PIN must be at least 4 characters')
      return
    }
    if (pinInput !== pinConfirm) {
      setPinError('PINs do not match')
      return
    }
    setPinLoading(true)
    setPinError('')
    try {
      await onSetPin(pinInput)
      setPinSection('none')
      setPinInput('')
      setPinConfirm('')
    } catch { setPinError('Failed to save PIN') }
    setPinLoading(false)
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog" onClick={(e) => e.stopPropagation()}>
        <div class="dialog__header">
          <h2 class="dialog__title">Settings</h2>
          <button class="btn btn--ghost btn--icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="dialog__body">
          <div class="form-group">
            <label class="form-label" for="api-key">API Key</label>
            <div class="input-with-toggle">
              <input
                id="api-key"
                class="form-input"
                type={showKey ? 'text' : 'password'}
                value={local.apiKey}
                onInput={(e) => update('apiKey', (e.target as HTMLInputElement).value)}
                placeholder="sk-..."
              />
              <button
                class="btn btn--ghost btn--icon btn--small toggle-vis"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide' : 'Show'}
              >
                {showKey ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="api-endpoint">API Endpoint</label>
            <input
              id="api-endpoint"
              class="form-input"
              type="text"
              value={local.apiEndpoint}
              onInput={(e) => update('apiEndpoint', (e.target as HTMLInputElement).value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="model">Model</label>
            <input
              id="model"
              class="form-input"
              type="text"
              value={local.model}
              onInput={(e) => update('model', (e.target as HTMLInputElement).value)}
              placeholder="gpt-4o-mini"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="system-prompt">System Prompt</label>
            <textarea
              id="system-prompt"
              class="form-input form-textarea"
              value={local.systemPrompt}
              onInput={(e) => update('systemPrompt', (e.target as HTMLTextAreaElement).value)}
              rows={3}
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="response-language">Response Language</label>
            <select
              id="response-language"
              class="form-input"
              value={local.responseLanguage ?? DEFAULT_SETTINGS.responseLanguage}
              onChange={(e) => update('responseLanguage', (e.target as HTMLSelectElement).value)}
            >
              <option value="auto">🌐 Auto (follow prompt)</option>
              <option value="en">🇬🇧 English</option>
              <option value="ru">🇷🇺 Russian</option>
              <option value="de">🇩🇪 German</option>
              <option value="fr">🇫🇷 French</option>
              <option value="es">🇪🇸 Spanish</option>
              <option value="it">🇮🇹 Italian</option>
              <option value="pt">🇵🇹 Portuguese</option>
              <option value="ja">🇯🇵 Japanese</option>
              <option value="ko">🇰🇷 Korean</option>
              <option value="zh">🇨🇳 Chinese</option>
              <option value="ar">🇸🇦 Arabic</option>
              <option value="nl">🇳🇱 Dutch</option>
              <option value="pl">🇵🇱 Polish</option>
              <option value="sv">🇸🇪 Swedish</option>
              <option value="tr">🇹🇷 Turkish</option>
              <option value="uk">🇺🇦 Ukrainian</option>
              <option value="vi">🇻🇳 Vietnamese</option>
              <option value="th">🇹🇭 Thai</option>
              <option value="hi">🇮🇳 Hindi</option>
            </select>
            <p class="settings__hint">
              When set to a specific language, the model will be instructed to always respond in that language.
            </p>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="temperature">Temperature: {local.temperature}</label>
              <input
                id="temperature"
                class="form-range"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={local.temperature}
                onInput={(e) => update('temperature', parseFloat((e.target as HTMLInputElement).value))}
              />
            </div>
          </div>

          <div class="form-row form-row--tokens">
            <div class="form-group">
              <label class="form-label" for="max-context">
                Context <span class="form-hint">{formatTokens(local.maxContext)}</span>
              </label>
              <input
                id="max-context"
                class="form-input"
                type="text"
                inputmode="numeric"
                value={ctxInput}
                onInput={(e) => setCtxInput((e.target as HTMLInputElement).value)}
                onBlur={commitTokens}
                placeholder="e.g. 1050000 or 1.05M"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="max-output">
                Max Output <span class="form-hint">{formatTokens(local.maxOutput)}</span>
              </label>
              <input
                id="max-output"
                class="form-input"
                type="text"
                inputmode="numeric"
                value={outInput}
                onInput={(e) => setOutInput((e.target as HTMLInputElement).value)}
                onBlur={commitTokens}
                placeholder="e.g. 384000 or 384K"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="max-reasoning">
              Max Reasoning Tokens <span class="form-hint">{local.maxReasoningTokens ?? 0 ? formatTokens(local.maxReasoningTokens ?? 0) : 'Unlimited'}</span>
            </label>
            <input
              id="max-reasoning"
              class="form-input"
              type="number"
              min="0"
              step="1024"
              value={local.maxReasoningTokens ?? 0}
              onInput={(e) => update('maxReasoningTokens', Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0))}
              placeholder="0 = unlimited"
            />
            <p class="settings__hint">
              Limits the model's reasoning/thinking tokens (DeepSeek R1, GLM, etc.). Set to 0 for no limit.
              A lower value preserves more tokens for the actual response.
            </p>
          </div>
          {/* Incognito toggle */}
          <div class="settings__section">
            <label class="form-label settings__section-title">Privacy</label>
            <label class="settings__toggle">
              <input
                type="checkbox"
                checked={local.incognito ?? false}
                onChange={() => update('incognito', !(local.incognito ?? false))}
              />
              <span class="settings__toggle-track">
                <span class="settings__toggle-knob" />
              </span>
              <span class="form-label settings__toggle-label">Incognito Mode</span>
            </label>
            <p class="settings__hint">When enabled, chats won't be saved to disk and will be lost when you close the app.</p>
          </div>

          {/* Auto-title & Suggestions toggles */}
          <div class="settings__section">
            <label class="form-label settings__section-title">Response Features</label>
            <label class="settings__toggle">
              <input
                type="checkbox"
                checked={local.autoTitle ?? DEFAULT_SETTINGS.autoTitle}
                onChange={() => update('autoTitle', !(local.autoTitle ?? DEFAULT_SETTINGS.autoTitle))}
              />
              <span class="settings__toggle-track">
                <span class="settings__toggle-knob" />
              </span>
              <span class="form-label settings__toggle-label">Auto-title new chats</span>
            </label>
            <p class="settings__hint">The model will suggest a short title for new conversations based on the first message.</p>

            <label class="settings__toggle">
              <input
                type="checkbox"
                checked={local.showSuggestions ?? DEFAULT_SETTINGS.showSuggestions}
                onChange={() => update('showSuggestions', !(local.showSuggestions ?? DEFAULT_SETTINGS.showSuggestions))}
              />
              <span class="settings__toggle-track">
                <span class="settings__toggle-knob" />
              </span>
              <span class="form-label settings__toggle-label">Follow-up suggestions</span>
            </label>
            <p class="settings__hint">After each response, the model will suggest 3 follow-up questions. Click one to send it.</p>
          </div>

          {/* Theme Settings */}
          <div class="settings__section">
            <label class="form-label settings__section-title">Theme</label>
            <select
              class="form-input"
              value={local.theme ?? 'auto'}
              onChange={(e) => update('theme', (e.target as HTMLSelectElement).value as 'auto' | 'light' | 'dark')}
            >
              <option value="auto">🌓 Auto (follow system)</option>
              <option value="light">☀️ Light</option>
              <option value="dark">🌙 Dark</option>
            </select>
            <label class="form-label" style={{ marginTop: 8 }}>Accent Color</label>
            <div class="accent-picker">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.color}
                  class={`accent-picker__swatch ${(local.accentColor ?? '#10a37f') === c.color ? 'accent-picker__swatch--active' : ''}`}
                  style={{ backgroundColor: c.color }}
                  onClick={() => update('accentColor', c.color)}
                  title={c.name}
                  aria-label={c.name}
                />
              ))}
            </div>
            <button class="btn btn--ghost btn--small" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={() => { onOpenThemeEditor?.() }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Advanced Theme Editor
            </button>
          </div>

          {/* Chat Background */}
          <div class="settings__section">
            <label class="form-label settings__section-title">Chat Background</label>
            <div class="bg-options">
              {CHAT_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.name}
                  class={`bg-option ${(local.chatBackground ?? '') === bg.value ? 'bg-option--active' : ''}`}
                  onClick={() => update('chatBackground', bg.value)}
                  title={bg.name}
                >
                  <span class={`bg-option__preview ${bg.value ? '' : 'bg-option__preview--none'}`}
                    style={bg.value ? { background: bg.value } : undefined}
                  />
                  <span class="bg-option__name">{bg.name}</span>
                </button>
              ))}
              {/* Upload custom image */}
              <label class="bg-option bg-option--upload" title="Upload image">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      const dataUrl = ev.target?.result as string
                      update('chatBackground', `url(${dataUrl})`)
                    }
                    reader.readAsDataURL(file)
                    ;(e.target as HTMLInputElement).value = ''
                  }}
                />
                <span class="bg-option__preview bg-option__preview--upload">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </span>
                <span class="bg-option__name">Upload</span>
              </label>
              {/* Reset button */}
              {local.chatBackground && local.chatBackground !== '' && !CHAT_BACKGROUNDS.some((bg) => bg.value === local.chatBackground) && (
                <button class="bg-option bg-option--custom" onClick={() => update('chatBackground', '')} title="Remove custom background">
                  <span class="bg-option__preview" style={{ background: local.chatBackground, backgroundSize: 'cover' }} />
                  <span class="bg-option__name">Custom</span>
                </button>
              )}
            </div>
            {local.chatBackground && local.chatBackground.startsWith('url(') && (
              <p class="settings__hint">
                <button class="btn btn--ghost btn--small" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => update('chatBackground', '')}>
                  Remove image
                </button>
              </p>
            )}
          </div>

          {/* TTS Settings */}
          <div class="settings__section">
            <label class="form-label settings__section-title">Text-to-Speech</label>
            <VoiceSelector />
            <div class="form-group">
              <label class="form-label" for="tts-rate">Speech Rate: {getSettings().rate.toFixed(1)}x</label>
              <input
                id="tts-rate"
                class="form-range"
                type="range"
                min="0.25"
                max="3"
                step="0.25"
                value={getSettings().rate}
                onInput={(e) => setRate(parseFloat((e.target as HTMLInputElement).value))}
              />
            </div>
            <p class="settings__hint">Uses your system's built-in speech engine. Voice quality depends on your OS.</p>
          </div>

          {/* OCR Language */}
          <OcrLanguageSettings lang={local.ocrLanguage ?? DEFAULT_SETTINGS.ocrLanguage} onChange={(v) => update('ocrLanguage', v)} />

          {/* PIN section */}
          <div class="settings__section">
            <label class="form-label settings__section-title">PIN Lock</label>
            {pinSection === 'none' && (
              <div class="settings__pin-actions">
                {pinHash ? (
                  <>
                    <p class="settings__pin-status">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      PIN is enabled
                    </p>
                    <button class="btn btn--ghost btn--small" onClick={() => { setPinSection('change'); setPinError('') }}>
                      Change PIN
                    </button>
                    <button class="btn btn--ghost btn--small" onClick={() => { setPinSection('remove'); setPinError('') }}>
                      Remove PIN
                    </button>
                  </>
                ) : (
                  <button class="btn btn--ghost btn--small" onClick={() => { setPinSection('set'); setPinError('') }}>
                    Set PIN
                  </button>
                )}
              </div>
            )}
            {(pinSection === 'set' || pinSection === 'change') && (
              <div class="settings__pin-form">
                <input
                  class="form-input"
                  type="password"
                  value={pinInput}
                  onInput={(e) => { setPinError(''); setPinInput((e.target as HTMLInputElement).value) }}
                  placeholder="New PIN (4+ characters)"
                  maxLength={10}
                />
                <input
                  class="form-input"
                  type="password"
                  value={pinConfirm}
                  onInput={(e) => { setPinError(''); setPinConfirm((e.target as HTMLInputElement).value) }}
                  placeholder="Confirm PIN"
                  maxLength={10}
                />
                {pinError && <p class="settings__pin-error">{pinError}</p>}
                <div class="settings__pin-form-actions">
                  <button class="btn btn--ghost btn--small" onClick={() => { setPinSection('none'); setPinInput(''); setPinConfirm(''); setPinError('') }}>
                    Cancel
                  </button>
                  <button class="btn btn--primary btn--small" onClick={handlePinSubmit} disabled={pinLoading || !pinInput || !pinConfirm}>
                    {pinLoading ? 'Saving...' : 'Save PIN'}
                  </button>
                </div>
              </div>
            )}
            {pinSection === 'remove' && (
              <div class="settings__pin-form">
                <p class="settings__pin-warning">Are you sure you want to remove the PIN lock?</p>
                {pinError && <p class="settings__pin-error">{pinError}</p>}
                <div class="settings__pin-form-actions">
                  <button class="btn btn--ghost btn--small" onClick={() => { setPinSection('none'); setPinError('') }}>
                    Cancel
                  </button>
                  <button class="btn btn--danger btn--small" onClick={handlePinSubmit} disabled={pinLoading}>
                    {pinLoading ? 'Removing...' : 'Remove PIN'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Providers section */}
          <div class="settings__section">
            <label class="form-label settings__section-title">Providers</label>

            {providers && providers.map((p) => (
              <div key={p.id} class="settings__provider-item">
                <div class="settings__provider-info">
                  <label class="settings__provider-radio">
                    <input
                      type="radio"
                      name="active-provider"
                      checked={p.id === activeProviderId}
                      onChange={() => onSetActiveProvider?.(p.id)}
                    />
                    <span class="settings__provider-name">{p.name}</span>
                  </label>
                  <span class="settings__provider-endpoint">{p.apiEndpoint.replace(/^https?:\/\//, '').replace(/\/v1$/, '')}</span>
                </div>
                <div class="settings__provider-actions">
                  <button
                    class="btn btn--ghost btn--small"
                    onClick={() => {
                      const newName = prompt('Provider name:', p.name)
                      if (newName && newName.trim()) onUpdateProvider?.(p.id, { name: newName.trim() })
                    }}
                  >Rename</button>
                  <button
                    class="btn btn--ghost btn--small"
                    onClick={() => {
                      const newKey = prompt('API Key:', p.apiKey)
                      if (newKey !== null) onUpdateProvider?.(p.id, { apiKey: newKey })
                    }}
                  >Key</button>
                  <button
                    class="btn btn--ghost btn--small"
                    onClick={() => {
                      const newEndpoint = prompt('API Endpoint:', p.apiEndpoint)
                      if (newEndpoint && newEndpoint.trim()) onUpdateProvider?.(p.id, { apiEndpoint: newEndpoint.trim() })
                    }}
                  >Endpoint</button>
                  {providers.length > 1 && (
                    <button class="btn btn--ghost btn--small settings__provider-delete" onClick={() => onDeleteProvider?.(p.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {showNewProvider ? (
              <div class="settings__new-provider">
                <input class="form-input" type="text" value={newProvName}
                  onInput={(e) => setNewProvName((e.target as HTMLInputElement).value)}
                  placeholder="Provider name (e.g. Groq)" />

                <label class="form-label" style={{ marginTop: 4 }}>API Type</label>
                <div class="settings__provider-types">
                  {([
                    { id: 'openai' as const, label: 'OpenAI', desc: 'OpenAI / OpenRouter / DeepSeek / Groq' },
                    { id: 'anthropic' as const, label: 'Anthropic', desc: 'Claude (Sonnet, Haiku, Opus)' },
                    { id: 'google' as const, label: 'Google', desc: 'Gemini (Flash, Pro)' },
                  ]).map((t) => (
                    <button
                      key={t.id}
                      class={`settings__provider-type-btn ${newProvType === t.id ? 'settings__provider-type-btn--active' : ''}`}
                      onClick={() => {
                        setNewProvType(t.id)
                        // Set default endpoint + model based on type
                        if (t.id === 'openai') {
                          setNewProvEndpoint('https://api.openai.com/v1')
                          setNewProvModel('gpt-4o-mini')
                        } else if (t.id === 'anthropic') {
                          setNewProvEndpoint('https://api.anthropic.com')
                          setNewProvModel('claude-sonnet-4-20250514')
                        } else if (t.id === 'google') {
                          setNewProvEndpoint('https://generativelanguage.googleapis.com')
                          setNewProvModel('gemini-2.5-flash-latest')
                        }
                      }}
                    >
                      <span class="settings__provider-type-label">{t.label}</span>
                      <span class="settings__provider-type-desc">{t.desc}</span>
                    </button>
                  ))}
                </div>

                <input class="form-input" type="text" value={newProvEndpoint}
                  onInput={(e) => setNewProvEndpoint((e.target as HTMLInputElement).value)}
                  placeholder={newProvType === 'anthropic' ? 'https://api.anthropic.com' : newProvType === 'google' ? 'https://generativelanguage.googleapis.com' : 'https://api.openai.com/v1'} />
                <input class="form-input" type="password" value={newProvKey}
                  onInput={(e) => setNewProvKey((e.target as HTMLInputElement).value)}
                  placeholder="API Key" />
                <input class="form-input" type="text" value={newProvModel}
                  onInput={(e) => setNewProvModel((e.target as HTMLInputElement).value)}
                  placeholder="Default model (e.g. gpt-4o-mini)" />
                <div class="settings__new-provider-actions">
                  <button class="btn btn--ghost btn--small" onClick={() => setShowNewProvider(false)}>Cancel</button>
                  <button class="btn btn--primary btn--small" onClick={() => {
                    if (!newProvName.trim() || !newProvEndpoint.trim()) return
                    onAddProvider?.({
                      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                      name: newProvName.trim(),
                      type: newProvType,
                      apiEndpoint: newProvEndpoint.trim().replace(/\/$/, ''),
                      apiKey: newProvKey,
                      activeModel: newProvModel.trim() || 'gpt-4o-mini',
                      createdAt: Date.now(),
                    })
                    setShowNewProvider(false)
                    setNewProvName('')
                    setNewProvType('openai')
                    setNewProvEndpoint('')
                    setNewProvKey('')
                    setNewProvModel('gpt-4o-mini')
                  }}>Add</button>
                </div>
              </div>
            ) : (
              <button class="btn btn--ghost btn--small" onClick={() => setShowNewProvider(true)}>
                + Add Provider
              </button>
            )}
          </div>
          {/* Safety section */}
          <div class="settings__section">
            <label class="form-label settings__section-title">Data Safety</label>
            <p class="settings__hint">
              Before each schema migration, automatic backups are created for settings, chats, providers and stats.
              If something went wrong during an update, you can restore from the last backup.
            </p>
            <button class="btn btn--ghost btn--small" onClick={async () => {
              const ok = await restoreFromBackups()
              if (ok) {
                addToast('Restored from backup — reload the app', 'success')
              } else {
                addToast('No backups found', 'info')
              }
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Restore from last backup
            </button>
          </div>
        </div>

        <div class="dialog__footer">
          <button class="btn btn--ghost" onClick={handleReset}>
            Reset Defaults
          </button>
          <div class="dialog__footer-right">
            <button class="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button class="btn btn--primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Voice Selector component ───────────────────────

function VoiceSelector() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [currentVoice, setCurrentVoice] = useState(getSettings().voiceURI)

  useEffect(() => {
    // Load voices immediately (may be empty on first call)
    setVoices(getVoices())

    // Listen for async voice loading
    const unsub = onVoicesChanged(() => {
      setVoices([...getVoices()])
    })

    // Also try loading synchronously in case voices are already available
    loadVoices()
    const v = getVoices()
    if (v.length > 0) setVoices(v)

    return unsub
  }, [])

  const handleChange = (voiceURI: string) => {
    setVoiceURI(voiceURI)
    setCurrentVoice(voiceURI)
  }

  return (
    <div class="form-group" style={{ marginBottom: 8 }}>
      <label class="form-label" for="tts-voice">Voice</label>
      <select
        id="tts-voice"
        class="form-input"
        value={currentVoice}
        onChange={(e) => handleChange((e.target as HTMLSelectElement).value)}
      >
        <option value="">🌐 System default</option>
        {voices.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name} ({v.lang}){v.localService ? ' 💻' : ' ☁️'}
          </option>
        ))}
      </select>
      {voices.length === 0 && (
        <p class="settings__hint">Loading voices... (check your system TTS settings)</p>
      )}
    </div>
  )
}

// ── OCR Language Settings (with pre-cache) ────────

const OCR_LANG_OPTIONS = [
  { value: 'eng', label: 'English (eng)' },
  { value: 'eng+rus', label: 'English + Russian (eng+rus)' },
  { value: 'rus', label: 'Russian (rus)' },
  { value: 'deu', label: 'German (deu)' },
  { value: 'fra', label: 'French (fra)' },
  { value: 'spa', label: 'Spanish (spa)' },
  { value: 'ita', label: 'Italian (ita)' },
  { value: 'por', label: 'Portuguese (por)' },
  { value: 'jpn', label: 'Japanese (jpn)' },
  { value: 'kor', label: 'Korean (kor)' },
  { value: 'chi_sim', label: 'Chinese Simplified (chi_sim)' },
  { value: 'chi_tra', label: 'Chinese Traditional (chi_tra)' },
  { value: 'ara', label: 'Arabic (ara)' },
  { value: 'nld', label: 'Dutch (nld)' },
  { value: 'pol', label: 'Polish (pol)' },
  { value: 'swe', label: 'Swedish (swe)' },
  { value: 'tur', label: 'Turkish (tur)' },
  { value: 'ukr', label: 'Ukrainian (ukr)' },
  { value: 'vie', label: 'Vietnamese (vie)' },
  { value: 'tha', label: 'Thai (tha)' },
  { value: 'hin', label: 'Hindi (hin)' },
]

function OcrLanguageSettings({ lang, onChange }: { lang?: string; onChange: (v: string) => void }) {
  const effectiveLang = lang ?? 'eng+rus'
  const [cacheStatus, setCacheStatus] = useState<'unknown' | 'cached' | 'not-cached' | 'downloading'>('unknown')
  const [dlProgress, setDlProgress] = useState(0)
  const [dlTotal, setDlTotal] = useState(0)

  // Check cache status when language changes
  useEffect(() => {
    setCacheStatus('unknown')
    isLanguageCached(effectiveLang).then((cached) => {
      setCacheStatus(cached ? 'cached' : 'not-cached')
    }).catch(() => setCacheStatus('not-cached'))
  }, [lang])

  const handlePreCache = async () => {
    setCacheStatus('downloading')
    setDlProgress(0)
    setDlTotal(0)

    await preCacheLanguage(effectiveLang, (loaded, total) => {
      setDlProgress(loaded)
      setDlTotal(total)
    })

    // Re-check cache status
    setCacheStatus('cached')
    setDlProgress(0)
    setDlTotal(0)
  }

  return (
    <div class="settings__section">
      <label class="form-label settings__section-title">OCR Language</label>
      <select
        class="form-input"
        value={lang}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      >
        {OCR_LANG_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Cache status + pre-cache button */}
      <div class="ocr-cache-row">
        {cacheStatus === 'cached' && (
          <span class="ocr-cache-status ocr-cache-status--ok">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M12 2a10 10 0 1 0 10 10" />
              <polyline points="22 2 12 12" />
            </svg>
            Cached
          </span>
        )}
        {cacheStatus === 'not-cached' && (
          <span class="ocr-cache-status ocr-cache-status--missing">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Not cached
          </span>
        )}
        {cacheStatus === 'downloading' && (
          <span class="ocr-cache-status ocr-cache-status--dl">
            <svg class="ocr-cache-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
            </svg>
            {dlTotal > 0
              ? `Downloading ${(dlProgress / 1024 / 1024).toFixed(1)} / ${(dlTotal / 1024 / 1024).toFixed(1)} MB`
              : 'Downloading...'}
          </span>
        )}

        {cacheStatus === 'not-cached' && (
          <button class="btn btn--ghost btn--small" onClick={handlePreCache}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Pre-cache
          </button>
        )}
        {cacheStatus === 'cached' && (
          <span class="btn btn--ghost btn--small" style={{ opacity: 0.6, cursor: 'default' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Ready
          </span>
        )}
      </div>

      <p class="settings__hint">
        Language(s) for OCR text recognition. Use <code>+</code> for multiple (e.g. <code>eng+deu+fra</code>).<br />
        First-time use downloads ~10 MB per language from CDN. Pre-cache now to avoid waiting later.
      </p>
    </div>
  )
}
