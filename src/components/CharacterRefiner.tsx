import { useState, useRef } from 'preact/hooks'
import type { Character, ProviderType } from '../types'
import { generateText } from '../utils/api'

interface Props {
  character: Character
  providerType: ProviderType
  apiEndpoint: string
  apiKey: string
  model: string
  onApply: (id: string, updates: Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>>) => void
  onClose: () => void
}

export function CharacterRefiner({ character, providerType, apiEndpoint, apiKey, model, onApply, onClose }: Props) {
  const [instruction, setInstruction] = useState('')
  const [generating, setGenerating] = useState(false)
  const [parsedResult, setParsedResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleGenerate = async () => {
    if (!instruction.trim() || !apiKey) return
    setGenerating(true)
    setError(null)
    setParsedResult(null)

    const abort = new AbortController()
    abortRef.current = abort

    const profile = character.profile ?? {}
    const systemMsg = `You are a creative character editor. You refine and improve character profiles based on user requests.`
    const userMsg = `Here is the current character:

Name: ${character.name}
Avatar (emoji): ${character.avatar}
Description: ${character.description}
System Prompt (roleplay instructions): ${character.systemPrompt}
Model: ${character.model}
Temperature: ${character.temperature}

Profile fields:
Gender: ${profile.gender ?? ''}
Age: ${profile.age ?? ''}
Appearance: ${profile.appearance ?? ''}
Personality Traits: ${profile.traits ?? ''}
Goals: ${profile.goals ?? ''}
${(profile.customFields ?? []).length > 0 ? 'Custom fields:\n' + (profile.customFields ?? []).map((cf: { key: string; value: string }) => `  ${cf.key}: ${cf.value}`).join('\n') : ''}

The user wants to refine this character with the following request:
"${instruction.trim()}"

Return ONLY valid JSON — no markdown, no code fences, no extra text. Use exactly this format:
{
  "name": "updated name or keep same",
  "avatar": "updated emoji or keep same",
  "description": "updated 1-2 sentence description or keep same",
  "systemPrompt": "updated detailed roleplay instructions or keep same",
  "temperature": 0.8,
  "profile": {
    "gender": "updated or keep same",
    "age": "updated or keep same",
    "appearance": "updated or keep same",
    "traits": "updated or keep same",
    "goals": "updated or keep same"
  }
}

Guidelines:
- avatar must be a single emoji character
- Keep the character's core identity unless the user explicitly asks to change it
- Make the system prompt detailed and in second person ("You are...")
- Temperature should be between 0 and 2
- Include ALL profile fields (fill with existing values if not changing)`

    try {
      const text = await generateText(
        providerType,
        apiEndpoint,
        apiKey,
        model,
        [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg },
        ],
        abort.signal,
        0.9,
      )

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch?.[0] ?? text
      const parsed = JSON.parse(jsonStr)

      if (!parsed.name || !parsed.systemPrompt) {
        throw new Error('Invalid response: missing name or systemPrompt')
      }

      setParsedResult(parsed)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const handleApply = () => {
    if (!parsedResult) return
    const profileData = parsedResult.profile as Record<string, unknown> | undefined
    onApply(character.id, {
      name: (parsedResult.name as string) || character.name,
      avatar: (parsedResult.avatar as string) || character.avatar,
      description: (parsedResult.description as string) || character.description,
      systemPrompt: (parsedResult.systemPrompt as string) || character.systemPrompt,
      temperature: typeof parsedResult.temperature === 'number' ? parsedResult.temperature : character.temperature,
      profile: profileData
        ? {
            gender: (profileData.gender as string) || character.profile?.gender,
            age: (profileData.age as string) || character.profile?.age,
            appearance: (profileData.appearance as string) || character.profile?.appearance,
            traits: (profileData.traits as string) || character.profile?.traits,
            goals: (profileData.goals as string) || character.profile?.goals,
            customFields: character.profile?.customFields,
          }
        : character.profile,
    })
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div class="dialog__header">
          <h2 class="dialog__title">Refine: {character.name}</h2>
          <button class="btn btn--ghost btn--icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="dialog__body">
          {/* Current character preview */}
          <div class="refiner-current">
            <span class="refiner-current__avatar">{character.avatar}</span>
            <div class="refiner-current__info">
              <strong>{character.name}</strong>
              {character.description && <span>{character.description}</span>}
            </div>
          </div>

          {/* Input */}
          <div class="form-group">
            <label class="form-label" for="refine-instr">
              What would you like to change or add?
            </label>
            <textarea
              id="refine-instr"
              class="form-input form-textarea"
              value={instruction}
              onInput={(e) => setInstruction((e.target as HTMLTextAreaElement).value)}
              rows={3}
              placeholder='e.g. "Make his personality darker and more mysterious" or "Add a detailed backstory in 3 sentences"'
              disabled={generating}
            />
          </div>

          {/* Loading */}
          {generating && (
            <div class="refiner-loading">
              <div class="spinner" />
              <span>Refining character...</span>
            </div>
          )}

          {/* Diff preview */}
          {parsedResult && !generating && (
            <div class="refiner-diff">
              <p class="form-hint" style={{ margin: '0 0 8px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Preview changes:
              </p>
              <div class="refiner-diff__fields">
                {parsedResult.name !== character.name && (
                  <div class="refiner-diff__field">
                    <span class="refiner-diff__label">Name</span>
                    <span class="refiner-diff__old">{character.name}</span>
                    <span class="refiner-diff__arrow">→</span>
                    <span class="refiner-diff__new">{parsedResult.name as string}</span>
                  </div>
                )}
                {parsedResult.avatar !== character.avatar && (
                  <div class="refiner-diff__field">
                    <span class="refiner-diff__label">Avatar</span>
                    <span class="refiner-diff__old">{character.avatar}</span>
                    <span class="refiner-diff__arrow">→</span>
                    <span class="refiner-diff__new">{parsedResult.avatar as string}</span>
                  </div>
                )}
                {parsedResult.description !== character.description && (
                  <div class="refiner-diff__field">
                    <span class="refiner-diff__label">Description</span>
                    <span class="refiner-diff__old">{character.description}</span>
                    <span class="refiner-diff__arrow">→</span>
                    <span class="refiner-diff__new">{parsedResult.description as string}</span>
                  </div>
                )}
                <div class="refiner-diff__field refiner-diff__field--full">
                  <span class="refiner-diff__label">System Prompt</span>
                  <div class="refiner-diff__old">{character.systemPrompt}</div>
                  <div class="refiner-diff__arrow">→</div>
                  <div class="refiner-diff__new">{parsedResult.systemPrompt as string}</div>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !generating && (
            <div class="gen-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Error: {error}</span>
              <button class="btn btn--ghost btn--small" onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div class="dialog__footer">
          <button class="btn btn--ghost" onClick={onClose}>
            {parsedResult ? 'Discard' : 'Cancel'}
          </button>
          <div class="dialog__footer-right">
            {parsedResult && !generating && (
              <>
                <button class="btn btn--ghost" onClick={() => setParsedResult(null)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Retry
                </button>
                <button class="btn btn--primary" onClick={handleApply}>
                  Apply Changes
                </button>
              </>
            )}
            {!parsedResult && !generating && (
              <button class="btn btn--primary" onClick={handleGenerate} disabled={!instruction.trim() || !apiKey}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Generate
              </button>
            )}
            {generating && (
              <button class="btn btn--stop btn--small" onClick={() => abortRef.current?.abort()}>
                Stop
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
