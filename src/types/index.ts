export interface MessageEdit {
  content: string
  timestamp: number
}

export interface FileAttachment {
  name: string
  content: string
  size: number
}

export interface ImageAttachment {
  name: string
  dataUrl: string  // base64 data URL (data:image/png;base64,...)
  mimeType: string
  size: number
}

/** Message content part for multimodal API */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  model?: string
  loading?: boolean
  error?: boolean
  edits?: MessageEdit[]
  editIndex?: number
  reasoning?: string
  replyTo?: string
  favorited?: boolean
  fileAttach?: FileAttachment
  imageAttach?: ImageAttachment
  /** Auto-generated title suggestion (stripped from visible content) */
  titleSuggestion?: string
  /** Follow-up suggestion chips (stripped from visible content) */
  suggestions?: string[]
}

export interface EditingState {
  messageId: string
  chatId: string
  initialContent: string
}

export interface ReplyState {
  messageId: string
  chatId: string
  preview: string
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  model: string
  createdAt: number
  updatedAt: number
  systemPrompt?: string
}

export interface AppSettings {
  apiKey: string
  apiEndpoint: string
  model: string
  systemPrompt: string
  temperature: number
  maxContext: number
  maxOutput: number
  maxReasoningTokens?: number
  incognito?: boolean
  ocrLanguage?: string
  responseLanguage?: string
  autoTitle?: boolean
  showSuggestions?: boolean
  theme?: 'auto' | 'light' | 'dark'
  accentColor?: string
  chatBackground?: string
  activePresetId?: string
}

export const CHAT_BACKGROUNDS = [
  { name: 'None', value: '' },
  { name: 'Canvas', value: '#f0f0f0' },
  { name: 'Warm Sand', value: 'linear-gradient(135deg, #f5e6d3 0%, #e8d5c4 100%)' },
  { name: 'Ocean Breeze', value: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)' },
  { name: 'Lavender', value: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #ffcdd2 0%, #ffecb3 100%)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' },
  { name: 'Twilight', value: 'linear-gradient(135deg, #e0e0e0 0%, #90caf9 100%)' },
  { name: 'Mint', value: 'linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%)' },
  { name: 'Rose', value: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)' },
]

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiEndpoint: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7,
  maxContext: 1_050_000,
  maxOutput: 384_000,
  maxReasoningTokens: 0,
  incognito: false,
  ocrLanguage: 'eng+rus',
  responseLanguage: 'auto',
  autoTitle: true,
  showSuggestions: true,
  theme: 'auto',
  accentColor: '#10a37f',
  chatBackground: '',
  activePresetId: undefined,
}

export const ACCENT_COLORS = [
  { name: 'Green', color: '#10a37f' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Purple', color: '#8b5cf6' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Teal', color: '#14b8a6' },
  { name: 'Cyan', color: '#06b6d4' },
  { name: 'Indigo', color: '#6366f1' },
]

export const DEFAULT_CHAT_TITLE = 'New Chat'

// ── Theme Presets ──────────────────────────────────

/** All CSS color properties that can be customized in a theme preset */
export const COLOR_KEYS = [
  'bg',
  'bg-secondary',
  'bg-tertiary',
  'bg-hover',
  'bg-active',
  'surface',
  'surface-hover',
  'text',
  'text-secondary',
  'text-tertiary',
  'text-inverse',
  'border',
  'border-light',
  'danger',
  'user-bubble',
  'user-bubble-text',
] as const

export type ColorKey = typeof COLOR_KEYS[number]

/** A color key + group info for the editor UI */
export const COLOR_KEY_GROUPS: { label: string; keys: ColorKey[] }[] = [
  {
    label: 'Backgrounds',
    keys: ['bg', 'bg-secondary', 'bg-tertiary', 'bg-hover', 'bg-active', 'surface', 'surface-hover'],
  },
  {
    label: 'Text',
    keys: ['text', 'text-secondary', 'text-tertiary', 'text-inverse'],
  },
  {
    label: 'Borders',
    keys: ['border', 'border-light'],
  },
  {
    label: 'Other',
    keys: ['danger', 'user-bubble', 'user-bubble-text'],
  },
]

export interface ThemePreset {
  id: string
  name: string
  /** CSS variable overrides (e.g. { '--bg': '#ffffff', '--text': '#2d2d2d' }) */
  colors: Record<string, string>
  createdAt: number
  updatedAt: number
}

/** Built-in presets that can't be deleted */
export const DEFAULT_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'texter-light',
    name: 'Texter Light',
    colors: {
      '--bg': '#ffffff',
      '--bg-secondary': '#f7f7f8',
      '--bg-tertiary': '#ececf1',
      '--bg-hover': '#e5e5e9',
      '--bg-active': '#dcdce1',
      '--surface': '#ffffff',
      '--surface-hover': '#f0f0f5',
      '--text': '#2d2d2d',
      '--text-secondary': '#6b6b7b',
      '--text-tertiary': '#9a9aaa',
      '--text-inverse': '#ffffff',
      '--border': '#e5e5ea',
      '--border-light': '#f0f0f3',
      '--danger': '#ef4444',
      '--user-bubble': '#2d2d2d',
      '--user-bubble-text': '#ffffff',
    },
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'texter-dark',
    name: 'Texter Dark',
    colors: {
      '--bg': '#212121',
      '--bg-secondary': '#1a1a1a',
      '--bg-tertiary': '#2d2d2d',
      '--bg-hover': '#333333',
      '--bg-active': '#3a3a3a',
      '--surface': '#2a2a2a',
      '--surface-hover': '#333333',
      '--text': '#ececf1',
      '--text-secondary': '#9a9aaa',
      '--text-tertiary': '#6b6b7b',
      '--text-inverse': '#1a1a1a',
      '--border': '#3a3a3e',
      '--border-light': '#333336',
      '--danger': '#ef4444',
      '--user-bubble': '#2f2f2f',
      '--user-bubble-text': '#ececf1',
    },
    createdAt: 0,
    updatedAt: 0,
  },
]

