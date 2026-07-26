import { parse, Renderer } from 'marked'

/**
 * Configure a custom Markdown renderer that produces beautiful HTML
 * for tables, code blocks, lists, headings, etc.
 *
 * NOTE: All renderer methods are defined as *arrow functions* assigned
 * to the Renderer instance. Since arrow functions do NOT have their own
 * `this`, we reference `renderer.parser` (from the closure) instead of
 * `this.parser`. `renderer.parser` is set by `marked` internally before
 * any render method is called.
 */
function createRenderer(): Renderer {
  const renderer = new Renderer()

  // ── Tables ──────────────────────────────────────────
  renderer.table = (token) => {
    const header = token.header.map((cell) => renderer.tablecell(cell)).join('')
    const rows = token.rows
      .map((row) =>
        renderer.tablerow({
          text: row.map((cell) => renderer.tablecell(cell)).join(''),
        }),
      )
      .join('')
    return `<div class="md-table-wrap"><table class="md-table"><thead>${header}</thead><tbody>${rows}</tbody></table></div>`
  }

  renderer.tablerow = ({ text }) => {
    return `<tr>${text}</tr>`
  }

  renderer.tablecell = (token) => {
    const tag = token.header ? 'th' : 'td'
    const content = renderer.parser?.parseInline(token.tokens) ?? token.text ?? ''
    const align = token.align ? ` align="${token.align}"` : ''
    return `<${tag}${align}>${content}</${tag}>`
  }

  // ── Code blocks ─────────────────────────────────────
  renderer.code = ({ text, lang }) => {
    const langLabel = lang ? `<span class="md-code__lang">${escapeHtml(lang)}</span>` : ''
    return `<div class="md-code">
      <div class="md-code__header">
        ${langLabel}
        <button class="md-code__copy btn btn--ghost btn--small" onclick="
          navigator.clipboard.writeText(this.parentElement.nextElementSibling.textContent)
            .then(() => { this.textContent = 'Copied!'; setTimeout(() => this.textContent = 'Copy', 1500); })
            .catch(() => {})
        ">Copy</button>
      </div>
      <pre class="md-code__pre"><code class="language-${lang || ''}">${escapeHtml(text)}</code></pre>
    </div>`
  }

  renderer.codespan = ({ text }) => {
    return `<code class="md-inline-code">${escapeHtml(text)}</code>`
  }

  // ── Headings ────────────────────────────────────────
  renderer.heading = ({ tokens, depth }) => {
    const text = renderer.parser?.parseInline(tokens) ?? ''
    return `<h${depth} class="md-h md-h--${depth}">${text}</h${depth}>`
  }

  // ── Lists ───────────────────────────────────────────
  renderer.list = (token) => {
    const items = token.items.map((item) => renderer.listitem(item)).join('')
    const tag = token.ordered ? 'ol' : 'ul'
    const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : ''
    return `<${tag} class="md-list"${start}>${items}</${tag}>`
  }

  renderer.listitem = (token) => {
    const text = renderer.parser?.parse(token.tokens) ?? ''
    return `<li class="md-li">${text}</li>`
  }

  // ── Paragraphs & inline ─────────────────────────────
  renderer.paragraph = ({ tokens }) => {
    const text = renderer.parser?.parseInline(tokens) ?? ''
    return `<p class="md-p">${text}</p>`
  }

  renderer.link = ({ href, title, tokens }) => {
    const text = renderer.parser?.parseInline(tokens) ?? ''
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
    return `<a class="md-link" href="${escapeAttr(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
  }

  renderer.image = ({ href, title, text }) => {
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
    return `<img class="md-img" src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${titleAttr} loading="lazy" />`
  }

  renderer.blockquote = ({ tokens }) => {
    const text = renderer.parser?.parse(tokens) ?? ''
    return `<blockquote class="md-quote">${text}</blockquote>`
  }

  renderer.hr = () => '<hr class="md-hr" />'

  renderer.strong = ({ tokens }) => {
    const text = renderer.parser?.parseInline(tokens) ?? ''
    return `<strong>${text}</strong>`
  }

  renderer.em = ({ tokens }) => {
    const text = renderer.parser?.parseInline(tokens) ?? ''
    return `<em>${text}</em>`
  }

  renderer.del = ({ tokens }) => {
    const text = renderer.parser?.parseInline(tokens) ?? ''
    return `<del>${text}</del>`
  }

  return renderer
}

/** Shared renderer instance */
let _renderer: Renderer | null = null
function getRenderer(): Renderer {
  if (!_renderer) _renderer = createRenderer()
  return _renderer
}

/**
 * Convert markdown text to HTML using our custom renderer.
 * Falls back to plain text on error.
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  try {
    const result = parse(text, {
      renderer: getRenderer(),
      breaks: true, // single newline = <br> in paragraphs
      gfm: true,    // GitHub-Flavored Markdown (tables, strikethrough, etc.)
    })
    return typeof result === 'string' ? result : String(result)
  } catch {
    return escapeHtml(text)
  }
}

/* ── Helpers ─────────────────────────────────────── */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/&/g, '&amp;')
}
