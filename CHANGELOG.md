# Changelog

All notable changes to Texter will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and Texter adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-07-26 🎯

> First stable release. All core features, bug fixes, and polish complete.

### Added

#### Core
- Tauri v2 + Preact + Vite + TypeScript foundation
- Streaming API (SSE) — token-by-token response
- Multi-provider support: OpenAI, OpenRouter, Anthropic Claude, Google Gemini
- Provider management — multiple API keys, switch between providers
- In-chat model switching — dropdown with quick model change
- Settings dialog — API key, endpoint, model, system prompt, temperature, context/output tokens
- Multiple chats with create, switch, delete
- Auto-save via Tauri Store (1.5s debounce)
- Config migration (`runMigrations()`) with auto-backup and restore
- Guard against double streaming

#### Chat & Messages
- Markdown rendering — tables with zebra striping, code blocks with Copy button, lists, blockquotes, images
- Reasoning block (🧠) — collapsible chain-of-thought for DeepSeek R1, GLM, Claude thinking
- Reasoning shown during streaming — not only after completion
- Message editing (✏️) with version history navigation `< 2/3 >`
- Regenerate (🔄) — re-roll responses, old versions preserved in history
- Reply (↩️) — reply to specific messages (works for both user and assistant)
- Copy button (📋) — copies to system clipboard + internal persistent buffer
- Favorites (⭐) — save messages for later, view in sidebar
- Edit → auto-regenerate — editing a message triggers re-roll of the next AI response
- Suggestion chips — 3 follow-up questions suggested after each response

#### Input
- ContentEditable editor — `div[contenteditable]` instead of textarea
- Drag & drop file attachments with overlay
- Multiple file chips with per-file progress bars
- Voice input (STT) — Speech-to-Text via Web Speech API
- Text-to-Speech (TTS) — play AI responses via Web Speech API
- Autocomplete — search chat history while typing
- File attachments (see File Support section)

#### File Support
- Text formats: `.txt`, `.md`, `.json`, `.csv`, `.xml`, `.yaml`, `.log`, `.env`, `.toml`, `.conf`
- Code: 20+ languages (`.py`, `.js`, `.ts`, `.rs`, `.go`, `.java`, `.cpp`, etc.)
- Documents: `.docx` (mammoth.js), `.pdf` (pdfjs-dist), `.odt`, `.rtf`, `.xlsx` (→ Markdown tables), `.pptx` (→ structured Markdown), `.epub`
- Jupyter notebooks: `.ipynb` — code + markdown cells + output
- Archives: `.zip`, `.tar`, `.tar.gz`/`.tgz`, `.gz`, `.7z`, `.rar` (via Rust commands)
- Images: `.png`, `.jpg`, `.gif`, `.webp`, `.bmp`, `.svg` — Vision API support
- OCR: Tesseract.js — text extraction from images with language selection and pre-cache

#### Image Generator
- Built-in generation dialog for `/v1/images/generations`
- Model presets: DALL-E 3, DALL-E 2, FLUX, SD3
- Size selector: Square (1024×1024), Tall (1024×1792), Wide (1792×1024), Small (512×512)
- Quality selector: Standard / HD
- Generation count: 1–10 images
- Generation history (last 100, persisted)
- Preview, download, copy to clipboard
- AbortController for stop/abort

#### Project Mode (RP / Creative)
- Chat/Projects mode switch in sidebar
- Character library — create, edit, duplicate, delete characters
- Avatar picker — 16 emoji avatars
- Per-character system prompt, model, temperature settings
- Scene/scenario library with custom prompts
- Character → Chat one-click link with header badge
- Export/import projects as `.json`
- Import characters from Chatbox exports

#### Security & Privacy
- Incognito mode — chats never saved to disk (with one-click Save)
- PIN lock — lock the app on startup
- Local-only data — no telemetry, no accounts

#### UI / Customization
- SVG app icon (gradient nebula)
- Dark/light theme (auto, manual, accent color picker)
- Theme editor — full visual editor for every CSS variable, presets, import/export
- Chat background — 9 gradient presets + custom image upload
- Plugins — JavaScript pre/post-processors with inline code editor
- Plugin import/export as `.json`
- Status bar — mode, auto-save, chat count, keyboard shortcuts
- Keyboard shortcuts: `Ctrl+N` new chat, `Ctrl+F` search, `Ctrl+S` save
- Toast notification system with exit animations
- Tooltips on all icon buttons
- Clipboard dialog — view, search, delete clipboard entries
- Auto-sort chats by `updatedAt`
- Auto-save drafts — unsent messages saved per-chat

