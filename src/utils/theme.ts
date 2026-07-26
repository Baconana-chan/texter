export type ThemeMode = 'auto' | 'light' | 'dark'

/**
 * Apply the selected theme to the document.
 * - Sets `.theme-light` or `.theme-dark` class on `<html>` (replaces `prefers-color-scheme`)
 * - Sets the `--accent` and related CSS variables
 * - Sets `--chat-bg` for the message area background
 */
export function applyTheme(
  theme: ThemeMode,
  accentColor: string,
  chatBackground?: string,
  osDark: boolean = window.matchMedia('(prefers-color-scheme: dark)').matches,
) {
  const html = document.documentElement

  // Determine effective dark mode
  const isDark = theme === 'dark' || (theme === 'auto' && osDark)

  // Remove both classes, then add the active one
  html.classList.remove('theme-light', 'theme-dark')
  html.classList.add(isDark ? 'theme-dark' : 'theme-light')

  // Apply accent color
  applyAccent(accentColor)

  // Apply chat background
  applyChatBg(chatBackground)
}

/**
 * Set the `--chat-bg` CSS variable for the message area.
 */
export function applyChatBg(chatBackground?: string) {
  const html = document.documentElement
  if (chatBackground) {
    html.style.setProperty('--chat-bg', chatBackground)
  } else {
    html.style.removeProperty('--chat-bg')
  }
}

/**
 * Set accent CSS variables on the document root.
 */
export function applyAccent(color: string) {
  const html = document.documentElement

  // Parse the hex color to RGB for alpha variants
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)

  html.style.setProperty('--accent', color)
  html.style.setProperty('--accent-hover', adjustBrightness(color, -12))
  html.style.setProperty('--accent-bg', `rgba(${r}, ${g}, ${b}, 0.1)`)
  html.style.setProperty('--accent-text', getContrastColor(r, g, b))
}

/**
 * Apply a full preset color map to the document root.
 * Sets each CSS variable from the colors object.
 */
export function applyPreset(colors: Record<string, string>) {
  const html = document.documentElement
  for (const [key, value] of Object.entries(colors)) {
    if (value) {
      html.style.setProperty(key, value)
    }
  }
}

/** Remove preset CSS variables, restoring theme defaults */
export function clearPreset() {
  const html = document.documentElement
  // Remove all custom color variables that presets might have set
  const keys = [
    '--bg', '--bg-secondary', '--bg-tertiary', '--bg-hover', '--bg-active',
    '--surface', '--surface-hover',
    '--text', '--text-secondary', '--text-tertiary', '--text-inverse',
    '--border', '--border-light',
    '--danger', '--user-bubble', '--user-bubble-text',
  ]
  for (const key of keys) {
    html.style.removeProperty(key)
  }
}

/**
 * Darken or lighten a hex color by percentage points.
 * Negative = darker, positive = lighter.
 */
function adjustBrightness(hex: string, amount: number): string {
  const r = clamp(parseInt(hex.slice(1, 3), 16) + amount)
  const g = clamp(parseInt(hex.slice(3, 5), 16) + amount)
  const b = clamp(parseInt(hex.slice(5, 7), 16) + amount)
  return `rgb(${r}, ${g}, ${b})`
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v))
}

/**
 * Return black or white text color depending on background luminance.
 */
function getContrastColor(r: number, g: number, b: number): string {
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff'
}
