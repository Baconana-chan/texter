import { useState, useRef } from 'preact/hooks'
import type { Character, ProviderType } from '../types'
import { generateText } from '../utils/api'

interface Props {
  providerType: ProviderType
  apiEndpoint: string
  apiKey: string
  model: string
  onSave: (characters: Array<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>>) => void
  onClose: () => void
}

interface GeneratedChar {
  name: string
  avatar: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
}

export function CharacterGenerator({ providerType, apiEndpoint, apiKey, model, onSave, onClose }: Props) {
  const [projectDesc, setProjectDesc] = useState('')
  const [count, setCount] = useState(3)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedChar[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [rawPreview, setRawPreview] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const handleGenerate = async () => {
    if (!projectDesc.trim()) return
    if (!apiKey) return

    setGenerating(true)
    setError(null)
    setGenerated([])
    setRawPreview('')

    const abort = new AbortController()
    abortRef.current = abort

    const systemMsg = `You are a creative character designer for roleplaying and storytelling.`
    const userMsg = `Generate exactly ${count} unique, interesting characters for the following project/world:

"${projectDesc.trim()}"

Return ONLY valid JSON — no markdown, no code fences, no extra text. The JSON must be an array of objects with exactly these fields:
{
  "name": "full character name",
  "avatar": "a single emoji that represents this character",
  "description": "1-2 sentences describing who this character is",
  "systemPrompt": "A detailed roleplay instruction for this character. Include: personality traits, speech patterns, mannerisms, backstory summary, goals, how they interact with others. Write this in second person ('You are...'). Make it at least 3-4 sentences.",
  "model": "${model}",
  "temperature": 0.8,
  "profile": {
    "gender": "character's gender",
    "age": "character's age or age range",
    "appearance": "detailed physical description — height, build, hair, eyes, clothing, distinguishing features",
    "traits": "personality traits — brave, cunning, shy, etc.",
    "goals": "what drives this character — their motivations and ambitions"
  }
}

Guidelines:
- Make characters diverse in personality, background, and role
- Avoid offensive stereotypes
- Use creative, vivid descriptions
- Avatars must be single emoji characters only
- Names should be memorable and thematically appropriate
- Fill in ALL profile fields for each character — they provide structured data that helps the AI roleplay better`

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

      setRawPreview(text)

      // Try to find JSON array in the response (handle possible markdown wrapping)
      const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s)
      const jsonStr = jsonMatch?.[0] ?? text
      const parsed: GeneratedChar[] = JSON.parse(jsonStr)

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('No characters in response')
      }

      // Validate each entry
      const valid = parsed.filter((c) => c.name && c.systemPrompt)
      if (valid.length === 0) {
        throw new Error('Invalid character data received')
      }

      setGenerated(valid)
      setSelected(new Set(valid.map((_, i) => i))) // pre-select all
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const handleSave = () => {
    const toSave = generated.filter((_, i) => selected.has(i))
    if (toSave.length === 0) return

    onSave(
      toSave.map((c) => ({
        name: c.name,
        avatar: c.avatar || '🎭',
        description: c.description || '',
        systemPrompt: c.systemPrompt,
        model: c.model || model,
        temperature: c.temperature ?? 0.8,
      })),
    )
  }

  const toggleSelected = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog dialog--wide" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
        <div class="dialog__header">
          <h2 class="dialog__title">Generate Characters</h2>
          <button class="btn btn--ghost btn--icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="dialog__body">
          {generated.length === 0 && !generating && (
            <>
              {/* Input section */}
              <div class="form-group">
                <label class="form-label" for="gen-desc">
                  Describe your project or world
                  <span class="form-hint" style={{ marginLeft: 8 }}>— setting, genre, theme, etc.</span>
                </label>
                <textarea
                  id="gen-desc"
                  class="form-input form-textarea"
                  value={projectDesc}
                  onInput={(e) => setProjectDesc((e.target as HTMLTextAreaElement).value)}
                  rows={4}
                  placeholder="e.g. A cyberpunk dystopia where AI has taken over the government. The last free humans live in an underground city called Neon Haven..."
                />
              </div>
              <div class="form-row">
                <div class="form-group" style={{ maxWidth: 160 }}>
                  <label class="form-label" for="gen-count">Characters to generate</label>
                  <input
                    id="gen-count"
                    class="form-input"
                    type="number"
                    min={1}
                    max={10}
                    value={count}
                    onInput={(e) => setCount(Math.min(10, Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1)))}
                  />
                </div>
              </div>
            </>
          )}

          {/* Loading state */}
          {generating && (
            <div class="gen-loading">
              <div class="spinner" />
              <p>Generating {count} unique characters...</p>
              {rawPreview && (
                <div class="gen-preview">
                  <p class="form-hint" style={{ margin: '0 0 4px' }}>Raw response:</p>
                  <pre class="gen-preview__code">{rawPreview}</pre>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {generated.length > 0 && !generating && (
            <div class="gen-results">
              <p class="form-hint" style={{ margin: '0 0 8px' }}>
                Select characters to save to your library:
              </p>
              <div class="gen-results__grid">
                {generated.map((c, i) => (
                  <label key={i} class={`gen-card ${selected.has(i) ? 'gen-card--selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelected(i)}
                      style={{ display: 'none' }}
                    />
                    <div class="gen-card__check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div class="gen-card__avatar">{c.avatar || '🎭'}</div>
                    <div class="gen-card__body">
                      <h3 class="gen-card__name">{c.name}</h3>
                      {c.description && <p class="gen-card__desc">{c.description}</p>}
                      <div class="gen-card__prompt">
                        {c.systemPrompt.slice(0, 150)}{c.systemPrompt.length > 150 ? '...' : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && !generating && generated.length === 0 && (
            <div class="gen-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Generation failed: {error}</span>
              <button class="btn btn--ghost btn--small" onClick={() => setError(null)} style={{ marginLeft: 'auto' }}>
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div class="dialog__footer">
          <button class="btn btn--ghost" onClick={onClose}>
            {generated.length > 0 ? 'Discard' : 'Cancel'}
          </button>
          <div class="dialog__footer-right">
            {generated.length > 0 && !generating && (
              <>
                <button class="btn btn--ghost" onClick={handleGenerate} title="Regenerate with same settings">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Regenerate
                </button>
                <button
                  class="btn btn--primary"
                  onClick={handleSave}
                  disabled={selected.size === 0}
                >
                  Save {selected.size > 0 ? `${selected.size} to Library` : ''}
                </button>
              </>
            )}
            {!generating && generated.length === 0 && (
              <button
                class="btn btn--primary"
                onClick={handleGenerate}
                disabled={!projectDesc.trim() || !apiKey}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
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
