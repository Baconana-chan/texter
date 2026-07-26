/**
 * Extract text content from a file.
 * - .txt / .md / .json / code → FileReader.readAsText
 * - .docx → mammoth.extractRawText
 * - .pdf → pdfjs-dist getDocument + getTextContent
 * - .odt → fflate unzip + content.xml text:p extraction
 * - .pptx → fflate unzip + slide XML <a:t> extraction → --- separated
 * - .xlsx → fflate unzip + shared strings + sheet XML → Markdown table
 * - .epub → fflate unzip + HTML→Markdown with TOC and chapters
 * - .rtf → strip RTF control sequences
 * - .ipynb → JSON parse, extract code/markdown cells
 * - .html → strip HTML tags, keep text
 */
export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.docx')) {
    return extractDocx(file)
  }

  if (name.endsWith('.pdf')) {
    return extractPdf(file)
  }

  if (name.endsWith('.odt')) {
    return extractOdt(file)
  }

  if (name.endsWith('.pptx')) {
    return extractPptx(file)
  }

  if (name.endsWith('.xlsx')) {
    return extractXlsx(file)
  }

  if (name.endsWith('.epub')) {
    return extractEpub(file)
  }

  if (name.endsWith('.mobi') || name.endsWith('.azw') || name.endsWith('.azw3')) {
    return '[Error: MOBI/AZW is a proprietary Amazon format. Please convert to EPUB using Calibre or similar tools.]'
  }

  if (name.endsWith('.rtf')) {
    return extractRtf(file)
  }

  // Read file as text first (needed for .ipynb and .html)
  const text = await readFileAsText(file)

  if (name.endsWith('.ipynb')) {
    return extractIpynb(text)
  }

  if (name.endsWith('.html') || name.endsWith('.htm')) {
    return stripHtml(text)
  }

  // Plain text for everything else
  return text
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string ?? '')
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

async function extractDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value || ''
}

// ── .odt parser (ZIP + XML) ────────────────────────
// ODF documents are ZIP archives containing content.xml with <text:p> paragraphs

async function extractOdt(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const fflate = await import('fflate')
  const files = fflate.unzipSync(new Uint8Array(buffer))

  const xmlBytes = files['content.xml']
  if (!xmlBytes) return '[Error: no content.xml found in ODT]'

  const xml = new TextDecoder().decode(xmlBytes)
  return parseOdfXml(xml)
}

function parseOdfXml(xml: string): string {
  const paragraphs: string[] = []

  // Extract all <text:p>...</text:p> content
  const pRegex = /<text:p[^>]*>([\s\S]*?)<\/text:p>/gi
  let match: RegExpExecArray | null

  while ((match = pRegex.exec(xml)) !== null) {
    let inner = match[1]

    // Convert tab/line-break BEFORE stripping remaining tags
    inner = inner
      .replace(/<text:tab\s*\/>/g, '\t')
      .replace(/<text:line-break\s*\/>/g, '\n')
      // Remove remaining XML tags
      .replace(/<[^>]+>/g, '')
      // Decode XML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim()

    if (inner) paragraphs.push(inner)
  }

  const joined = paragraphs.join('\n\n')
  return joined || '[Empty ODT document]'
}

// ── .pptx parser (ZIP + XML) ──────────────────────
// PPTX files are ZIP archives with slide XMLs containing DrawingML elements.
// This parser extracts:
//   - Tables → Markdown tables
//   - Bulleted/numbered lists → nested - / 1. lists
//   - Headings → # / ## / ### by font size
//   - Bold/italic → **text** / *text*
//   - Line breaks → preserved within paragraphs

async function extractPptx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const fflate = await import('fflate')
  const files = fflate.unzipSync(new Uint8Array(buffer))

  // Find all slide XMLs (ppt/slides/slide1.xml, slide2.xml, etc.)
  const slidePaths = Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort()

  if (slidePaths.length === 0) return '[Error: no slides found in PPTX]'

  const slides: string[] = []

  for (const slidePath of slidePaths) {
    const xml = new TextDecoder().decode(files[slidePath])
    const text = parseSlideXmlStructured(xml)
    const slideNum = slidePath.match(/slide(\d+)\.xml/)?.[1] ?? '?'

    if (text) {
      slides.push(`--- Slide ${slideNum} ---\n${text}`)
    } else {
      slides.push(`--- Slide ${slideNum} ---\n[Empty slide]`)
    }
  }

  return slides.join('\n\n')
}

/** Decode common XML entities */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
}

// ── PPTX: Tables ──────────────────────────────────