#### Data
- Import from Chatbox — full parser (edits, contentParts, reasoning, system prompt)
- Search chats — title + message content
- Export chats to JSON

#### Statistics
- Token statistics — session and all-time prompt/completion/total tokens
- Token stats dialog

#### Language Support
- Response language setting (Auto / English / Russian / 16+ languages)
- OCR language selection (eng, rus, deu, fra, jpn, etc.)
- OCR language pre-cache with progress

#### Infrastructure
- CI/CD — GitHub Actions workflow for Linux (.deb), macOS Intel (.dmg), macOS ARM (.dmg), Windows (.msi)
- Config migration with auto-backup and restore
- Tauri plugin-log integration

### Fixed

- **Dynamic streaming text** — AI responses now appear token-by-token during streaming instead of only after completion. Root cause: `message.loading` was blocking Markdown rendering; fixed by rendering content regardless of `loading` state.
- **API retry** — network errors and 5xx server errors are automatically retried with exponential backoff (1s, 2s, 4s + jitter, 3 attempts). 4xx errors (auth) and `AbortError` (user cancel) are NOT retried.
- **Chat title override** — removed auto-title from first message (was preventing AI's suggested title from being applied).
- **Message layout overflow** — large messages no longer break the scroll container.
- **Smart auto-scroll** — Intersection Observer detects if user is near bottom; auto-scroll only fires when reading latest messages, not when scrolling through history.
- **Virtual scrolling** — `content-visibility: auto` CSS on message wrappers stops the browser from rendering/painting off-screen elements.
- **Input blocked only on send** — typing is allowed during streaming; only the Send button is disabled.
- **Sidebar** — no longer auto-closes when opening modals or switching modes.

### Known Issues

- **No code signing** — macOS DMG and Windows MSI are not signed; users may see Gatekeeper/SmartScreen warnings.
- **WebView blocks D&D for messages** — drag-and-drop reordering of chats in sidebar is unsupported by WebView2.

---

## [0.6.0] — 2026-07-25

> Feature release: RP mode, file attachments, multi-provider, image generation.

### Added
- Project Mode (character/scene library with Chat integration)
- Multi-provider routing (OpenAI, Anthropic, Google)
- Image Generator dialog with history
- File attachments: documents (.docx, .pdf, .odt, .rtf, .xlsx, .pptx, .epub), archives (.zip, .tar, .tar.gz, .7z, .rar), images (Vision API + OCR)
- ContentEditable editor (replaced textarea)
- Voice Input (STT) and TTS
- Plugins system with code editor
- Theme editor with presets
- Chat background customization
- Internal clipboard (persistent, 500 entries)
- Token statistics
- Autocomplete suggestions
- Toast notification system
- Tooltips on buttons
- Auto-save drafts
- CI/CD cross-platform builds (Linux, macOS, Windows)
- Migrations with auto-backup

---

## [0.5.0] — 2026-07-20

> Feature release: import, safety, search, favorites.

### Added
- Import from Chatbox (full parser with edits, versions, reasoning)
- Incognito mode
- PIN lock
- Search chats
- Export chats to JSON
- Favorites with sidebar view
- Message reply with indicator
- Suggestion chips after AI responses
- Language selection for responses and OCR
- OCR pre-cache with progress

---

## [0.4.0] — 2026-07-15

> Feature release: message management, markdown, reasoning.

### Added
- Message editing with version history navigation
- Regenerate with version preservation
- Markdown rendering (tables, code, lists, blockquotes)
- Reasoning block (DeepSeek R1, GLM)
- Reasoning during streaming
- Copy to system clipboard + internal buffer
- Edit → auto-regenerate

---

## [0.3.0] — 2026-07-10

> Feature release: chat management, streaming.

### Added
- Multiple chats with create, switch, delete
- Streaming API (SSE)
- Stop button for aborting generation
- Auto-save via Tauri Store
- Guard against double streaming
- Model selector in settings

---

## [0.2.0] — 2026-07-05

> Initial prototype.

### Added
- Tauri v2 + Preact + TypeScript foundation
- Basic chat UI with message list
- API settings dialog
- Dark/light theme
- Responsive sidebar

---

[1.0.0]: https://github.com/Baconana-chan/texter/releases/tag/v1.0.0
