/**
 * pdfParser.js
 *
 * Extracts cart items from a PDF file using pdfjs-dist.
 * Returns { data: CartItem[], errors: string[] }
 *
 * Expected PDF table structure:
 *   Product         Brand          Platform        Base Price
 *   ──────────────────────────────────────────────────────────
 *   Cushion Cover   Natura Casa    Amazon India    Rs.1,299
 *   Bed Sheet Set   Natura Casa    Flipkart        Rs.849
 */

import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

/**
 * Groups text items by their y-position (rounded to nearest integer)
 * and sorts each row's items by x-position (left to right).
 * Returns an array of rows, each row being an array of text strings.
 */
function groupTextIntoRows(textItems) {
  const rowMap = new Map()

  for (const item of textItems) {
    const str = item.str
    if (!str || !str.trim()) continue

    // Round y to cluster items on the same line (PDF coords can vary slightly)
    const y = Math.round(item.transform[5])
    if (!rowMap.has(y)) {
      rowMap.set(y, [])
    }
    rowMap.get(y).push({ x: item.transform[4], text: str.trim() })
  }

  // Sort rows from top to bottom (PDF y-axis is bottom-up, so descending y = top)
  const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a)

  return sortedYs.map((y) => {
    const items = rowMap.get(y)
    // Sort left to right by x-position
    items.sort((a, b) => a.x - b.x)
    return items.map((item) => item.text)
  })
}

/**
 * Checks if a row is the header row by looking for the expected column names.
 * Uses case-insensitive matching.
 */
function isHeaderRow(row) {
  const joined = row.join(' ').toLowerCase()
  return (
    joined.includes('product') &&
    joined.includes('brand') &&
    joined.includes('platform') &&
    (joined.includes('base price') || joined.includes('base_price') || joined.includes('baseprice'))
  )
}

/**
 * Checks if a row is a separator line (e.g., "──────────────────────────")
 */
function isSeparatorRow(row) {
  const joined = row.join('')
  // Separator rows are lines made of dashes, underscores, or box-drawing chars
  return /^[\-─_\s]+$/.test(joined)
}

/**
 * Maps the column index from the header row for each expected field.
 * Returns { productIdx, brandIdx, platformIdx, basePriceIdx } or null if not found.
 */
function detectColumnIndices(headerRow) {
  const indices = { productIdx: -1, brandIdx: -1, platformIdx: -1, basePriceIdx: -1 }

  // The header row may have tokens that need to be matched.
  // Some PDFs may split "Base Price" into two tokens, so we try both strategies:
  // 1) Match each token against known headers
  // 2) Join adjacent tokens and try to find multi-word headers

  // Build a combined string for multi-word matching, tracking index boundaries
  for (let i = 0; i < headerRow.length; i++) {
    const token = headerRow[i].toLowerCase()

    if (token.includes('product')) {
      indices.productIdx = i
    } else if (token.includes('brand')) {
      indices.brandIdx = i
    } else if (token.includes('platform')) {
      indices.platformIdx = i
    } else if (
      token.includes('base') ||
      token.includes('price') ||
      token.includes('base_price') ||
      token.includes('baseprice')
    ) {
      // Could be "Base Price" split across two tokens or one token
      if (token.includes('base') && i + 1 < headerRow.length) {
        const next = headerRow[i + 1].toLowerCase()
        if (next.includes('price')) {
          indices.basePriceIdx = i
          // skip next token (it's part of "Base Price")
        } else {
          indices.basePriceIdx = i
        }
      } else {
        indices.basePriceIdx = i
      }
    }
  }

  // Check all indices are found
  if (
    indices.productIdx === -1 ||
    indices.brandIdx === -1 ||
    indices.platformIdx === -1 ||
    indices.basePriceIdx === -1
  ) {
    return null
  }

  return indices
}

/**
 * Extracts the base price number from a string like "Rs.1,299" or "1299"
 * Returns the parsed float, or NaN if parsing fails.
 */