/** Parse an <a:tbl> element into a Markdown table string */
function parseTblToMarkdown(tblXml: string): string {
  const rows: string[][] = []

  // Match <a:tr>...</a:tr> table rows
  const trRegex = /<a:tr[^>]*>([\s\S]*?)<\/a:tr>/gi
  let trMatch: RegExpExecArray | null

  while ((trMatch = trRegex.exec(tblXml)) !== null) {
    const trContent = trMatch[1]
    const cells: string[] = []

    // Match <a:tc>...</a:tc> table cells
    const tcRegex = /<a:tc[^>]*>([\s\S]*?)<\/a:tc>/gi
    let tcMatch: RegExpExecArray | null

    while ((tcMatch = tcRegex.exec(trContent)) !== null) {
      const tcContent = tcMatch[1]
      // Extract text from cell's text body
      const cellText = extractTblCellText(tcContent)
      cells.push(cellText.replace(/\|/g, '\\|'))
    }

    if (cells.length > 0) rows.push(cells)
  }

  if (rows.length === 0) return ''

  // Normalize column count
  const maxCols = Math.max(...rows.map((r) => r.length))
  const normalized = rows.map((r) => {
    const row = [...r]
    while (row.length < maxCols) row.push('')
    return row
  })

  const lines: string[] = []
  // Header row (first row is header in PPTX)
  lines.push('| ' + normalized[0].join(' | ') + ' |')
  // Separator
  lines.push('| ' + normalized[0].map(() => '---').join(' | ') + ' |')
  // Data rows
  for (let i = 1; i < normalized.length; i++) {
    lines.push('| ' + normalized[i].join(' | ') + ' |')
  }

  return lines.join('\n')
}

/** Extract plain text from a table cell's <a:txBody> */
function extractTblCellText(tcXml: string): string {
  const pRegex = /<a:p[^>]*>([\s\S]*?)<\/a:p>/gi
  const lines: string[] = []
  let m: RegExpExecArray | null
  while ((m = pRegex.exec(tcXml)) !== null) {
    const text = extractRunTextFormatted(m[1])
    if (text.trim()) lines.push(text.trim())
  }
  return lines.join('; ')
}

// ── PPTX: Paragraph parsing ──────────────────────

/** Extract text runs from an <a:p> paragraph body with formatting info */
function extractRunTextFormatted(paraXml: string): string {
  const rRegex = /<a:r[^>]*>([\s\S]*?)<\/a:r>/gi
  const parts: string[] = []
  let m: RegExpExecArray | null

  while ((m = rRegex.exec(paraXml)) !== null) {
    const rContent = m[1]

    // Check for bold <a:b/> and italic <a:i/> in <a:rPr>
    const hasBold = /<a:b\s*\/>/.test(rContent)
    const hasItalic = /<a:i\s*\/>/.test(rContent)

    // Extract text
    const tMatch = rContent.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/)
    if (!tMatch) continue
    let text = decodeXmlEntities(tMatch[1])

    if (hasBold) text = `**${text}**`
    if (hasItalic) text = `*${text}*`

    parts.push(text)
  }

  return parts.join('')
}

/** Extract font size from paragraph's <a:rPr> (returned in points) */
function getParagraphFontSize(paraXml: string): number {
  // Find first run with a font size
  const szMatch = paraXml.match(/<a:sz[^>]*val="([^"]+)"/)
  if (szMatch) {
    return parseInt(szMatch[1], 10) / 100 // stored in hundredths of a point
  }
  return 18 // default body text
}

/** Get heading marker based on font size */
function headingMarker(sizePt: number): string | null {
  if (sizePt >= 40) return '# '
  if (sizePt >= 28) return '## '
  if (sizePt >= 22) return '### '
  return null
}

/**
 * Parse a single <a:p> paragraph into a structured line.
 * Returns { text, level, isList, prefix } where:
 *   - level: 0-based indent level (from <a:pPr lvl="N">)
 *   - isList: true if has bullet or auto-number
 *   - prefix: ' - ' for unordered, '1.' etc. for ordered, null for normal
 */
