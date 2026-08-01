import { useState, useRef, useEffect } from 'preact/hooks'
import type { Character, CharacterProfile } from '../types'
import { DEFAULT_CHARACTER } from '../types'

const AVATARS = ['🎭', '🎪', '🎯', '🌟', '🔥', '💀', '👸', '🤴', '🧙', '🧝', '🦊', '🐉', '⚔️', '🛡️', '💎', '🌙']

/** Presets for custom fields — pre-built field sets for different genres */
const FIELD_PRESETS: { name: string; icon: string; fields: { key: string; hint: string }[] }[] = [
  {
    name: 'Fantasy / D&D',
    icon: '🐉',
    fields: [
      { key: 'Race', hint: 'e.g. Elf, Dwarf, Half-Orc' },
      { key: 'Class', hint: 'e.g. Wizard, Rogue, Paladin' },
      { key: 'Alignment', hint: 'e.g. Chaotic Good, Lawful Evil' },
      { key: 'Level', hint: 'e.g. 5, 12, Ancient' },
      { key: 'Background', hint: 'e.g. Noble, Criminal, Sage' },
      { key: 'Deity', hint: 'Who or what they worship' },
    ],
  },
  {
    name: 'Cyberpunk',
    icon: '🤖',
    fields: [
      { key: 'Role', hint: 'e.g. Netrunner, Solo, Fixer' },
      { key: 'Affiliation', hint: 'e.g. Arasaka, Maelstrom, Nomad' },
      { key: 'Chrome', hint: 'Cyberware/implants they have' },
      { key: 'Reputation', hint: 'e.g. Feared, Respected, Unknown' },
      { key: 'Home Turf', hint: 'District or zone they operate in' },
    ],
  },
  {
    name: 'Sci-Fi',
    icon: '🚀',
    fields: [
      { key: 'Species', hint: 'e.g. Human, Zorblax, Android' },
      { key: 'Faction', hint: 'e.g. Federation, Rebellion, Corp' },
      { key: 'Rank', hint: 'e.g. Captain, Ensign, Ambassador' },
      { key: 'Homeworld', hint: 'Planet or station of origin' },
      { key: 'Specialization', hint: 'e.g. Engineer, Pilot, Diplomat' },
    ],
  },
  {
    name: 'Modern',
    icon: '🏙️',
    fields: [
      { key: 'Occupation', hint: 'e.g. Detective, Journalist, Doctor' },
      { key: 'Nationality', hint: 'e.g. American, Japanese, Brazilian' },
      { key: 'Education', hint: 'e.g. PhD, Self-taught, Street-smart' },
      { key: 'Marital Status', hint: 'e.g. Single, Married, Divorced' },
      { key: 'Hometown', hint: 'City or region they come from' },
    ],
  },
  {
    name: 'Superhero',
    icon: '🦸',
    fields: [
      { key: 'Alias', hint: 'Superhero or secret identity name' },
      { key: 'Powers', hint: 'e.g. Telekinesis, Super strength' },
      { key: 'Weakness', hint: 'e.g. Kryptonite, Magic, Ego' },
      { key: 'Affiliation', hint: 'e.g. Avengers, Justice League, Solo' },
      { key: 'Origin', hint: 'How they got their powers' },
    ],
  },
  {
    name: 'Horror',
    icon: '👻',
    fields: [
      { key: 'Type', hint: 'e.g. Ghost, Vampire, Eldritch being' },
      { key: 'Weakness', hint: 'e.g. Sunlight, Silver, Faith' },
      { key: 'Domain', hint: 'Where they dwell or hold power' },
      { key: 'Victims', hint: 'Who they prey on or protect' },
      { key: 'Age', hint: 'How old / ancient they are' },
    ],
  },
  {
    name: 'Eroge / Visual Novel',
    icon: '💕',
    fields: [
      { key: 'Archetype', hint: 'e.g. Tsundere, Kuudere, Yandere, Deredere, Himedere' },
      { key: 'Height', hint: 'e.g. 158cm, Tall, Petite' },
      { key: 'Body Type', hint: 'e.g. Slim, Curvy, Athletic, Petite' },
      { key: 'Chest Size', hint: 'Cup size or descriptive (e.g. B-cup, Large, Flat). Helps AI describe physique in scenes.' },
      { key: 'Hair', hint: 'Color, length, style — e.g. Long silver hair, Short messy blonde' },
      { key: 'Eyes', hint: 'Color and shape — e.g. Deep red eyes, Big blue innocent eyes' },
      { key: 'Skin', hint: 'Tone and texture — e.g. Pale, Tan, Smooth, Freckled' },
      { key: 'Affection Level', hint: 'Starting affection toward the protagonist (e.g. Cold, Friendly, In Love)' },
      { key: 'Flustered When', hint: 'What makes them embarrassed or flustered' },
      { key: 'Likes', hint: 'Favorite things, hobbies, turn-ons' },
      { key: 'Dislikes', hint: 'Things they hate or are uncomfortable with' },
      { key: 'Catchphrase', hint: 'A signature phrase or verbal tic they often use' },
    ],
  },
]

