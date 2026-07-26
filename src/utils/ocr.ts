/**
 * OCR (Optical Character Recognition) using Tesseract.js
 * Loaded lazily — first image that needs OCR triggers the download.
 * Supports per-call language selection with automatic worker recreation.
 *
 * Caching: Tesseract.js v7 automatically caches downloaded .traineddata
 * files in its own IndexedDB store. On first use per language, the file
 * is fetched from the CDN and cached. Subsequent uses load from
 * IndexedDB instantly.
 *
 * The pre-cache functions below let you download the data ahead of time
 * by creating a temporary worker (which triggers Tesseract's internal
 * download + caching) and then immediately terminating it. The next time
 * a real worker is created for that language, it loads from the cache.
 */

let workerPromise: Promise<import('tesseract.js').Worker> | null = null
/** Language the current worker was created with */
let currentLang = ''

async function getWorker(language: string): Promise<import('tesseract.js').Worker> {
  // If language changed, terminate old worker and create a new one
  if (workerPromise && currentLang !== language) {
    const oldWorker = await workerPromise
    try { oldWorker.terminate() } catch { /* ignore */ }
    workerPromise = null
    currentLang = ''
  }

  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await import('tesseract.js')
      const worker = await Tesseract.createWorker(language)
      currentLang = language
      return worker
    })()
  }

  return workerPromise
}

/**
 * Extract text from an image using OCR.
 * @param dataUrl — base64 data URL of the image
 * @param language — Tesseract language string, e.g. 'eng', 'eng+rus', 'deu', 'fra'
 * @returns Recognized text, or empty string on failure
 */
export async function extractImageText(dataUrl: string, language?: string): Promise<string> {
  try {
    const lang = language || 'eng+rus'
    const worker = await getWorker(lang)
    const { data } = await worker.recognize(dataUrl)
    return (data.text || '').trim()
  } catch (err) {
    console.warn('OCR failed:', err)
    return ''
  }
}

// ── Pre-cache ─────────────────────────────────────

/**
 * In-memory set of languages that have been pre-cached this session.
 * On app restart this resets, but Tesseract's own IndexedDB cache
 * persists across sessions, so the next real worker creation will
 * find the data there.
 */
const preCachedLangs = new Set<string>()

/**
 * Check if a language has been pre-cached in this session.
 * Note: even if this returns false, Tesseract might have the data
 * cached internally from a previous session.
 */
export async function isLanguageCached(language: string): Promise<boolean> {
  const langs = language.split('+').filter(Boolean)
  return langs.every((l) => preCachedLangs.has(l))
}

/**
 * Pre-cache language data files from the CDN.
 * Downloads the .traineddata.gz file with progress tracking,
 * then creates a temporary Tesseract worker to populate its
 * internal IndexedDB cache.
 *
 * After this completes:
 * - Tesseract's internal IndexedDB cache has the data (persists across sessions)
 * - Subsequent OCR calls for this language will load from cache instantly
 *
 * @param language — e.g. 'eng', 'eng+rus' (pre-caches each sub-language)
 * @param onProgress — callback with bytes loaded (total may be 0 if unknown)
 */
export async function preCacheLanguage(
  language: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  // Split multi-language (e.g. 'eng+rus' → ['eng', 'rus'])
  const langs = language.split('+').filter(Boolean)
  const uniqueLangs = [...new Set(langs)]

  for (const lang of uniqueLangs) {
    if (preCachedLangs.has(lang)) continue

    console.log(`[OCR] Pre-caching language: ${lang}`)

    // Download with progress
    const url = `https://tessdata.projectnaptha.com/4.0.0/${lang}.traineddata.gz`
    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.warn(`[OCR] Failed to download ${lang}: HTTP ${response.status}`)
        continue
      }

      const contentLength = response.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength, 10) : 0
      const reader = response.body?.getReader()
      if (!reader) {
        console.warn(`[OCR] No response body for ${lang}`)
        continue
      }

      let loaded = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          loaded += value.length
          if (total > 0) onProgress?.(loaded, total)
        }
      }

      console.log(`[OCR] Downloaded ${lang} (${(loaded / 1024 / 1024).toFixed(1)} MB)`)
    } catch (err) {
      console.warn(`[OCR] Failed to download ${lang}:`, err)
      continue
    }

    // Warm up Tesseract's internal IndexedDB cache by creating and terminating a worker
    // This ensures the next real worker creation for this language is instant
    try {
      const Tesseract = await import('tesseract.js')
      const w = await Tesseract.createWorker(lang)
      await w.terminate()
      preCachedLangs.add(lang)
      console.log(`[OCR] Pre-cached ${lang} successfully`)
    } catch (err) {
      console.warn(`[OCR] Failed to warm up cache for ${lang}:`, err)
    }
  }
}