function parseParagraph(paraXml: string): {
  text: string
  level: number
  isList: boolean
  prefix: string | null
  isHeading: boolean
} {
  const result = { text: '', level: 0, isList: false, prefix: null as string | null, isHeading: false }

  // Extract <a:pPr> (if present)
  const pPrMatch = paraXml.match(/<a:pPr[^>]*>([\s\S]*?)<\/a:pPr>/)
  const pPrXml = pPrMatch ? pPrMatch[0] : ''

  // Check indent level from <a:pPr lvl="N"> (can be on pPr element itself or as child)
  const lvlAttr = pPrXml.match(/lvl="(\d+)"/)
  const lvlChild = pPrXml.match(/<a:lvl[^>]*val="(\d+)"/)
  result.level = parseInt((lvlAttr?.[1] ?? lvlChild?.[1] ?? '0'), 10)

  // Check for bullet types
  const hasBuChar = /<a:buChar\s/.test(pPrXml)
  const hasBuAutoNum = /<a:buAutoNum\s/.test(pPrXml)
  const hasBuNone = /<a:buNone\s/.test(pPrXml)

  result.isList = (hasBuChar || hasBuAutoNum) && !hasBuNone

  if (result.isList && hasBuAutoNum) {
    // Ordered list — prefix will be determined by level
    result.prefix = '1.'
  } else if (result.isList) {
    result.prefix = '-'
  }

  // Get font size for heading detection (only if not a list item)
  if (!result.isList) {
    const fontSize = getParagraphFontSize(paraXml)
    result.isHeading = fontSize >= 22
  }

  // Extract formatted text
  const lines: string[] = []
  
  // Check for <a:br/> inside runs
  if (/<a:br\s*\/>/.test(paraXml)) {
    const segments = paraXml.split(/<a:br\s*\/>/)
    for (const seg of segments) {
      const text = extractRunTextFormatted(seg)
      if (text.trim()) lines.push(text.trim())
    }
  } else {
    const text = extractRunTextFormatted(paraXml)
    lines.push(text.trim())
  }

  result.text = lines.join('\n')
  return result
}

/**
 * Parse a PPTX slide XML into structured Markdown.
 * Handles tables, lists, headings, and formatted text.
 * Tables are parsed separately from paragraphs, then merged
 * in document order using position tracking.
 */
function parseSlideXmlStructured(xml: string): string {
  // ── 1. Collect all top-level elements with their positions ──
  // Match both <a:tbl> and <a:p> with their start positions
  interface SlideElement {
    type: 'para' | 'tbl'
    xml: string
  }

  const elements: SlideElement[] = []

  // Use a combined regex to find either <a:tbl> or <a:p> in order of appearance
  const combinedRegex = /(<a:tbl[^>]*>[\s\S]*?<\/a:tbl>)|(<a:p[^>]*>[\s\S]*?<\/a:p>)/gi
  let elMatch: RegExpExecArray | null

  while ((elMatch = combinedRegex.exec(xml)) !== null) {
    if (elMatch[1]) {
      // It's a table
      elements.push({ type: 'tbl', xml: elMatch[1] })
    } else if (elMatch[2]) {
      // It's a paragraph
      elements.push({ type: 'para', xml: elMatch[2] })
    }
  }

  // ── 2. Parse each element ────────────────
  const blocks: string[] = []
  let idx = 0

  while (idx < elements.length) {
    const el = elements[idx]

    if (el.type === 'tbl') {
      const md = parseTblToMarkdown(el.xml)
      if (md) blocks.push(md)
      idx++
      continue
    }

    // Extract paragraph body (content between <a:p> and </a:p>)
    const pBodyMatch = el.xml.match(/<a:p[^>]*>([\s\S]*)<\/a:p>/)
    if (!pBodyMatch) { idx++; continue }
    const pBody = pBodyMatch[1]

    const info = parseParagraph(pBody)
    if (!info.text) { idx++; continue }

    if (info.isList) {
      // Group consecutive list items (at same or deeper level)
      const listLines: string[] = [renderListItem(info)]
      idx++

      while (idx < elements.length) {
        const next = elements[idx]
        if (next.type !== 'para') break
        const nextMatch = next.xml.match(/<a:p[^>]*>([\s\S]*)<\/a:p>/)
        if (!nextMatch) { idx++; break }
        const nextInfo = parseParagraph(nextMatch[1])
        if (!nextInfo.isList || nextInfo.level > info.level + 1) break
        listLines.push(renderListItem(nextInfo))
        idx++
      }

      blocks.push(listLines.join('\n'))
    } else if (info.isHeading) {
      const fontSize = getParagraphFontSize(pBody)
      const marker = headingMarker(fontSize) ?? ''
      blocks.push(`${marker}${info.text}`)
      idx++
    } else {
      blocks.push(info.text)
      idx++
    }
  }

  return blocks.join('\n\n')
}

/** Render a single list item with proper indentation and prefix */
function renderListItem(item: { text: string; level: number; prefix: string | null }): string {
  const indent = '  '.repeat(item.level)
  const prefix = item.prefix === '1.' ? '1.' : '-'
  return `${indent}${prefix} ${item.text}`
}

// ── .xlsx parser (ZIP + XML) ──────────────────────
// XLSX files are ZIP archives with shared strings + sheet XML
// Extracts all sheets and converts to Markdown tables