interface Props {
  character: Character | null   // null = new
  onSave: (data: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}

function emptyProfile(): CharacterProfile {
  return { gender: '', age: '', appearance: '', traits: '', goals: '', customFields: [] }
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

  // Profile fields
  const [profileOpen, setProfileOpen] = useState(!!def.profile)
  const initProfile = def.profile ?? emptyProfile()
  const [gender, setGender] = useState(initProfile.gender ?? '')
  const [age, setAge] = useState(initProfile.age ?? '')
  const [appearance, setAppearance] = useState(initProfile.appearance ?? '')
  const [traits, setTraits] = useState(initProfile.traits ?? '')
  const [goals, setGoals] = useState(initProfile.goals ?? '')
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>(
    initProfile.customFields ?? [],
  )
  const [presetOpen, setPresetOpen] = useState(false)
  const presetRef = useRef<HTMLDivElement>(null)

  // Close preset dropdown on outside click
  useEffect(() => {
    if (!presetOpen) return
    const handler = (e: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) {
        setPresetOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [presetOpen])

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, { key: '', value: '' }])
  }

  const updateCustomField = (i: number, field: 'key' | 'value', val: string) => {
    setCustomFields((prev) =>
      prev.map((cf, idx) => (idx === i ? { ...cf, [field]: val } : cf)),
    )
  }

  const removeCustomField = (i: number) => {
    setCustomFields((prev) => prev.filter((_, idx) => idx !== i))
  }

  const loadPreset = (preset: typeof FIELD_PRESETS[number]) => {
    // Merge with existing — only add fields that don't already exist by key
    setCustomFields((prev) => {
      const existingKeys = new Set(prev.map((cf) => cf.key.toLowerCase()))
      const newFields = preset.fields
        .filter((f) => !existingKeys.has(f.key.toLowerCase()))
        .map((f) => ({ key: f.key, value: '' }))
      return [...prev, ...newFields]
    })
    setPresetOpen(false)
  }

