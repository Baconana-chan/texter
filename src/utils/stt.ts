export type SttState = 'idle' | 'listening' | 'error'

export interface SttResult {
  text: string
  isFinal: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionType = any

type SttCallback = (result: SttResult) => void
type StateCallback = () => void

// ── State ──────────────────────────────────────
let state: SttState = 'idle'
let recognition: SpeechRecognitionType | null = null
let errorMessage = ''
const stateListeners = new Set<StateCallback>()
const resultListeners = new Set<SttCallback>()

function notifyState() {
  for (const fn of stateListeners) fn()
}

function notifyResult(result: SttResult) {
  for (const fn of resultListeners) fn(result)
}

// ── Recognition helper ─────────────────────────

function getRecognition(): SpeechRecognitionType | null {
  if (typeof window === 'undefined') return null
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SpeechRecognition) return null
  return new SpeechRecognition()
}

function createRecognition(): SpeechRecognitionType | null {
  const rec = getRecognition()
  if (!rec) return null

  rec.continuous = true
  rec.interimResults = true
  rec.lang = 'en-US'

  rec.onresult = (event: SpeechRecognitionEvent) => {
    let finalText = ''
    let interimText = ''

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) {
        finalText += result[0].transcript
      } else {
        interimText += result[0].transcript
      }
    }

    // Notify with the best available text
    const text = finalText || interimText
    if (text) {
      notifyResult({ text, isFinal: !!finalText })
    }
  }

  rec.onerror = (event: SpeechRecognitionErrorEvent) => {
    console.error('[STT] Error:', event.error)
    errorMessage = event.error
    state = 'error'
    notifyState()
    // Don't call stopListening() — let the UI show the error state for a moment
    // The user will need to click the button again to dismiss
    if (recognition) {
      try { recognition.abort() } catch {}
    }
  }

  rec.onend = () => {
    // Only set to idle if we weren't stopped manually (stopListening sets state before calling abort)
    if (state === 'listening') {
      state = 'idle'
      notifyState()
    }
  }

  return rec
}

// ── Public API ─────────────────────────────────

export function startListening(lang?: string) {
  // Don't start if already listening
  if (state === 'listening') return

  // Clean up any previous instance
  if (recognition) {
    try { recognition.abort() } catch {}
    recognition = null
  }

  const rec = createRecognition()
  if (!rec) {
    errorMessage = 'Speech recognition not supported in this browser'
    state = 'error'
    notifyState()
    return
  }

  // Set language if provided
  if (lang) rec.lang = lang

  recognition = rec
  errorMessage = ''
  state = 'listening'
  notifyState()

  try {
    rec.start()
  } catch (e) {
    console.error('[STT] Failed to start:', e)
    errorMessage = 'Failed to start recognition'
    state = 'error'
    notifyState()
  }
}

export function stopListening() {
  if (state !== 'listening') return

  state = 'idle'
  notifyState()

  if (recognition) {
    try {
      recognition.stop()
    } catch {
      recognition.abort()
    }
    recognition = null
  }
}

export function getState(): SttState {
  return state
}

export function getError(): string {
  return errorMessage
}

export function isSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
}

// ── Subscribe ──────────────────────────────────

export function onStateChange(fn: StateCallback): () => void {
  stateListeners.add(fn)
  return () => { stateListeners.delete(fn) }
}

export function onResult(fn: SttCallback): () => void {
  resultListeners.add(fn)
  return () => { resultListeners.delete(fn) }
}
