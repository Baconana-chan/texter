import { useState, useEffect, useRef } from 'preact/hooks'
import type { ImageGenRecord, ImageSize, ImageQuality } from '../types'
import { generateImage } from '../utils/api'
import { addToast } from '../utils/toastStore'
import { getGenerationHistory, addGeneration, clearGenerationHistory } from '../utils/imageGenStore'
import { Tooltip } from './Tooltip'

interface ImageGeneratorProps {
  apiEndpoint: string
  apiKey: string
  defaultModel?: string
  onClose: () => void
}

const SIZES: { label: string; value: ImageSize }[] = [
  { label: 'Square', value: '1024x1024' },
  { label: 'Tall', value: '1024x1792' },
  { label: 'Wide', value: '1792x1024' },
  { label: 'Small', value: '512x512' },
]

const PRESET_MODELS = [
  { name: 'DALL-E 3', id: 'dall-e-3' },
  { name: 'DALL-E 2', id: 'dall-e-2' },
  { name: 'FLUX (OpenRouter)', id: 'black-forest-labs/flux-1.1-pro' },
  { name: 'SD3 (OpenRouter)', id: 'stabilityai/stable-diffusion-3.5-large' },
]

export function ImageGenerator({ apiEndpoint, apiKey, defaultModel, onClose }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(defaultModel ?? 'dall-e-3')
  const [size, setSize] = useState<ImageSize>('1024x1024')
  const [quality, setQuality] = useState<ImageQuality>('standard')
  const [count, setCount] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [history, setHistory] = useState<ImageGenRecord[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // Load history on mount
  useEffect(() => {
    getGenerationHistory().then(setHistory)
    promptRef.current?.focus()
  }, [])

  const handleGenerate = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || generating || !apiKey) return

    if (!apiKey) {
      addToast('No API key configured', 'error')
      return
    }

    setGenerating(true)
    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const images = await generateImage(apiEndpoint, apiKey, model, trimmed, count, size, quality, abortController.signal)

      for (let i = 0; i < images.length; i++) {
        const record: ImageGenRecord = {
          id: `${Date.now()}-${i}`,
          prompt: trimmed,
          revisedPrompt: images[i].revisedPrompt,
          dataUrl: images[i].dataUrl,
          model,
          size,
          quality,
          timestamp: Date.now(),
        }
        await addGeneration(record)
        setHistory((prev) => [record, ...prev])
      }

      addToast(`Generated ${images.length} image${images.length > 1 ? 's' : ''}`, 'success')
      setPrompt('')
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const msg = (err as Error).message || 'Generation failed'
      addToast(`Image generation error: ${msg.slice(0, 120)}`, 'error')
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setGenerating(false)
  }

  const handleDownload = (record: ImageGenRecord) => {
    const a = document.createElement('a')
    a.href = record.dataUrl
    a.download = `${record.prompt.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}.png`
    a.click()
  }

  const handleCopyToClipboard = async (url: string) => {
    try {
      const blob = await (await fetch(url)).blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      addToast('Image copied to clipboard', 'success')
    } catch {
      addToast('Failed to copy image', 'error')
    }
  }

  const handleClearHistory = () => {
    clearGenerationHistory()
    setHistory([])
    addToast('Generation history cleared', 'info')
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog image-gen-dialog" onClick={(e) => e.stopPropagation()}>
        <div class="dialog__header">
          <h2 class="dialog__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Image Generator
          </h2>
          <button class="btn btn--ghost btn--icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="dialog__body image-gen-dialog__body">
          {/* ── Generate form ── */}
          <div class="image-gen__form">
            <textarea
              ref={promptRef}
              class="form-input image-gen__prompt"
              value={prompt}
              onInput={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
              placeholder="Describe the image you want to generate..."
              rows={3}
              disabled={generating}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
            />

            <div class="image-gen__params">
              {/* Model */}
              <div class="image-gen__param-group">
                <label class="form-label">Model</label>
                <input
                  class="form-input image-gen__model-input"
                  type="text"
                  value={model}
                  onInput={(e) => setModel((e.target as HTMLInputElement).value)}
                  disabled={generating}
                  placeholder="e.g. dall-e-3"
                />
                <div class="image-gen__presets">
                  {PRESET_MODELS.map((p) => (
                    <button
                      key={p.id}
                      class={`image-gen__preset-btn ${model === p.id ? 'image-gen__preset-btn--active' : ''}`}
                      onClick={() => setModel(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div class="image-gen__param-group">
                <label class="form-label">Size</label>
                <div class="image-gen__size-grid">
                  {SIZES.map((s) => (
                    <button
                      key={s.value}
                      class={`image-gen__size-btn ${size === s.value ? 'image-gen__size-btn--active' : ''}`}
                      onClick={() => setSize(s.value)}
                      disabled={generating}
                    >
                      {s.label}<br />
                      <span class="image-gen__size-dim">{s.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality + Count row */}
              <div class="image-gen__row">
                <div class="image-gen__param-group image-gen__param-group--small">
                  <label class="form-label">Quality</label>
                  <select
                    class="form-input"
                    value={quality}
                    onChange={(e) => setQuality((e.target as HTMLSelectElement).value as ImageQuality)}
                    disabled={generating}
                  >
                    <option value="standard">Standard</option>
                    <option value="hd">HD</option>
                  </select>
                </div>
                <div class="image-gen__param-group image-gen__param-group--small">
                  <label class="form-label">Count</label>
                  <input
                    class="form-input"
                    type="number"
                    min="1"
                    max="10"
                    value={count}
                    onInput={(e) => setCount(Math.max(1, Math.min(10, parseInt((e.target as HTMLInputElement).value) || 1)))}
                    disabled={generating}
                  />
                </div>
              </div>
            </div>

            <div class="image-gen__actions">
              <button class="btn btn--ghost btn--small" onClick={handleClearHistory} disabled={history.length === 0}>
                Clear history
              </button>
              <div class="image-gen__actions-right">
                {generating ? (
                  <button class="btn btn--stop" onClick={handleStop} title="Stop">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Stop
                  </button>
                ) : (
                  <button class="btn btn--primary" onClick={handleGenerate} disabled={!prompt.trim() || !apiKey}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    Generate
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── History ── */}
          <div class="image-gen__history">
            <div class="image-gen__history-header">
              <h3 class="image-gen__history-title">History</h3>
              <span class="image-gen__history-count">{history.length} generation{history.length !== 1 ? 's' : ''}</span>
            </div>

            {history.length === 0 && (
              <div class="image-gen__empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p>No images generated yet</p>
              </div>
            )}

            <div class="image-gen__grid">
              {history.map((record) => (
                <div key={record.id} class="image-gen__card">
                  <div class="image-gen__card-img-wrap" onClick={() => setPreviewUrl(record.dataUrl)}>
                    <img
                      class="image-gen__card-img"
                      src={record.dataUrl}
                      alt={record.prompt}
                      loading="lazy"
                    />
                    {record.error && (
                      <div class="image-gen__card-error">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Failed
                      </div>
                    )}
                  </div>
                  <div class="image-gen__card-info">
                    <Tooltip label={record.prompt}>
                      <span class="image-gen__card-prompt">{record.prompt.slice(0, 60)}{record.prompt.length > 60 ? '...' : ''}</span>
                    </Tooltip>
                    <div class="image-gen__card-meta">
                      <span class="image-gen__card-model">{record.model}</span>
                      <span class="image-gen__card-time">{formatTime(record.timestamp)}</span>
                    </div>
                    <div class="image-gen__card-actions">
                      <button class="btn btn--ghost btn--icon btn--small" onClick={() => handleDownload(record)} title="Download">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                      <button class="btn btn--ghost btn--icon btn--small" onClick={() => handleCopyToClipboard(record.dataUrl)} title="Copy to clipboard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full-screen preview overlay ── */}
      {previewUrl && (
        <div class="image-gen__preview-overlay" onClick={() => setPreviewUrl(null)}>
          <img class="image-gen__preview-img" src={previewUrl} alt="Preview" />
          <button class="image-gen__preview-close" onClick={() => setPreviewUrl(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
