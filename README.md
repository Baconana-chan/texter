<div align="center">

# Texter

**A lightweight, local-first AI chat desktop app for conversations, roleplay, and creative projects.**

Built with [Tauri v2](https://v2.tauri.app/) + [Preact](https://preactjs.com/) + [TypeScript](https://www.typescriptlang.org/).

[Features](#-features) • [Screenshots](#-screenshots) • [Download](#-download) • [Getting Started](#-getting-started) • [Building](#-building-from-source) • [Tech Stack](#-tech-stack)

</div>

---

## ✨ Features

### 💬 Chat

| Feature | Description |
|---------|-------------|
| **Multi-Provider** | OpenAI, Anthropic Claude, Google Gemini — with native API format for each |
| **Streaming** | Real-time token-by-token response via SSE |
| **Reasoning** | Collapsible chain-of-thought for DeepSeek R1, GLM, and Claude thinking |
| **Message Editing** | Edit your messages with version history `< 2/3 >` navigation |
| **Regenerate** | Re-roll AI responses — old versions are preserved in history |
| **Reply** | Reply to specific messages (works for both user and assistant) |
| **Markdown Rendering** | Tables with zebra striping, syntax-highlighted code blocks with Copy, lists, blockquotes, images |
| **Favorites** | Star messages to save them for later — accessible from sidebar |
| **Clipboard** | Internal clipboard that persists across restarts (up to 500 entries) |
| **Search** | Full-text search across all chat titles and message content |
| **Import/Export** | Import from Chatbox (full format: versions, reasoning, contentParts). Export all chats to JSON. |

### 🎮 Input

| Feature | Description |
|---------|-------------|
| **ContentEditable Editor** | Rich text input with placeholder, auto-expand, and keyboard shortcuts |
| **File Attachments** | Attach files directly in the message — D&D or file picker |
| **Multiple Files** | Upload several files at once with chips showing progress |
| **Model Selector** | Quick provider/model switching right below the input field |
| **Voice Input (STT)** | Speech-to-Text via Web Speech API |
| **Drag & Drop** | Drop files onto the input overlay |

### 🖼️ File Support

Texter parses files **locally** — no server needed. Supported formats:

| Category | Formats | Engine |
|----------|---------|--------|
| **Text** | `.txt` `.md` `.json` `.csv` `.xml` `.yaml` `.log` `.env` `.toml` | `FileReader` |
| **Code** | `.py` `.js` `.ts` `.rs` `.go` `.java` `.cpp` `.rb` `.php` `.sh` `.sql` + 20+ more | `FileReader` |
| **Documents** | `.docx` `.pdf` `.odt` `.rtf` `.xlsx` `.pptx` `.epub` | `mammoth.js`, `pdfjs-dist`, `fflate` + XML |
| **Jupyter** | `.ipynb` (code + markdown cells + output) | JSON parser |
| **Archives** | `.zip` `.tar` `.tar.gz` `.tgz` `.gz` `.7z` `.rar` | `fflate`, `sevenz-rust2`, `unrar` (via Rust) |
| **Images** | `.png` `.jpg` `.gif` `.webp` `.bmp` `.svg` | Vision API + base64 inline |
| **OCR** | Text extraction from images | `Tesseract.js` (WASM, ~5 MB lazy) |

### 🔊 Media

| Feature | Description |
|---------|-------------|
| **TTS** | Text-to-Speech via Web Speech API — click to hear any AI response |
| **STT** | Speech-to-Text via Web Speech API — dictate messages |
| **Image Generator** | Built-in dialog for `/v1/images/generations` with history, presets, download, copy |
| **Image Preview** | Click to view full-size with dark overlay |

### 🎭 Project Mode (RP / Creative)

| Feature | Description |
|---------|-------------|
| **Characters** | Create/edit character profiles with avatar, system prompt, model, temperature |
| **Scenes** | Scenario library with custom prompts per scene |
| **Chat Link** | One-click chat for a character + scene with header badge |
| **Import from Chatbox** | Extract character system prompts into the library |
| **Export/Import** | Whole project as `.json` — shareable |

### 🎨 Customization

| Feature | Description |
|---------|-------------|
| **Theme** | Automatic light/dark, manual override, accent color picker |
| **Theme Editor** | Full visual editor for every CSS variable — save presets, import/export |
| **Chat Background** | 9 gradient presets or upload your own image |
| **Plugins** | JavaScript pre/post-processors with inline code editor — import/export as JSON |

### 🔒 Privacy & Security

| Feature | Description |
|---------|-------------|
| **Incognito Mode** | Chats are never saved to disk — with optional one-click Save |
| **PIN Lock** | Lock the app with a PIN on startup |
| **Local-only** | All data stays on your machine — no telemetry, no accounts |
| **Auto-backup** | Config backup before every migration (restore in Settings) |
| **Auto-save Drafts** | Unsent messages are saved when switching chats |

### 📊 Statistics

| Feature | Description |
|---------|-------------|
| **Token Stats** | Session and all-time prompt/completion/total token counts |
| **Status Bar** | Mode indicator, chat count, auto-save status, keyboard shortcuts |

### ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New chat |
| `Ctrl+S` | Save (in incognito mode) |
| `Ctrl+F` | Search chats |
| `Escape` | Close dialogs / cancel editing |

---

## 📸 Screenshots

> *Screenshots coming soon. Texter is in active development.*

---

## 📥 Download

Pre-built binaries are available via [GitHub Releases](https://github.com/YOUR_USERNAME/texter/releases).

| Platform | Architecture | Format |
|----------|-------------|--------|
| Windows | x86_64 | `.msi` |
| macOS | x86_64 (Intel) | `.dmg` |
| macOS | aarch64 (Apple Silicon) | `.dmg` |
| Linux | x86_64 | `.deb` |

> **Note:** macOS and Windows builds are not code-signed. You may need to right-click → Open on macOS, or click "More info" → "Run anyway" on Windows SmartScreen.

---

## 🚀 Getting Started

### 1. Get an API key

Texter supports multiple providers out of the box:

| Provider | Endpoint | Get a Key |
|----------|----------|-----------|
| **OpenAI** | `https://api.openai.com/v1` | [platform.openai.com](https://platform.openai.com/api-keys) |
| **OpenRouter** | `https://openrouter.ai/api/v1` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Anthropic** | `https://api.anthropic.com` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **Google Gemini** | `https://generativelanguage.googleapis.com` | [aistudio.google.com](https://aistudio.google.com/apikey) |

Any OpenAI-compatible API works: DeepSeek, Groq, Together, Perplexity, etc.

### 2. Launch the app

On first launch, you'll be prompted to add a provider. Enter your API key and you're ready to chat.

---

## 🔧 Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Platform-specific dependencies:
  - **Windows**: [Microsoft Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (MSVC toolchain)
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `webkit2gtk-4.1`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, etc. (see [Tauri docs](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/texter.git
cd texter

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build

```bash
# Production build (creates platform installer)
npm run tauri build
```

The installer will be in `src-tauri/target/release/bundle/`.

---

## 🏗 Architecture

```
texter/
├── src/                        # Frontend (Preact + TypeScript)
│   ├── app.tsx                 # Root component, state management
│   ├── app.css                 # Global styles, theme variables
│   ├── main.tsx                # Entry point
│   ├── types/index.ts          # Shared TypeScript types
│   ├── hooks/                  # Preact hooks
│   │   ├── useChat.ts          # Chat state, streaming, send/regen
│   │   └── useProjects.ts      # Project mode state
│   ├── components/             # UI components
│   │   ├── ChatInput.tsx       # ContentEditable input w/ file attach, voice, model selector
│   │   ├── ChatMessage.tsx     # Message bubble w/ actions, version nav, reply
│   │   ├── ChatView.tsx        # Message list + header
│   │   ├── Sidebar.tsx         # Chat list, search, favorites, mode switch
│   │   ├── SettingsDialog.tsx  # Provider management, API keys, system prompt
│   │   ├── ImageGenerator.tsx  # Image generation dialog
│   │   ├── PluginManagerDialog.tsx / PluginEditor.tsx
│   │   ├── ThemeEditorDialog.tsx
│   │   ├── ProjectView.tsx / CharacterEditor.tsx / SceneEditor.tsx
│   │   ├── ClipboardDialog.tsx # Internal clipboard viewer
│   │   ├── ToastContainer.tsx  # Toast notifications system
│   │   ├── TokenStats.tsx      # Token statistics dialog
│   │   ├── LockScreen.tsx      # PIN lock screen
│   │   ├── StatusBar.tsx       # Bottom status bar
│   │   └── Tooltip.tsx         # Reusable tooltip wrapper
│   └── utils/                  # Utilities & stores
│       ├── api.ts              # API router (OpenAI, Anthropic, Google streaming)
│       ├── store.ts            # Generic Tauri Store wrapper (chats.json)
│       ├── providerStore.ts    # Provider configurations
│       ├── draftStore.ts       # Auto-save drafts (drafts.json)
│       ├── imageGenStore.ts    # Image generation history
│       ├── migration.ts        # Config migration + backup system
│       ├── fileParser.ts       # Local file parsing (txt, docx, pdf, odt, pptx, xlsx, epub...)
│       ├── archiveParser.ts    # Archive extraction (zip, tar, gz, 7z, rar)
│       ├── ocr.ts              # Tesseract.js OCR with language pre-caching
│       ├── stt.ts              # Speech-to-Text (Web Speech API)
│       ├── tts.ts              # Text-to-Speech (Web Speech API)
│       ├── markdown.ts         # Markdown → DOM renderer (tables, code, reasoning)
│       ├── autocomplete.ts     # Chat history search completions
│       ├── toastStore.ts       # Toast notification store
│       ├── clipboardStore.ts   # Internal clipboard persistence
│       ├── pluginStore.ts      # Plugin/script engine
│       ├── theme.ts            # Theme application logic
│       ├── themePresetStore.ts # Theme preset persistence
│       ├── projectStore.ts     # Project mode store
│       ├── tokenStore.ts       # Token statistics persistence
│       ├── importChatbox.ts    # Chatbox import parser
│       ├── format.ts           # Formatting helpers
│       └── ...
├── src-tauri/                  # Backend (Rust)
│   ├── src/lib.rs              # Tauri commands (extract_7z, extract_rar)
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
├── .github/workflows/build.yml # CI/CD: Linux, macOS Intel/ARM, Windows
├── package.json                # Frontend dependencies
├── vite.config.ts              # Vite configuration
└── TODO.md                     # Development roadmap
```

### Data Flow

```
User Input → ChatInput → useChat.sendMessage()
                │
                ▼
         api.streamChat() → Router by providerType
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
    OpenAI  Anthropic  Google
    (SSE)   (SSE)     (SSE)
        │       │       │
        └───────┼───────┘
                ▼
         useChat.onToken()
                │
        ┌───────┴───────┐
        ▼               ▼
   ChatMessage      Tauri Store
   (re-render)      (auto-save)
```

### Persistence

| Store | File | Content |
|-------|------|---------|
| Chat store | `chats.json` | Chat history, messages, versions |
| Provider store | `providers.json` | API keys, endpoints, models |
| Settings | `settings.json` | App preferences |
| Drafts | `drafts.json` | Unsent message drafts per chat |
| Image gen | `image-gen.json` | Image generation history |
| Clipboard | `clipboard.json` | Internal clipboard (500 items) |
| Plugins | `plugins.json` | User scripts |
| Projects | `projects.json` | Characters, scenes |
| Theme presets | `theme-presets.json` | Custom theme presets |
| Token stats | `stats.json` | Token usage statistics |

All stores use Tauri's `plugin-store` with debounced writes (1.5s auto-save).

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | [Tauri v2](https://v2.tauri.app/) (Rust + WebView) |
| **UI Library** | [Preact](https://preactjs.com/) (~3 KB) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (strict mode) |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **State** | Preact hooks (`useState`, `useEffect`, `useRef`) |
| **Persistence** | `@tauri-apps/plugin-store` (JSON-based) |
| **Backend** | Rust (`sevenz-rust2`, `unrar`, `base64`) |
| **Document Parsing** | `mammoth.js`, `pdfjs-dist`, `fflate` |
| **OCR** | `Tesseract.js` v7 (WASM) |
| **Markdown** | `marked` + custom renderer |
| **CI/CD** | GitHub Actions (3 platforms, 4 architectures) |

---

## 🤝 Contributing

Texter is a personal project, but suggestions are welcome! Feel free to:

- **Report bugs** — file an issue with steps to reproduce
- **Suggest features** — but check [TODO.md](./TODO.md) first
- **Share plugins** — export a `.json` of your coolest plugin

---

## 📄 License

[MIT](./LICENSE) — do whatever you want, just don't blame us.

---

<div align="center">
<sub>Built with ❤️ and a lot of API calls.</sub>
</div>
