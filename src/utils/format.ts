/**
 * Format a token count into a human-readable short form.
 *   1_050_000 → "1.05M"
 *   384_000   → "384K"
 *   8_000     → "8K"
 *   500       → "500"
 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    const val = (count / 1_000_000).toFixed(2)
    return `${parseFloat(val)}M`
  }
  if (count >= 1_000) {
    const val = (count / 1_000).toFixed(count >= 100_000 ? 0 : 1)
    return `${parseFloat(val)}K`
  }
  return String(count)
}

/**
 * Parse a user-typed string back into a raw number.
 * Accepts: "1.05M" → 1_050_000, "384K" → 384_000, "4096" → 4096
 */
export function parseTokens(input: string): number {
  const trimmed = input.trim().toUpperCase()
  if (trimmed.endsWith('M')) {
    return Math.round(parseFloat(trimmed.slice(0, -1)) * 1_000_000)
  }
  if (trimmed.endsWith('K')) {
    return Math.round(parseFloat(trimmed.slice(0, -1)) * 1_000)
  }
  const n = parseInt(trimmed, 10)
  return isNaN(n) ? 0 : n
}