async function extractXlsx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const fflate = await import('fflate')
  const files = fflate.unzipSync(new Uint8Array(buffer))

  // Parse shared strings table
  const sharedStrings = parseSharedStrings(files)

  // Find all sheet XMLs (sheet1, sheet2, etc.)
  const sheetNames = Object.keys(files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort()

  if (sheetNames.length === 0) return '[Error: no sheets found in XLSX]'

  const tables: string[] = []

  for (const sheetPath of sheetNames) {
    const xml = new TextDecoder().decode(files[sheetPath])
    const markdown = parseSheetXml(xml, sharedStrings)

    // Extract sheet name from the file (or use number)
    const sheetNum = sheetPath.match(/sheet(\d+)\.xml/)?.[1] ?? '?'
    // Try to find sheet name in xl/workbook.xml
    const sheetName = findSheetName(files, sheetNum)

    if (markdown) {
      const header = sheetName
        ? `--- Sheet: ${sheetName} ---`
        : `--- Sheet ${sheetNum} ---`
      tables.push(header + '\n' + markdown)
    }
  }

  return tables.length > 0
    ? tables.join('\n\n')
    : '[Empty Excel document]'
}

/** Parse sharedStrings.xml into an array of strings */
function parseSharedStrings(files: Record<string, Uint8Array>): string[] {
  const ssBytes = files['xl/sharedStrings.xml']
  if (!ssBytes) return []

  const xml = new TextDecoder().decode(ssBytes)
  const strings: string[] = []

  // Match <si>...</si> items
  const siRegex = /<si[^>]*>([\s\S]*?)<\/si>/gi
  let match: RegExpExecArray | null

  while ((match = siRegex.exec(xml)) !== null) {
    const siContent = match[1]

    // Handle both <t>text</t> and <r><t>text</t></r> (rich text)
    // Extract all <t>...</t> content and join
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/gi
    let tMatch: RegExpExecArray | null
    const parts: string[] = []

    while ((tMatch = tRegex.exec(siContent)) !== null) {
      let text = tMatch[1]
        // Decode XML entities
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")

      // Handle xml:space="preserve" — keep whitespace exactly
      parts.push(text)
    }

    strings.push(parts.join(''))
  }

  return strings
}

/** Parse a worksheet XML and convert to Markdown table */
function parseSheetXml(xml: string, sharedStrings: string[]): string {
  // Extract all <row> elements
  const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/gi
  let rowMatch: RegExpExecArray | null

  const rows: string[][] = []
  let maxCols = 0

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1]
    const cells = parseRowCells(rowContent, sharedStrings)
    if (cells.length > 0) {
      rows.push(cells)
      maxCols = Math.max(maxCols, cells.length)
    }
  }

  if (rows.length === 0) return ''

  // Normalize all rows to same column count
  const normalized = rows.map((row) => {
    const r = [...row]
    while (r.length < maxCols) r.push('')
    return r
  })

  // Build Markdown table
  const lines: string[] = []

  // Header row
  const firstRow = normalized[0].map((cell) => cell.replace(/\|/g, '\\|').replace(/\n/g, ' '))
  lines.push('| ' + firstRow.join(' | ') + ' |')

  // Separator row
  const seps = firstRow.map(() => '---')
  lines.push('| ' + seps.join(' | ') + ' |')

  // Data rows
  for (let i = 1; i < normalized.length; i++) {
    const row = normalized[i].map((cell) => cell.replace(/\|/g, '\\|').replace(/\n/g, ' '))
    lines.push('| ' + row.join(' | ') + ' |')
  }

  return lines.join('\n')
}

/** Parse cells from a <row> and return values in column order */
function parseRowCells(rowContent: string, sharedStrings: string[]): string[] {
  const cellRegex = /<c[^>]*>([\s\S]*?)<\/c>/gi
  let cellMatch: RegExpExecArray | null

  // Collect all cells with their column reference
  const cells: { col: number; value: string }[] = []

  while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
    const cellTag = cellMatch[0]
    const cellContent = cellMatch[1]

    // Extract column reference from <c r="A1">
    const refMatch = cellTag.match(/r="([A-Z]+)\d+"/)
    if (!refMatch) continue
    const colStr = refMatch[1]
    const colIndex = columnLetterToIndex(colStr)

    // Check cell type: t="s" means shared string
    const typeMatch = cellTag.match(/\bt="([^"]*)"/)
    const isString = typeMatch?.[1] === 's'

    // Extract <v>value</v>
    const vMatch = cellContent.match(/<v[^>]*>([\s\S]*?)<\/v>/)
    const rawValue = vMatch ? vMatch[1].trim() : ''

    let value = rawValue
    if (isString && rawValue !== '') {
      const siIndex = parseInt(rawValue, 10)
      if (!isNaN(siIndex) && siIndex >= 0 && siIndex < sharedStrings.length) {
        value = sharedStrings[siIndex]
      }
    }

    cells.push({ col: colIndex, value })
  }

  if (cells.length === 0) return []

  // Sort by column and fill gaps
  cells.sort((a, b) => a.col - b.col)
  const maxCol = cells[cells.length - 1].col
  const result: string[] = []
  let cellIdx = 0

  for (let c = 0; c <= maxCol; c++) {
    if (cellIdx < cells.length && cells[cellIdx].col === c) {
      result.push(cells[cellIdx].value)
      cellIdx++
    } else {
      result.push('') // empty cell
    }
  }

  return result
}

