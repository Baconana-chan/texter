export type TtsState = 'idle' | 'speaking' | 'paused'

export interface TtsSettings {
  voiceURI: string
  rate: number
  pitch: number
  volume: number
}

const DEFAULT_SETTINGS: TtsSettings = {
  voiceURI: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
}

// ── State ──────────────────────────────────────
let state: TtsState = 'idle'
let currentText = ''
let settings: TtsSettings = { ...DEFAULT_SETTINGS }
let voices: SpeechSynthesisVoice[] = []
const listeners = new Set<() => void>()
let voicesLoaded = false

function notify() {
  for (const fn of listeners) fn()
}

// ── Utterance helpers ──────────────────────────

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  return window.speechSynthesis
}

function createUtterance(text: string): SpeechSynthesisUtterance | null {
  const synth = getSynth()
  if (!synth) return null

  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = settings.rate
  utter.pitch = settings.pitch
  utter.volume = settings.volume

  // Set voice if specified
  if (settings.voiceURI) {
    const found = synth.getVoices().find((v) => v.voiceURI === settings.voiceURI)
    if (found) utter.voice = found
  }

  utter.onstart = () => {
    state = 'speaking'
    notify()
  }

  utter.onend = () => {
    state = 'idle'
    currentText = ''
    notify()
  }

  utter.onerror = () => {
    state = 'idle'
    currentText = ''
    notify()
  }

  utter.onpause = () => {
    state = 'paused'
    notify()
  }

  utter.onresume = () => {
    state = 'speaking'
    notify()
  }

  return utter
}

// ── Public API ─────────────────────────────────

export function speak(text: string) {
  const synth = getSynth()
  if (!synth) return

  // Cancel any current speech
  synth.cancel()

  if (!text.trim()) return

  currentText = text
  const utter = createUtterance(text)
  if (!utter) return
  synth.speak(utter)
}

export function pause() {
  const synth = getSynth()
  if (!synth || state !== 'speaking') return
  synth.pause()
}

export function resume() {
  const synth = getSynth()
  if (!synth || state !== 'paused') return
  synth.resume()
}

export function stop() {
  const synth = getSynth()
  if (!synth) return
  synth.cancel()
  state = 'idle'
  currentText = ''
  notify()
}

export function togglePlay(text: string) {
  if (state === 'speaking' || state === 'paused') {
    if (currentText === text) {
      // Toggle pause/resume on the same text
      if (state === 'speaking') {
        pause()
      } else {
        resume()
      }
    } else {
      // Different text: stop current, start new
      speak(text)
    }
  } else {
    speak(text)
  }
}

// ── Settings ───────────────────────────────────

export function setVoiceURI(voiceURI: string) {
  settings = { ...settings, voiceURI }
  notify()
}

export function setRate(rate: number) {
  settings = { ...settings, rate: Math.max(0.1, Math.min(10, rate)) }
  notify()
}

export function setPitch(pitch: number) {
  settings = { ...settings, pitch: Math.max(0, Math.min(2, pitch)) }
}

export function setVolume(volume: number) {
  settings = { ...settings, volume: Math.max(0, Math.min(1, volume)) }
}

export function getSettings(): TtsSettings {
  return { ...settings }
}

// ── Voices ─────────────────────────────────────

export function loadVoices(): SpeechSynthesisVoice[] {
  const synth = getSynth()
  if (!synth) return []
  const v = synth.getVoices()
  if (v.length > 0) {
    voices = v
    voicesLoaded = true
  }
  return voices
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!voicesLoaded) loadVoices()
  return voices
}

export function onVoicesChanged(cb: () => void): () => void {
  const synth = getSynth()
  if (!synth) return () => {}
  const handler = () => {
    loadVoices()
    cb()
    notify()
  }
  synth.addEventListener('voiceschanged', handler)
  return () => synth.removeEventListener('voiceschanged', handler)
}

// ── State queries ──────────────────────────────

export function getState(): TtsState {
  return state
}

export function getCurrentText(): string {
  return currentText
}

export function isSpeakingText(text: string): boolean {
  return (state === 'speaking' || state === 'paused') && currentText === text
}

// ── Subscribe ─────────────────────────────────

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
