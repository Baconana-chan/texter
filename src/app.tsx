import { useRef, useState, useEffect } from 'preact/hooks'
import type { AppMode, Character, Scene, FileAttachment, ImageAttachment } from './types'
import { useChat } from './hooks/useChat'
import { useProjects } from './hooks/useProjects'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { ProjectView } from './components/ProjectView'
import { CharacterEditor } from './components/CharacterEditor'
import { SceneEditor } from './components/SceneEditor'
import { SettingsDialog } from './components/SettingsDialog'
import { LockScreen } from './components/LockScreen'
import { TokenStatsDialog } from './components/TokenStats'
import { ClipboardDialog } from './components/ClipboardDialog'
import { PluginManagerDialog } from './components/PluginManagerDialog'
import { ThemeEditorDialog } from './components/ThemeEditorDialog'
import { ImageGenerator } from './components/ImageGenerator'
import { CharacterGenerator } from './components/CharacterGenerator'
import { CharacterRefiner } from './components/CharacterRefiner'
import { StatusBar } from './components/StatusBar'
import { ToastContainer } from './components/ToastContainer'
import { addToast } from './utils/toastStore'
import { applyTheme, applyPreset, clearPreset } from './utils/theme'
import { getAllPresets } from './utils/themePresetStore'
import { runMigrations } from './utils/migration'
import { loadPinHash, hashPin, savePinHash, removePinHash } from './utils/store'
import { extractCharactersFromChatbox } from './utils/importChatbox'
import './app.css'