/** Convert column letter(s) to 0-based index: A→0, B→1, ..., Z→25, AA→26, etc. */
function columnLetterToIndex(letters: string): number {
  let result = 0
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64)
  }
  return result - 1
}

/** Try to find a human-readable sheet name from workbook.xml */
function findSheetName(files: Record<string, Uint8Array>, sheetNum: string): string | null {
  const wbBytes = files['xl/workbook.xml']
  if (!wbBytes) return null

  const xml = new TextDecoder().decode(wbBytes)
  // Match <sheet sheetId="N" name="..."/>
  const sheetRegex = new RegExp(`<sheet[^>]*sheetId="${sheetNum}"[^>]*name="([^"]+)"`)
  const match = sheetRegex.exec(xml)
  if (!match) {
    // Try matching without specific sheetId order
    const altRegex = /<sheet[^>]*name="([^"]+)"/g
    let altMatch: RegExpExecArray | null
    let idx = parseInt(sheetNum, 10)
    let count = 0
    while ((altMatch = altRegex.exec(xml)) !== null) {
      count++
      if (count === idx) return altMatch[1]
    }
    return null
  }
  return match[1]
}

// ── .rtf parser ───────────────────────────────────────
// RTF is a text format with control sequences that need stripping

async function extractRtf(file: File): Promise<string> {
  const text = await readFileAsText(file)
  return stripRtf(text)
}

function stripRtf(rtf: string): string {
  if (!rtf.startsWith('{')) return rtf // not RTF

  let result = ''
  let i = 0
  let braceDepth = 0
  let skipping = false
  let skipDepth = 0 // braceDepth when \* was encountered (group to skip)
  let inControl = false
  let controlBuf = ''

  while (i < rtf.length) {
    const ch = rtf[i]

    if (ch === '{') {
      braceDepth++
      inControl = false
      controlBuf = ''
      i++
      continue
    }

    if (ch === '}') {
      braceDepth--
      // If we just closed the group that contained \*, stop skipping
      if (skipping && braceDepth < skipDepth) {
        skipping = false
      }
      inControl = false
      controlBuf = ''
      i++
      continue
    }

    // If inside a skip group, skip everything
    if (skipping) {
      i++
      continue
    }

    if (ch === '\\') {
      i++
      if (i >= rtf.length) break
      const next = rtf[i]

      if (next === '\\' || next === '{' || next === '}') {
        // Escaped literal
        result += next
        i++
        continue
      }

      if (next === "'") {
        // Hex-encoded char: \'xx
        if (i + 2 < rtf.length) {
          const hex = rtf.slice(i + 1, i + 3)
          const code = parseInt(hex, 16)
          if (!isNaN(code)) {
            result += String.fromCharCode(code)
          }
          i += 3
          continue
        }
        i++
        continue
      }

      if (next === '\n' || next === '\r') {
        // Line continuation
        i++
        continue
      }

      // Control word: \word, \wordN, \word -N
      inControl = true
      controlBuf = next
      i++
      continue
    }

    if (inControl) {
      // Control word consists of A-Z, a-z, or '-' (for negative numbers)
      if (/[a-zA-Z-]/.test(ch)) {
        controlBuf += ch
        i++
        continue
      }

      // Optional numeric parameter
      if (/[0-9]/.test(ch)) {
        controlBuf += ch
        i++
        continue
      }

      // Space delimiter terminates the control word
      if (ch === ' ') {
        inControl = false
        // Check for skip group marker
        if (controlBuf === '*') {
          skipping = true
          skipDepth = braceDepth
        }
        // New paragraph
        if (controlBuf.startsWith('par') || controlBuf === '\n') {
          result += '\n'
        }
        // Tab
        if (controlBuf.startsWith('tab')) {
          result += '\t'
        }
        controlBuf = ''
        i++
        continue
      }

      // Non-space terminates (like { or \\ or special chars)
      if (controlBuf === '*') {
        skipping = true
        skipDepth = braceDepth
      }
      if (controlBuf.startsWith('par')) {
        result += '\n'
      }
      if (controlBuf.startsWith('tab')) {
        result += '\t'
      }
      inControl = false
      controlBuf = ''
      // Don't consume ch — it will be processed in next iteration
      continue
    }

    // Regular text — skip RTF-formatting newlines
    if (ch !== '\n' && ch !== '\r') {
      result += ch
    }
    i++
  }

  // Collapse multiple newlines
  result = result.replace(/\n{3,}/g, '\n\n').trim()
  return result || '[Empty RTF document]'
}

