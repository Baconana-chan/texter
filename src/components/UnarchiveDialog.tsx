import { useState, useEffect, useMemo } from 'preact/hooks'
import { extractArchive, type ArchiveEntry, isTextFile, entryToText } from '../utils/archiveParser'

interface UnarchiveDialogProps {
  file: File
  onSelect: (entries: { name: string; content: string }[]) => void
  onClose: () => void
}

export function UnarchiveDialog({ file, onSelect, onClose }: UnarchiveDialogProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0) // 0–100
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [previewEntry, setPreviewEntry] = useState<ArchiveEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setProgress(0)
      try {
        // Simulate progress for Rust-based extractions (7z, rar) which can be slow
        // Show progress quickly to indicate activity, then jump to 90%
        const progressTimer = setInterval(() => {
          if (cancelled) {
            clearInterval(progressTimer)
            return
          }
          setProgress((p) => {
            if (p < 80) return p + 5
            return p
          })
        }, 200)

        const result = await extractArchive(file)

        if (cancelled) return
        clearInterval(progressTimer)
        setProgress(100)

        setEntries(result)
        // Auto-select all text files
        const autoSelected = new Set<number>()
        result.forEach((entry, i) => {
          if (isTextFile(entry.name)) autoSelected.add(i)
        })
        setSelected(autoSelected)
        setLoading(false)
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to extract archive')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [file])

  const toggleEntry = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index); else next.add(index)
      return next
    })
  }

  const selectAll = () => {
    const all = new Set<number>()
    entries.forEach((_, i) => all.add(i))
    setSelected(all)
  }

  const deselectAll = () => setSelected(new Set())

  const handleSend = () => {
    const result = entries
      .filter((_, i) => selected.has(i))
      .map((entry) => ({
        name: entry.name,
        content: isTextFile(entry.name) ? entryToText(entry) : `[Binary file: ${entry.name} — ${(entry.size / 1024).toFixed(1)} KB]`,
      }))
    onSelect(result)
    onClose()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const totalSize = useMemo(
    () => entries.filter((_, i) => selected.has(i)).reduce((sum, e) => sum + e.size, 0),
    [entries, selected],
  )

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog unarchive-dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div class="dialog__header">
          <h2 class="dialog__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            {file.name}
          </h2>
          <button class="btn btn--ghost btn--icon" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="dialog__body">
          {loading && (
            <div class="unarchive__loading">
              <div class="spinner" />
              <p>Extracting {file.name}...</p>
              <div class="progress-bar">
                <div
                  class="progress-bar__fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span class="progress-bar__label">
                {file.size > 1024 * 1024
                  ? `${(file.size / 1024 / 1024).toFixed(1)} MB archive`
                  : `${(file.size / 1024).toFixed(1)} KB archive`}
                — processing...
              </span>
            </div>
          )}

          {error && (
            <div class="unarchive__error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Actions bar */}
              <div class="unarchive__actions">
                <span class="unarchive__count">
                  {entries.length} file{entries.length !== 1 ? 's' : ''} found
                </span>
                <div class="unarchive__actions-right">
                  <button class="btn btn--ghost btn--small" onClick={selectAll}>Select all</button>
                  <button class="btn btn--ghost btn--small" onClick={deselectAll}>Deselect all</button>
                </div>
              </div>

              {/* File list */}
              <div class="unarchive__list">
                {entries.map((entry, i) => {
                  const isText = isTextFile(entry.name)
                  const isSelected = selected.has(i)
                  const isPreviewing = previewEntry === entry

                  return (
                    <div
                      key={`${i}-${entry.name}`}
                      class={`unarchive__item ${isSelected ? 'unarchive__item--selected' : ''}`}
                    >
                      <label class="unarchive__item-check">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEntry(i)}
                        />
                      </label>
                      <div class="unarchive__item-body" onClick={() => toggleEntry(i)}>
                        <div class="unarchive__item-name">
                          {isText ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="9" y1="15" x2="15" y2="15" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
                          )}
                          <span>{entry.name}</span>
                        </div>
                        <span class="unarchive__item-size">{formatSize(entry.size)}</span>
                      </div>
                      {isText && (
                        <button
                          class="btn btn--ghost btn--small unarchive__preview-btn"
                          onClick={() => setPreviewEntry(isPreviewing ? null : entry)}
                          title="Preview"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Preview */}
              {previewEntry && (
                <div class="unarchive__preview">
                  <div class="unarchive__preview-header">
                    <span class="unarchive__preview-name">{previewEntry.name}</span>
                    <button class="btn btn--ghost btn--small" onClick={() => setPreviewEntry(null)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <pre class="unarchive__preview-content">{entryToText(previewEntry)}</pre>
                </div>
              )}
            </>
          )}
        </div>

        <div class="dialog__footer">
          <span class="form-hint">
            {selected.size} file{selected.size !== 1 ? 's' : ''} selected
            {selected.size > 0 ? ` (${formatSize(totalSize)})` : ''}
          </span>
          <div class="dialog__footer-right">
            <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button
              class="btn btn--primary"
              onClick={handleSend}
              disabled={selected.size === 0}
            >
              Send {selected.size} file{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
