import type { ComponentChildren } from 'preact'

interface TooltipProps {
  label: string
  children: ComponentChildren
  /** Optional keyboard shortcut to display */
  shortcut?: string
}

/**
 * Wraps a button/element with a custom tooltip that appears on hover.
 * Uses pure CSS for delay/animation — no JS state needed.
 *
 * Usage:
 *  <Tooltip label="Reply" shortcut="R">
 *    <button>...</button>
 *  </Tooltip>
 */
export function Tooltip({ label, shortcut, children }: TooltipProps) {
  return (
    <span class="tooltip-wrap">
      {children}
      <span class="tooltip" role="tooltip">
        <span class="tooltip__label">{label}</span>
        {shortcut && <kbd class="tooltip__shortcut">{shortcut}</kbd>}
      </span>
    </span>
  )
}