// ── .ipynb parser ───────────────────────────────────
// Jupyter Notebooks are JSON files with cells of code/markdown/raw content

function extractIpynb(text: string): string {
  try {
    const nb = JSON.parse(text)
    if (!nb.cells || !Array.isArray(nb.cells)) return text // not a valid notebook

    const parts: string[] = []
    for (const cell of nb.cells) {
      const cellType = cell.cell_type || 'code'
      const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '')

      if (cellType === 'markdown') {
        parts.push('--- Markdown ---\n' + source)
      } else if (cellType === 'raw') {
        parts.push('--- Raw ---\n' + source)
      } else {
        // Code cell
        const header = '--- Code' + (cell.execution_count ? ' [' + cell.execution_count + ']' : '') + ' ---'
        parts.push(header + '\n' + source)

        // Include outputs if present
        if (cell.outputs && Array.isArray(cell.outputs)) {
          for (const output of cell.outputs) {
            const text = output.text
              ? (Array.isArray(output.text) ? output.text.join('') : output.text)
              : null
            if (text) {
              parts.push('--- Output ---\n' + text)
            }
          }
        }
      }
    }

    const result = parts.join('\n\n')
    return result || text
  } catch {
    return text // fallback: return raw JSON
  }
}

// ── .html tag stripper ──────────────────────────────