// ── Project Mode ──────────────────────────────────

export type AppMode = 'chat' | 'projects'

export interface CharacterProfile {
  /** Free-form fields: gender, age, appearance, traits, goals, etc. */
  gender?: string
  age?: string
  appearance?: string
  traits?: string
  goals?: string
  /** Any extra custom key-value pairs the user wants to add */
  customFields?: { key: string; value: string }[]
}

export interface Character {
  id: string
  name: string
  avatar: string        // emoji or initial
  systemPrompt: string
  model: string
  temperature: number
  description: string
  profile?: CharacterProfile
  createdAt: number
  updatedAt: number
}

export interface Scene {
  id: string
  name: string
  prompt: string        // prepended to user messages or as context
  description: string
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  description: string
  characterId: string | null
  sceneId: string | null
  chatId: string | null  // linked chat
  createdAt: number
  updatedAt: number
}

// ── Image Generation ───────────────────────────────

export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024'
export type ImageQuality = 'standard' | 'hd'

export interface ImageGenRecord {
  id: string
  prompt: string
  revisedPrompt?: string
  dataUrl: string
  model: string
  size: string
  quality: string
  timestamp: number
  error?: boolean
}

// ── Multi-Provider ────────────────────────────────

export type ProviderType = 'openai' | 'anthropic' | 'google'

export interface Provider {
  id: string
  name: string
  type: ProviderType
  apiEndpoint: string
  apiKey: string
  activeModel: string
  createdAt: number
}

export const DEFAULT_PROVIDERS: Omit<Provider, 'id' | 'createdAt'>[] = [
  {
    name: 'OpenAI',
    type: 'openai',
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: '',
    activeModel: 'gpt-4o-mini',
  },
  {
    name: 'OpenRouter',
    type: 'openai',
    apiEndpoint: 'https://openrouter.ai/api/v1',
    apiKey: '',
    activeModel: 'openai/gpt-4o-mini',
  },
  {
    name: 'DeepSeek',
    type: 'openai',
    apiEndpoint: 'https://api.deepseek.com/v1',
    apiKey: '',
    activeModel: 'deepseek-chat',
  },
  {
    name: 'Anthropic',
    type: 'anthropic',
    apiEndpoint: 'https://api.anthropic.com',
    apiKey: '',
    activeModel: 'claude-sonnet-4-20250514',
  },
  {
    name: 'Google Gemini',
    type: 'google',
    apiEndpoint: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    activeModel: 'gemini-2.5-flash-latest',
  },
]

// ── Token Stats ───────────────────────────────────

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface TokenStats {
  session: TokenUsage
  total: TokenUsage  // accumulated across all sessions
  lastUpdated: number
}

export const DEFAULT_CHARACTER: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'New Character',
  avatar: '🎭',
  systemPrompt: `You are a character in a story. Respond in character at all times — stay true to your personality, voice, and background. Use appropriate tone, speech patterns, and mannerisms. Never break character or refer to yourself as an AI.`,
  model: 'gpt-4o-mini',
  temperature: 0.8,
  description: '',
}