function parseBasePrice(raw) {
  if (!raw) return NaN
  // Remove "Rs.", "₹", commas, and any whitespace
  const cleaned = raw.replace(/Rs\./gi, '').replace(/₹/g, '').replace(/,/g, '').trim()
  return parseFloat(cleaned)
}

/**
 * Parses a PDF file and extracts cart items.
 *
 * @param {File} file - A File object from an <input type="file">
 * @returns {Promise<{ data: CartItem[], errors: string[] }>}
 */
export async function parsePdfToCartItems(file) {
  const data = []
  const errors = []

  // Convert File to ArrayBuffer for pdfjs
  const arrayBuffer = await file.arrayBuffer()

  let pdf
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    pdf = await loadingTask.promise
  } catch (err) {
    return { data: [], errors: [`Failed to load PDF: ${err.message}`] }
  }

  // Collect all text items across all pages
  const allRows = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const rows = groupTextIntoRows(textContent.items)
    allRows.push(...rows)
  }

  if (allRows.length === 0) {
    return { data: [], errors: ['No text content found in PDF.'] }
  }

  // Find the header row
  let headerRowIdx = -1
  let columnIndices = null

  for (let i = 0; i < allRows.length; i++) {
    if (isHeaderRow(allRows[i])) {
      columnIndices = detectColumnIndices(allRows[i])
      if (columnIndices) {
        headerRowIdx = i
        break
      }
    }
  }

  if (headerRowIdx === -1 || !columnIndices) {
    return {
      data: [],
      errors: [
        'Could not find header row with columns: Product, Brand, Platform, Base Price. ' +
          'Please ensure the PDF follows the expected table format.',
      ],
    }
  }

  const { productIdx, brandIdx, platformIdx, basePriceIdx } = columnIndices

  // Process rows after the header (skip separator lines)
  let itemCounter = 0

  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const row = allRows[i]

    // Skip separator rows
    if (isSeparatorRow(row)) continue

    // Skip empty or very short rows
    if (row.length === 0) continue

    // We need at least enough columns to reach the basePriceIdx
    // For rows that might have "Rs." and the number as separate tokens,
    // we try to reconstruct them
    const maxIdx = Math.max(productIdx, brandIdx, platformIdx, basePriceIdx)

    if (row.length <= maxIdx) {
      // Row might have fewer columns due to empty fields — collect as error only if
      // it looks like it has some data (at least 2 non-empty tokens)
      if (row.length >= 2) {
        itemCounter++
        errors.push(
          `Row ${itemCounter} (PDF): insufficient columns — expected at least ${maxIdx + 1}, got ${row.length}. Row content: "${row.join(' ')}"`,
        )
      }
      continue
    }

    const product = row[productIdx] || ''
    const brand = row[brandIdx] || ''
    const platform = row[platformIdx] || ''

    // Base price: the token at basePriceIdx may be "Rs.1,299" or split across tokens
    // Try to join from basePriceIdx to end and find the price
    let basePriceRaw = row[basePriceIdx] || ''

    // If the basePriceRaw doesn't contain a number, try joining adjacent tokens
    if (!/\d/.test(basePriceRaw) && basePriceIdx + 1 < row.length) {
      basePriceRaw = row.slice(basePriceIdx).join('')
    }

    const missing = []
    if (!product) missing.push('product')
    if (!brand) missing.push('brand')
    if (!platform) missing.push('platform')
    if (!basePriceRaw) missing.push('base_price')

    itemCounter++
    const rowLabel = `PDF item ${itemCounter}`

    if (missing.length > 0) {
      errors.push(`${rowLabel}: missing fields — ${missing.join(', ')}`)
      continue
    }

    const basePrice = parseBasePrice(basePriceRaw)

    if (isNaN(basePrice) || basePrice <= 0) {
      errors.push(
        `${rowLabel}: base_price must be a positive number, got "${basePriceRaw}"`,
      )
      continue
    }

    const itemId = `PDF-${String(data.length + 1).padStart(2, '0')}`

    data.push({
      itemId,
      product,
      brand,
      platform,
      basePrice: Math.round(basePrice),
    })
  }

  return { data, errors }
}