function stripHtml(html: string): string {
  // 1. Remove script and style tags with their content
  let text = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')

  // 2. Replace <br>, <p>, <div>, <li>, <tr> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/\<\/(p|div|li|tr|h[1-6]|blockquote|pre)>/gi, '\n')

  // 3. Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '')

  // 4. Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&#x27;/g, "'")
  text = text.replace(/&#x2F;/g, '/')

  // 5. Collapse multiple newlines into at most 2
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

// ── .epub parser (ZIP + HTML→Markdown) ─────────────
// EPUB files are ZIP archives containing XHTML content files,
// an OPF package document, and navigation files (NCX / nav.xhtml).
// Parse order: container.xml → OPF (spine) → content files → Markdown

async function extractEpub(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const fflate = await import('fflate')
  const files = fflate.unzipSync(new Uint8Array(buffer))

  // ── 1. Find OPF from container.xml ──────────
  const containerBytes = files['META-INF/container.xml']
  if (!containerBytes) return '[Error: not a valid EPUB (no container.xml)]'
  const containerXml = new TextDecoder().decode(containerBytes)

  const opfMatch = containerXml.match(/<rootfile[^>]*full-path="([^"]+)"/i)
  if (!opfMatch) return '[Error: no OPF file found in container.xml]'
  const opfPath = opfMatch[1]
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

  // ── 2. Parse OPF (manifest + spine) ─────────
  const opfBytes = files[opfPath]
  if (!opfBytes) return `[Error: OPF file not found: ${opfPath}]`
  const opfXml = new TextDecoder().decode(opfBytes)

  // Parse manifest: <item id="..." href="..." media-type="..."/>
  const manifest = new Map<string, string>()
  const itemRegex = /<item[^>]*\s+id="([^"]+)"[^>]*\s+href="([^"]+)"[^>]*\/>/gi
  let itemMatch: RegExpExecArray | null
  while ((itemMatch = itemRegex.exec(opfXml)) !== null) {
    manifest.set(itemMatch[1], itemMatch[2])
  }

  // Also match items with properties (e.g. nav) — broader match for variations
  const itemRegex2 = /<item[^>]*\s+id="([^"]+)"[^>]*\s+href="([^"]+)"/gi
  while ((itemMatch = itemRegex2.exec(opfXml)) !== null) {
    const nextId = itemMatch[1]
    const nextHref = itemMatch[2]
    if (!manifest.has(nextId)) {
      manifest.set(nextId, nextHref)
    }
  }

  // Find nav item (EPUB 3) — item with properties="nav"
  const navIdMatch = opfXml.match(/<item[^>]*\s+id="([^"]+)"[^>]*\s+properties="nav"/i)
  const navHref = navIdMatch ? manifest.get(navIdMatch[1]) : null

  // Parse spine: <itemref idref="..."/>
  const spineItems: string[] = []
  const spineRegex = /<itemref[^>]*\s+idref="([^"]+)"/gi
  let spineMatch: RegExpExecArray | null
  while ((spineMatch = spineRegex.exec(opfXml)) !== null) {
    const idref = spineMatch[1]
    const href = manifest.get(idref)
    if (href) spineItems.push(href)
  }

  // ── 3. Parse TOC ────────────────────────────
  const toc: { title: string; href: string }[] = []

  // Try EPUB 3 nav.xhtml first
  if (navHref) {
    const navPath = opfDir + navHref
    const navBytes = files[navPath]
    if (navBytes) {
      const navHtml = new TextDecoder().decode(navBytes)
      // Find <nav epub:type="toc"> or <nav> with id="toc"
      const navTocRegex = /<nav[^>]*toc[^>]*>([\s\S]*?)<\/nav>/i
      const navTocMatch = navTocRegex.exec(navHtml)
      if (navTocMatch) {
        parseNavLinks(navTocMatch[1], opfDir, toc)
      }
    }
  }

  // Fallback: try NCX (EPUB 2) if TOC is empty
  if (toc.length === 0) {
    // Find the NCX file from manifest
    let ncxHref: string | null = null
    for (const [, ncxHrefCandidate] of manifest) {
      if (ncxHrefCandidate.endsWith('.ncx')) {
        ncxHref = ncxHrefCandidate
        break
      }
    }
    if (ncxHref) {
      const ncxPath = opfDir + ncxHref
      const ncxBytes = files[ncxPath]
      if (ncxBytes) {
        const ncxXml = new TextDecoder().decode(ncxBytes)
        parseNcx(ncxXml, opfDir, toc)
      }
    }
  }

  // ── 4. Extract metadata ─────────────────────
  const title = extractXmlText(opfXml, /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)
  const author = extractXmlText(opfXml, /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)

  // ── 5. Parse content files in spine order ───
  const chapters: string[] = []
  const seenContent = new Set<string>()

  for (const href of spineItems) {
    const fullPath = opfDir + href
    const contentBytes = files[fullPath]
    if (!contentBytes) continue

    // Skip if already seen (duplicate spine entry)
    const normalizedHref = href.split('#')[0]
    if (seenContent.has(normalizedHref)) continue
    seenContent.add(normalizedHref)

    const rawHtml = new TextDecoder().decode(contentBytes)
    const text = htmlToMarkdownEpub(rawHtml, opfDir)

    // Find chapter title from TOC or first heading
    let chapterTitle = ''
    const tocEntry = toc.find((t) => {
      const tocPath = t.href.split('#')[0].replace(/\\/g, '/')
      return tocPath === normalizedHref || tocPath.endsWith('/' + normalizedHref)
    })
    if (tocEntry) {
      chapterTitle = tocEntry.title
    } else {
      // Extract first heading
      const hMatch = text.match(/^(#{1,6}\s.+)$/m)
      if (hMatch) chapterTitle = hMatch[1].replace(/^#{1,6}\s+/, '')
    }

    if (text.trim()) {
      chapters.push(chapterTitle
        ? `--- ${chapterTitle} ---\n${text.trim()}`
        : `--- Chapter ${chapters.length + 1} ---\n${text.trim()}`)
    }
  }

  // ── 6. Build output ─────────────────────────
  let output = ''

  if (title) output += `# ${title}\n`
  if (author) output += `*by ${author}*\n`
  output += '\n'

  // Include TOC
  if (toc.length > 0) {
    output += '## Table of Contents\n\n'
    for (const entry of toc) {
      const indent = '  '.repeat(entry.href.split('/').length - 1)
      output += `${indent}- ${entry.title}\n`
    }
    output += '\n---\n\n'
  }

  if (chapters.length === 0) return '[Empty EPUB — no readable content]'
  output += chapters.join('\n\n')

  return output
}

/** Extract text from a single XML tag regex match */
function extractXmlText(xml: string, regex: RegExp): string {
  const m = regex.exec(xml)
  if (m) return decodeHtmlEntities(m[1].trim())
  return ''
}

/** Parse nav.xhtml <nav> element links into TOC entries */
function parseNavLinks(navHtml: string, baseDir: string, toc: { title: string; href: string }[]): void {
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let liMatch: RegExpExecArray | null
  while ((liMatch = liRegex.exec(navHtml)) !== null) {
    const liContent = liMatch[1]
    const aMatch = liContent.match(/<a[^>]*\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (aMatch) {
      const href = aMatch[1].trim()
      const title = stripHtmlSimple(aMatch[2]).trim()
      if (title) {
        toc.push({ title: decodeHtmlEntities(title), href: baseDir + href })
      }
    }
    // Handle nested <ol> (sub-chapters)
    const nestedOl = liContent.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i)
    if (nestedOl) {
      parseNavLinks(nestedOl[1], baseDir, toc)
    }
  }
}

/** Parse NCX navMap into TOC entries */
function parseNcx(ncxXml: string, baseDir: string, toc: { title: string; href: string }[]): void {
  const navPointRegex = /<navPoint[^>]*>([\s\S]*?)<\/navPoint>/gi
  let match: RegExpExecArray | null
  while ((match = navPointRegex.exec(ncxXml)) !== null) {
    const npContent = match[1]
    const textMatch = npContent.match(/<text[^>]*>([\s\S]*?)<\/text>/i)
    const contentMatch = npContent.match(/<content[^>]*\s+src="([^"]+)"/i)
    if (textMatch && contentMatch) {
      toc.push({
        title: decodeHtmlEntities(textMatch[1].trim()),
        href: baseDir + contentMatch[1].trim(),
      })
    }
    // Handle nested navPoint (sub-chapters)
    const nested = npContent.match(/<navPoint[^>]*>([\s\S]*?)<\/navPoint>/i)
    if (nested) {
      parseNcx(nested[0], baseDir, toc)
    }
  }
}

/** Convert EPUB HTML content to structured Markdown */
function htmlToMarkdownEpub(html: string, baseDir: string): string {
  // Remove XML declaration and doctype
  let text = html.replace(/<\?xml[^>]*\?>\s*/g, '')
  text = text.replace(/<!DOCTYPE[^>]*>\s*/gi, '')

  // Remove script, style, nav, and other non-content elements (with content)
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
  // Strip header/footer tags but keep their text content
  text = text.replace(/<\/header>/gi, '')
  text = text.replace(/<header[^>]*>/gi, '')
  text = text.replace(/<\/footer>/gi, '')
  text = text.replace(/<footer[^>]*>/gi, '')

  // Convert images: <img src="..." alt="..."/>
  text = text.replace(/<img[^>]*\s+src="([^"]+)"[^>]*\s+alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
  text = text.replace(/<img[^>]*\s+alt="([^"]*)"[^>]*\s+src="([^"]+)"[^>]*\/?>/gi, '![$1]($2)')
  text = text.replace(/<img[^>]*\s+src="([^"]+)"[^>]*\/?>/gi, '![]($1)')

  // Convert links: <a href="...">text</a>
  text = text.replace(/<a[^>]*\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, content) => {
    const inner = stripHtmlSimple(content).trim()
    if (!inner) return ''
    return `[${inner}](${href})`
  })

  // Headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `# ${stripHtmlSimple(c).trim()}`)
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `## ${stripHtmlSimple(c).trim()}`)
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `### ${stripHtmlSimple(c).trim()}`)
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `#### ${stripHtmlSimple(c).trim()}`)
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, c) => `##### ${stripHtmlSimple(c).trim()}`)
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, c) => `###### ${stripHtmlSimple(c).trim()}`)

  // Blockquotes — convert each inner paragraph
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const inner = htmlToMarkdownEpub(content, baseDir).trim()
    return inner.split('\n').map((l: string) => `> ${l}`).join('\n')
  })

  // Unordered lists
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_ulMatch: string, content: string) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_liMatch: string, liContent: string) => `- ${stripHtmlSimple(liContent).trim()}`)
      .split('\n').filter((l: string) => l.trim()).join('\n')
  })

  // Ordered lists
  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_olMatch: string, content: string) => {
    let idx = 0
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_liMatch: string, liContent: string) => `${++idx}. ${stripHtmlSimple(liContent).trim()}`)
      .split('\n').filter((l: string) => l.trim()).join('\n')
  })

  // Bold/strong
  text = text.replace(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, (_, c) => `**${stripHtmlSimple(c)}**`)
  // Italic/em
  text = text.replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, (_, c) => `*${stripHtmlSimple(c)}*`)

  // Line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n')

  // Paragraphs, divs, etc.
  text = text.replace(/<\/(p|div|section|article|blockquote|pre|body)>/gi, '\n\n')

  // Horizontal rules
  text = text.replace(/<hr[^>]*\/?>/gi, '\n---\n')

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode entities
  text = decodeHtmlEntities(text)

  // Clean up whitespace
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/^[ \t]+/gm, '')
    .trim()

  return text || '[Empty chapter]'
}

/** Quick HTML tag stripper (no element removal, just tags) */
function stripHtmlSimple(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

/** Decode HTML entities */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=')
    .replace(/&#xa0;/gi, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
}

// ── Image helpers ───────────────────────────────────

export async function extractImageUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const mimeType = file.type || 'image/png'
      resolve({ dataUrl, mimeType })
    }
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

export function isImageFile(name: string): boolean {
  const ext = name.toLowerCase().split('.').pop()
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '')
}

let pdfWorkerSet = false

async function extractPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjsLib = await import('pdfjs-dist')

  // Set worker source once (lazy, first time a PDF is attached)
  if (!pdfWorkerSet) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs`
    pdfWorkerSet = true
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = (textContent.items as Array<{ str: string }>)
      .map((item) => item.str)
      .join(' ')
    if (pageText.trim()) {
      pages.push(`--- Page ${i} ---\n${pageText}`)
    }
  }

  return pages.join('\n\n')
}
