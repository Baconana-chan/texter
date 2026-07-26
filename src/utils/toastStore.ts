export type ToastType = 'success' | 'error' | 'warning' | 'info'

const EXIT_ANIMATION_MS = 300

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number // ms, 0 = persistent
  createdAt: number
  leaving?: boolean
}

let toasts: Toast[] = []
const listeners = new Set<() => void>()

let counter = 0
function nextId(): string {
  return `toast_${++counter}_${Date.now()}`
}

function notify() {
  for (const fn of listeners) fn()
}

/** Remove a toast from the array immediately (internal) */
function removeNow(id: string) {
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx === -1) return
  toasts = [...toasts.slice(0, idx), ...toasts.slice(idx + 1)]
  notify()
}

export function addToast(
  message: string,
  type: ToastType = 'info',
  duration: number = 4000,
): string {
  const id = nextId()
  const toast: Toast = { id, message, type, duration, createdAt: Date.now() }
  toasts = [...toasts, toast]
  notify()

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }

  return id
}

export function dismissToast(id: string) {
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx === -1 || toasts[idx].leaving) return

  // Mark as leaving → triggers exit animation
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t))
  notify()

  // Actually remove after animation completes
  setTimeout(() => removeNow(id), EXIT_ANIMATION_MS)
}

export function dismissAll() {
  toasts = []
  notify()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function getToasts(): Toast[] {
  return toasts
}