export function App() {
  const [mode, setMode] = useState<AppMode>('chat')
  const [locked, setLocked] = useState(true)
  const [pinHashState, setPinHashState] = useState<string | null>(null)
  const [appReady, setAppReady] = useState(false)

  // Run migrations & check PIN on mount
  useEffect(() => {
    runMigrations()
      .then(() => loadPinHash())
      .then((h) => {
        setPinHashState(h)
        if (!h) setLocked(false)
      })
      .catch(() => { setLocked(false) })
      .finally(() => setAppReady(true))
  }, [])

  const handleUnlock = () => setLocked(false)

  const {
    chats,
    activeChat,
    activeChatId,
    settings,
    sidebarOpen,
    settingsOpen,
    streaming,
    editing,
    favorites,
    activeCharacter,
    setSidebarOpen,
    setSettingsOpen,
    setSettings,
    createChat,
    deleteChat,
    selectChat,
    sendMessage,
    stopStreaming,
    importChatsFromJson,
    editMessage,
    cancelEditing,
    submitEdit,
    cycleMessageVersion,
    regenerateMessage,
    exportChatsToJson,
    replyTo,
    startReplying,
    cancelReplying,
    toggleFavorite,
    saveChatsToDisk,
    providers,
    activeProviderId,
    setActiveProvider,
    addProvider,
    deleteProvider,
    updateProvider,
    switchProviderModel,
    currentProviderType,
    currentModel,
    currentApiEndpoint,
    currentApiKey,
    tokenStats,
    reorderChats,
  } = useChat()

  const {
    characters,
    scenes,
    charEditorOpen,
    sceneEditorOpen,
    openNewCharacter,
    openEditCharacter,
    closeCharacterEditor,
    saveCharacter,
    updateCharacter,
    deleteCharacter,
    duplicateCharacter,
    openNewScene,
    openEditScene,
    closeSceneEditor,
    saveScene,
    deleteScene,
    editingCharacter,
    editingScene,
  } = useProjects()

  const [statsOpen, setStatsOpen] = useState(false)
  const [clipboardOpen, setClipboardOpen] = useState(false)
  const [pluginsOpen, setPluginsOpen] = useState(false)
  const [themeEditorOpen, setThemeEditorOpen] = useState(false)
  const [imageGenOpen, setImageGenOpen] = useState(false)
  const [charGenOpen, setCharGenOpen] = useState(false)
  const [charRefineTarget, setCharRefineTarget] = useState<Character | null>(null)

  // Import dialog state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importProjectsRef = useRef<HTMLInputElement>(null)
  const [charImportOpen, setCharImportOpen] = useState(false)
  const [charImportData, setCharImportData] = useState<{ name: string; systemPrompt: string }[]>([])
  const [charImportSelected, setCharImportSelected] = useState<Set<number>>(new Set())

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)

        // Import chats
        const count = importChatsFromJson(json)
        if (count > 0) {
          addToast(`Imported ${count} chat${count > 1 ? 's' : ''}`, 'success')
        } else {
          addToast("Couldn't find any conversations in this file", 'warning')
        }

        // Check for extractable characters
        const extracted = extractCharactersFromChatbox(json)
        if (extracted.length > 0) {
          setCharImportData(extracted)
          setCharImportSelected(new Set(extracted.map((_, i) => i)))
          setCharImportOpen(true)
        }
      } catch {
        addToast('Invalid JSON file', 'error')
      }
    }
    reader.readAsText(file)
    input.value = ''
  }

  const handleSaveImportedCharacters = () => {
    for (const i of charImportSelected) {
      const data = charImportData[i]
      saveCharacter({
        name: data.name,
        avatar: '🎭',
        systemPrompt: data.systemPrompt,
        model: settings?.model ?? 'gpt-4o-mini',
        temperature: 0.8,
        description: `Imported from Chatbox — ${data.systemPrompt.slice(0, 60)}...`,
      })
    }
    setCharImportOpen(false)
    addToast(`Saved ${charImportSelected.size} character${charImportSelected.size > 1 ? 's' : ''} from import`, 'success')
  }

  const handleSetPin = async (pin: string) => {
    const h = await hashPin(pin)
    await savePinHash(h)
    setPinHashState(h)
  }

  const handleRemovePin = async () => {
    await removePinHash()
    setPinHashState(null)
  }

  // ── Saved state tracker ─────────────────────────
  const [saved, setSaved] = useState(true)
  const prevChatsRef = useRef(chats)
  useEffect(() => {
    if (prevChatsRef.current !== chats) {
      setSaved(false)
      prevChatsRef.current = chats
      const timer = setTimeout(() => setSaved(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [chats])

  // ── Apply theme, preset & chat background on mount & on settings change ─────
  useEffect(() => {
    if (!settings) return
    
    // Apply base theme (dark/light classes + accent + chat bg)
    applyTheme(settings.theme ?? 'auto', settings.accentColor ?? '#10a37f', settings.chatBackground)
    
    // Apply saved preset if one is active
    if (settings.activePresetId) {
      getAllPresets().then((all) => {
        const preset = all.find((p) => p.id === settings.activePresetId)
        if (preset) {
          applyPreset(preset.colors)
        } else {
          // Saved preset was deleted — clear and reset
          clearPreset()
          setSettings({ ...settings, activePresetId: undefined })
        }
      })
    }
  }, [settings?.theme, settings?.accentColor, settings?.chatBackground, settings?.activePresetId])

  // ── Keyboard shortcuts ────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs / contenteditable
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) {
        // Allow Ctrl+S in inputs (save action) but not Ctrl+N
        if (e.key === 'n' && (e.ctrlKey || e.metaKey)) return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        createChat()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (settings?.incognito) {
          saveChatsToDisk()
        }
        setSaved(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [createChat, settings?.incognito, saveChatsToDisk])

  // Project-Chat linking
  const handleStartChatWithCharacter = (char: Character, scene?: Scene) => {
    // Build profile block as structured JSON
    let profileBlock = ''
    if (char.profile) {
      const p = char.profile
      const fields: Record<string, string> = {}
      if (p.gender) fields.Gender = p.gender
      if (p.age) fields.Age = p.age
      if (p.appearance) fields.Appearance = p.appearance
      if (p.traits) fields['Personality Traits'] = p.traits
      if (p.goals) fields.Goals = p.goals
      if (p.customFields) {
        for (const cf of p.customFields) {
          if (cf.key) fields[cf.key] = cf.value
        }
      }
      if (Object.keys(fields).length > 0) {
        profileBlock = `\n\n[Character Profile]\n${JSON.stringify(fields, null, 2)}`
      }
    }

    const combinedPrompt = scene?.prompt
      ? `${char.systemPrompt}${profileBlock}\n\n[Context: ${scene.prompt}]`
      : `${char.systemPrompt}${profileBlock}`

    createChat({
      systemPrompt: combinedPrompt,
      model: char.model,
      characterName: char.name,
      characterAvatar: char.avatar,
    })
    setMode('chat')
  }

  // Export projects
  const handleExportProjects = () => {
    const data = JSON.stringify({ characters, scenes }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `texter-projects-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import projects
  const handleImportProjectsClick = () => {
    importProjectsRef.current?.click()
  }

  const handleImportProjects = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        let count = 0

        if (Array.isArray(json.characters)) {
          for (const c of json.characters) {
            if (c.name && c.systemPrompt) {
              saveCharacter({
                name: c.name,
                avatar: c.avatar || '🎭',
                systemPrompt: c.systemPrompt,
                model: c.model || 'gpt-4o-mini',
                temperature: c.temperature ?? 0.8,
                description: c.description || '',
              })
              count++
            }
          }
        }
        if (Array.isArray(json.scenes)) {
          for (const s of json.scenes) {
            if (s.name) {
              saveScene({
                name: s.name,
                prompt: s.prompt || '',
                description: s.description || '',
              })
              count++
            }
          }
        }

        addToast(`Imported ${count} project item${count > 1 ? 's' : ''}`, 'success')
      } catch {
        addToast('Invalid project file', 'error')
      }
    }
    reader.readAsText(file)
    input.value = ''
  }

  if (!appReady) {
    return (
      <div class="app-loading">
        <div class="spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  if (locked && pinHashState) {
    return <LockScreen pinHash={pinHashState} onUnlock={handleUnlock} />
  }

  if (!settings) {
    return (
      <div class="app-loading">
        <div class="spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div class="app">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.chatbox"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />
      <input
        ref={importProjectsRef}
        type="file"
        accept=".json"
        onChange={handleImportProjects}
        style={{ display: 'none' }}
      />

      <ToastContainer />

      {/* Incognito banner */}
      {settings.incognito && (
        <div class="incognito-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
          </svg>
          <span>Incognito — chats won't be saved when you close the app</span>
          {chats.length > 0 && (
            <button class="btn btn--primary btn--small incognito-banner__save" onClick={async () => {
              const ok = await saveChatsToDisk()
              addToast(ok ? 'Chats saved to disk' : 'Nothing to save', ok ? 'success' : 'info')
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save
            </button>
          )}
        </div>
      )}

      <div class="app__body">
        {sidebarOpen && (
          <>
            <div class="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            <Sidebar
              mode={mode}
              chats={chats}
              activeChatId={activeChatId}
              favorites={favorites}
              incognito={settings.incognito ?? false}
              onSelectChat={selectChat}
              onNewChat={() => createChat()}
              onDeleteChat={deleteChat}
              onOpenSettings={() => setSettingsOpen(true)}
            onOpenStats={() => setStatsOpen(true)}            onOpenClipboard={() => setClipboardOpen(true)}
            onPlugins={() => setPluginsOpen(true)}
            onImageGenerator={() => setImageGenOpen(true)}
            onImportChats={handleImport}
            onExportChats={exportChatsToJson}
              onSwitchMode={(m) => setMode(m)}
              onClose={() => setSidebarOpen(false)}
              onReorderChats={reorderChats}
            />
          </>
        )}

        {mode === 'chat' && (
          <ChatView
            chat={activeChat}
            chats={chats}
            streaming={streaming}
            editing={editing}
            activeCharacter={activeCharacter}
            onSend={(payload: { content: string; fileAttach?: FileAttachment; imageAttach?: ImageAttachment }) => sendMessage(payload.content, payload.fileAttach, payload.imageAttach)}
            onStop={stopStreaming}
            onOpenSidebar={() => setSidebarOpen(true)}
            onEditMessage={editMessage}
            onCancelEdit={cancelEditing}
            onSubmitEdit={submitEdit}
            onCycleVersion={cycleMessageVersion}
            onRegenerate={regenerateMessage}
            replying={replyTo}
            onReply={(msgId, chatId, preview) => startReplying(msgId, chatId, preview)}
            onCancelReply={cancelReplying}
            onToggleFavorite={toggleFavorite}
            providers={providers}
            activeProviderId={activeProviderId}
            currentModel={currentModel}
            onSwitchProvider={setActiveProvider}
            onSwitchModel={(model) => {
              if (activeProviderId) switchProviderModel(activeProviderId, model)
            }}              ocrLanguage={settings.ocrLanguage}
              sttLanguage={({ 'auto': undefined, en: 'en-US', ru: 'ru-RU', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-BR', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', ar: 'ar-SA', nl: 'nl-NL', pl: 'pl-PL', sv: 'sv-SE', tr: 'tr-TR', uk: 'uk-UA', vi: 'vi-VN', th: 'th-TH', hi: 'hi-IN' } as Record<string, string | undefined>)[settings.responseLanguage ?? 'auto']}
          />
        )}

        {mode === 'projects' && (
          <ProjectView
            characters={characters}
            scenes={scenes}
            onNewCharacter={openNewCharacter}
            onEditCharacter={openEditCharacter}
            onDeleteCharacter={deleteCharacter}
            onDuplicateCharacter={duplicateCharacter}
            onGenerateCharacters={() => setCharGenOpen(true)}
            onRefineCharacter={(char) => setCharRefineTarget(char)}
            onNewScene={openNewScene}
            onEditScene={openEditScene}
            onDeleteScene={deleteScene}
            onSwitchToChat={() => setMode('chat')}
            onStartChatWithCharacter={handleStartChatWithCharacter}
            onExportProjects={handleExportProjects}
            onImportProjects={handleImportProjectsClick}
          />
        )}
      </div>

      <StatusBar
        mode={mode}
        chatCount={chats.length}
        incognito={settings.incognito ?? false}
        saved={saved}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Import characters dialog */}
      {charImportOpen && charImportData.length > 0 && (
        <div class="dialog-overlay" onClick={() => setCharImportOpen(false)}>
          <div class="dialog" onClick={(e) => e.stopPropagation()}>
            <div class="dialog__header">
              <h2 class="dialog__title">Import Characters</h2>
              <button class="btn btn--ghost btn--icon" onClick={() => setCharImportOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div class="dialog__body">
              <p class="form-hint" style={{ margin: 0 }}>
                Found {charImportData.length} system prompt{charImportData.length > 1 ? 's' : ''} in the imported file.
                Select which ones to save as characters:
              </p>
              {charImportData.map((item, i) => (
                <label key={i} class="char-import-item">
                  <input
                    type="checkbox"
                    checked={charImportSelected.has(i)}
                    onChange={() => {
                      const next = new Set(charImportSelected)
                      if (next.has(i)) next.delete(i); else next.add(i)
                      setCharImportSelected(next)
                    }}
                  />
                  <div class="char-import-item__body">
                    <span class="char-import-item__name">{item.name}</span>
                    <span class="char-import-item__prompt">{item.systemPrompt.slice(0, 120)}{item.systemPrompt.length > 120 ? '...' : ''}</span>
                  </div>
                </label>
              ))}
            </div>
            <div class="dialog__footer">
              <button class="btn btn--ghost" onClick={() => setCharImportOpen(false)}>Skip</button>
              <button class="btn btn--primary" onClick={handleSaveImportedCharacters} disabled={charImportSelected.size === 0}>
                Save {charImportSelected.size} to Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {charGenOpen && (
        <CharacterGenerator
          providerType={currentProviderType}
          apiEndpoint={currentApiEndpoint}
          apiKey={currentApiKey}
          model={currentModel}
          onSave={(chars) => {
            for (const c of chars) saveCharacter(c)
            setCharGenOpen(false)
            addToast(`Saved ${chars.length} character${chars.length > 1 ? 's' : ''} to library`, 'success')
          }}
          onClose={() => setCharGenOpen(false)}
        />
      )}

      {charRefineTarget && (
        <CharacterRefiner
          character={charRefineTarget}
          providerType={currentProviderType}
          apiEndpoint={currentApiEndpoint}
          apiKey={currentApiKey}
          model={currentModel}
          onApply={(id, updates) => {
            updateCharacter(id, {
              name: updates.name ?? charRefineTarget.name,
              avatar: updates.avatar ?? charRefineTarget.avatar,
              description: updates.description ?? charRefineTarget.description,
              systemPrompt: updates.systemPrompt ?? charRefineTarget.systemPrompt,
              temperature: updates.temperature ?? charRefineTarget.temperature,
              profile: updates.profile ?? charRefineTarget.profile,
            })
            setCharRefineTarget(null)
            addToast(`Updated ${updates.name || charRefineTarget.name}`, 'success')
          }}
          onClose={() => setCharRefineTarget(null)}
        />
      )}

      {charEditorOpen && (
        <CharacterEditor
          character={editingCharacter}
          onSave={saveCharacter}
          onClose={closeCharacterEditor}
        />
      )}
      {sceneEditorOpen && (
        <SceneEditor
          scene={editingScene}
          onSave={saveScene}
          onClose={closeSceneEditor}
        />
      )}

      {statsOpen && tokenStats && (
        <TokenStatsDialog
          stats={tokenStats}
          onClose={() => setStatsOpen(false)}
        />
      )}

      {clipboardOpen && (
        <ClipboardDialog
          onClose={() => setClipboardOpen(false)}
        />
      )}

      {themeEditorOpen && (
        <ThemeEditorDialog
          onClose={() => setThemeEditorOpen(false)}
          onApplyColors={(colors, presetId) => {
            applyPreset(colors)
            // Save the active preset ID to settings
            setSettings({ ...settings!, activePresetId: presetId })
            setThemeEditorOpen(false)
          }}
        />
      )}

      {pluginsOpen && (
        <PluginManagerDialog
          onClose={() => setPluginsOpen(false)}
        />
      )}

      {imageGenOpen && (
        <ImageGenerator
          apiEndpoint={currentApiEndpoint}
          apiKey={currentApiKey}
          defaultModel={currentModel}
          onClose={() => setImageGenOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          onSave={setSettings}
          onClose={() => setSettingsOpen(false)}
          pinHash={pinHashState}
          onSetPin={handleSetPin}
          onRemovePin={handleRemovePin}
          providers={providers}
          activeProviderId={activeProviderId}
          onAddProvider={addProvider}
          onDeleteProvider={deleteProvider}
          onUpdateProvider={updateProvider}
          onSetActiveProvider={setActiveProvider}
        />
      )}
    </div>
  )
}
