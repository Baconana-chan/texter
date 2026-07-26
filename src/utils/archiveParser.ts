/**
 * Extract text files from archives.
 * - .zip -> fflate unzipSync
 * - .tar -> simple TAR block parser (with GNU long filename support)
 * - .tar.gz / .tgz -> gunzip then TAR parse
 * - .gz -> gunzip only (single file)
 * - .7z -> invokes Tauri Rust command via spawn_blocking
 */

export interface ArchiveEntry {
  name: string
  content: Uint8Array
  size: number
}

export type ArchiveFormat = 'zip' | 'tar' | 'tgz' | 'gz' | '7z' | 'rar' | null

export function detectArchiveFormat(name: string): ArchiveFormat {
  const n = name.toLowerCase()
  if (n.endsWith('.zip')) return 'zip'
  if (n.endsWith('.tar.gz') || n.endsWith('.tgz')) return 'tgz'
  if (n.endsWith('.tar')) return 'tar'
  if (n.endsWith('.gz')) return 'gz'
  if (n.endsWith('.7z')) return '7z'
  if (n.endsWith('.rar')) return 'rar'
  if (n.endsWith('.tar.bz2')) return 'tar'
  if (n.endsWith('.tar.xz')) return 'tar'
  return null
}

export async function extractArchive(file: File): Promise<ArchiveEntry[]> {
  const format = detectArchiveFormat(file.name)
  if (!format) throw new Error('Unsupported archive format: ' + file.name)

  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)

  switch (format) {
    case 'zip': return extractZip(data)
    case 'tgz': return extractTgz(data)
    case 'tar': return extractTar(data)
    case 'gz':  return extractGzFile(data)
    case '7z':  return extract7z(data)
    case 'rar': return extractRar(data)
  }
}

// ── ZIP via fflate ────────────────────────────────

async function extractZip(data: Uint8Array): Promise<ArchiveEntry[]> {
  const fflate = await import('fflate')
  const files = fflate.unzipSync(data)
  return Object.entries(files)
    .filter(([name]) => !name.startsWith('__MACOSX/') && !name.endsWith('/'))
    .map(([name, content]) => ({
      name: normalizePath(name),
      content,
      size: content.length,
    }))
}

// ── GZIP via fflate ───────────────────────────────

async function gunzipData(data: Uint8Array): Promise<Uint8Array> {
  const fflate = await import('fflate')
  return fflate.gunzipSync(data)
}

async function extractGzFile(data: Uint8Array): Promise<ArchiveEntry[]> {
  const decompressed = await gunzipData(data)
  return [{ name: 'extracted', content: decompressed, size: decompressed.length }]
}

// ── TAR (block parser with GNU long filename support) ──

async function extractTgz(data: Uint8Array): Promise<ArchiveEntry[]> {
  return parseTar(await gunzipData(data))
}

async function extractTar(data: Uint8Array): Promise<ArchiveEntry[]> {
  return parseTar(data)
}

function parseTar(data: Uint8Array): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []
  let offset = 0
  let pendingName: string | null = null

  while (offset + 512 <= data.length) {
    const view = new DataView(data.buffer, data.byteOffset + offset, 512)

    // Check for end-of-archive
    let isEmpty = true
    for (let i = 0; i < 512; i++) {
      if (view.getUint8(i) !== 0) { isEmpty = false; break }
    }
    if (isEmpty) break

    // Name: bytes 0-99
    const rawName = readStr(view, 0, 100)
    // Prefix: bytes 345-500 (GNU/USTAR extension for long paths)
    const prefix = readStr(view, 345, 155)

    // Size: bytes 124-135 (octal)
    const sizeStr = readStr(view, 124, 12).trim()
    const size = parseInt(sizeStr, 8) || 0

    // Type flag: byte 156
    const typeFlag = view.getUint8(156)

    // Handle GNU long name entry ('L' = 76)
    if (typeFlag === 76) {
      offset += 512
      const nameBytes = data.slice(offset, offset + size)
      pendingName = new TextDecoder().decode(nameBytes).replace(/\0/g, '').trim()
      offset += Math.ceil(size / 512) * 512
      continue
    }

    // Handle GNU long link entry ('K' = 75) — skip
    if (typeFlag === 75) {
      offset += 512 + Math.ceil(size / 512) * 512
      continue
    }

    const fullName = pendingName || (prefix ? prefix + '/' + rawName : rawName)
    pendingName = null

    offset += 512

    if (size > 0 && (typeFlag === 48 || typeFlag === 0)) {
      const fileData = data.slice(offset, offset + size)
      entries.push({
        name: normalizePath(fullName),
        content: fileData,
        size: fileData.length,
      })
    }

    offset += Math.ceil(size / 512) * 512
  }

  return entries
}

function readStr(view: DataView, offset: number, length: number): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length)
  const end = bytes.indexOf(0)
  return new TextDecoder().decode(bytes.slice(0, end >= 0 ? end : length))
}

// ── 7z via Tauri command (Rust backend) ───────────

async function extract7z(data: Uint8Array): Promise<ArchiveEntry[]> {
  const base64 = await uint8ArrayToBase64(data)

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const entries = await invoke<{ name: string; content: string; size: number }[]>('extract_7z', {
      dataB64: base64,
    })

    return entries
      .filter((e) => e.content.length > 0)
      .map((e) => ({
        name: normalizePath(e.name),
        content: base64ToUint8Array(e.content),
        size: e.size,
      }))
  } catch (err) {
    throw new Error('7z extraction failed: ' + (err instanceof Error ? err.message : String(err)))
  }
}

// ── RAR via Tauri command (Rust backend) ──────────

async function extractRar(data: Uint8Array): Promise<ArchiveEntry[]> {
  const base64 = await uint8ArrayToBase64(data)

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const entries = await invoke<{ name: string; content: string; size: number }[]>('extract_rar', {
      dataB64: base64,
    })

    return entries
      .filter((e) => e.content.length > 0)
      .map((e) => ({
        name: normalizePath(e.name),
        content: base64ToUint8Array(e.content),
        size: e.size,
      }))
  } catch (err) {
    throw new Error('RAR extraction failed: ' + (err instanceof Error ? err.message : String(err)))
  }
}

// ── Base64 helpers ────────────────────────────────

async function uint8ArrayToBase64(data: Uint8Array): Promise<string> {
  const blob = new Blob([data as BlobPart])
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(new Error('Failed to convert to base64'))
    reader.readAsDataURL(blob)
  })
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ── Helpers ───────────────────────────────────────

function normalizePath(path: string): string {
  return path.replace(/^\.\//, '').replace(/\\/g, '/')
}

export function isTextFile(name: string): boolean {
  const textExtensions = [
    '.txt', '.md', '.json', '.csv', '.xml', '.yaml', '.yml', '.log',
    '.ini', '.cfg', '.env', '.toml', '.conf',
    '.py', '.js', '.ts', '.jsx', '.tsx', '.rs', '.go', '.java', '.cpp',
    '.c', '.h', '.hpp', '.rb', '.php', '.sh', '.bash', '.zsh',
    '.sql', '.r', '.lua', '.dart', '.swift', '.kt', '.scala',
    '.html', '.css', '.scss', '.less', '.sass',
    '.docx', '.pdf', '.odt', '.pptx', '.epub', '.rtf', '.xlsx',
  ]
  const lower = name.toLowerCase()
  return textExtensions.some((ext) => lower.endsWith(ext))
}

export function entryToText(entry: ArchiveEntry): string {
  return new TextDecoder().decode(entry.content)
}