  const buildProfile = (): CharacterProfile | undefined => {
    const hasStructured = gender || age || appearance || traits || goals
    const hasCustom = customFields.some((cf) => cf.key.trim())
    if (!hasStructured && !hasCustom) return undefined
    return {
      ...(hasStructured ? { gender: gender || undefined, age: age || undefined, appearance: appearance || undefined, traits: traits || undefined, goals: goals || undefined } : {}),
      ...(hasCustom ? { customFields: customFields.filter((cf) => cf.key.trim()).map((cf) => ({ key: cf.key.trim(), value: cf.value.trim() })) } : {}),
    }
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      avatar,
      systemPrompt: systemPrompt.trim(),
      model: model.trim(),
      temperature,
      description: description.trim(),
      profile: buildProfile(),
    })
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

          {/* ── Profile Section (collapsible) ── */}
          <div class="profile-section">
            <button
              class="profile-section__toggle"
              onClick={() => setProfileOpen(!profileOpen)}
              type="button"
            >
              <svg
                class={`profile-section__chevron ${profileOpen ? 'profile-section__chevron--open' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>Character Profile</span>
              <span class="profile-section__badge">
                {[gender, age, appearance, traits, goals].filter(Boolean).length + customFields.filter((cf) => cf.key.trim()).length} fields
              </span>
            </button>

            {profileOpen && (
              <div class="profile-section__body">
                <div class="form-row profile-row">
                  <div class="form-group">
                    <label class="form-label" for="char-gender">
                      Gender
                      <span class="profile-hint-icon" title="Use this for the character's gender identity. Pairs well with Age.">ⓘ</span>
                    </label>
                    <input id="char-gender" class="form-input" type="text" value={gender}
                      onInput={(e) => setGender((e.target as HTMLInputElement).value)}
                      placeholder="e.g. Male, Female, Non-binary" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="char-age">
                      Age
                      <span class="profile-hint-icon" title="Numeric age or descriptive range. Combine with Gender for basic demographic profile.">ⓘ</span>
                    </label>
                    <input id="char-age" class="form-input" type="text" value={age}
                      onInput={(e) => setAge((e.target as HTMLInputElement).value)}
                      placeholder="e.g. 28, ~200, Young adult" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="char-appearance">
                    Appearance
                    <span class="profile-hint-icon" title="Physical description — helps the AI describe the character in scenes. Be specific: height, build, hair, eyes, style, scars/tattoos.">ⓘ</span>
                  </label>
                  <textarea id="char-appearance" class="form-input form-textarea" value={appearance}
                    onInput={(e) => setAppearance((e.target as HTMLTextAreaElement).value)}
                    rows={2} placeholder="Height, build, hair, eyes, clothing style, distinguishing features..." />
                </div>

                <div class="form-group">
                  <label class="form-label" for="char-traits">
                    Personality Traits
                    <span class="profile-hint-icon" title="Core character traits — list 3-5 adjectives. The AI will use these to drive dialogue and behavior choices.">ⓘ</span>
                  </label>
                  <textarea id="char-traits" class="form-input form-textarea" value={traits}
                    onInput={(e) => setTraits((e.target as HTMLTextAreaElement).value)}
                    rows={2} placeholder="e.g. Brave, impulsive, loyal to a fault, secretly insecure..." />
                </div>

                <div class="form-group">
                  <label class="form-label" for="char-goals">
                    Goals & Motivations
                    <span class="profile-hint-icon" title="What the character wants. Drives the story forward — the AI will keep these in mind during roleplay.">ⓘ</span>
                  </label>
                  <textarea id="char-goals" class="form-input form-textarea" value={goals}
                    onInput={(e) => setGoals((e.target as HTMLTextAreaElement).value)}
                    rows={2} placeholder="What drives this character? What do they want?" />
                </div>

                {/* Custom fields with preset selector */}
                <div class="profile-custom">
                  <div class="profile-custom__header">
                    <span class="form-label">Custom Fields</span>
                    <div class="profile-custom__actions">
                      <div class="profile-preset-wrap" ref={presetRef}>
                        <button class="btn btn--ghost btn--small" onClick={() => setPresetOpen(!presetOpen)} type="button">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                          </svg>
                          Presets
                        </button>
                        {presetOpen && (
                          <div class="profile-preset-dropdown">
                            {FIELD_PRESETS.map((preset) => (
                              <button
                                key={preset.name}
                                class="profile-preset-item"
                                onClick={() => loadPreset(preset)}
                                type="button"
                              >
                                <span class="profile-preset-item__icon">{preset.icon}</span>
                                <div class="profile-preset-item__body">
                                  <span class="profile-preset-item__name">{preset.name}</span>
                                  <span class="profile-preset-item__fields">
                                    {preset.fields.map((f) => f.key).join(' · ')}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button class="btn btn--ghost btn--small" onClick={addCustomField} type="button">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Field
                      </button>
                    </div>
                  </div>
                  {customFields.length === 0 && (
                    <span class="form-hint" style={{ display: 'block', marginTop: -4 }}>
                      Add individual fields below, or use a <strong>Preset</strong> to pre-fill fields for a specific genre.
                    </span>
                  )}
                  {customFields.map((cf, i) => (
                    <div key={i} class="profile-custom__row">
                      <input
                        class="form-input profile-custom__key"
                        type="text"
                        value={cf.key}
                        onInput={(e) => updateCustomField(i, 'key', (e.target as HTMLInputElement).value)}
                        placeholder="Field name (e.g. Species)"
                      />
                      <input
                        class="form-input profile-custom__val"
                        type="text"
                        value={cf.value}
                        onInput={(e) => updateCustomField(i, 'value', (e.target as HTMLInputElement).value)}
                        placeholder="Value (e.g. Elf)"
                      />
                      <button class="btn btn--ghost btn--icon btn--small" onClick={() => removeCustomField(i)} title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <span class="form-hint" style={{ display: 'block' }}>
                  <strong>💡 Guide:</strong> Gender+Age form a basic demographic base. Appearance helps with scene descriptions. Traits drive dialogue/behavior. Goals push the story forward. Custom fields let you add anything genre-specific.
                </span>
              </div>
            )}
          </div>

          {/* Short description */}
          <div class="form-group">
            <label class="form-label" for="char-desc">Short Description</label>
            <textarea id="char-desc" class="form-input form-textarea" value={description}
              onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              rows={2} placeholder="A brief summary shown on the character card" />
            <span class="form-hint">One or two sentences — displayed as a preview in your character list.</span>
          </div>

          {/* System Prompt */}
          <div class="form-group">
            <label class="form-label" for="char-prompt">Roleplay Instructions (System Prompt)</label>
            <textarea id="char-prompt" class="form-input form-textarea" value={systemPrompt}
              onInput={(e) => setSystemPrompt((e.target as HTMLTextAreaElement).value)}
              rows={5} placeholder="Describe personality, speech patterns, mannerisms, backstory, goals..." />
            <span class="form-hint">
              Detailed instructions for the AI. This is combined with the Profile fields above when chatting.
            </span>
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
