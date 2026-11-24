/**
 * PdfUploader.jsx
 *
 * Renders a file upload area for a PDF cart file.
 * Calls onLoad(cartItems, errors, fileName) when a file is selected and parsed.
 *
 * Props:
 *   onLoad   - (cartItems: CartItem[], errors: string[], fileName: string) => void
 *   hasData  - boolean — whether cart items are currently loaded
 *   fileName - string  — the currently-loaded file name (shown after load)
 */

import { useRef, useState } from 'react'
import { parsePdfToCartItems } from '../engine/pdfParser.js'

export default function PdfUploader({ onLoad, hasData, fileName }) {
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    // Reset input so the same file can be re-uploaded
    e.target.value = ''

    setError(null)
    setLoading(true)

    try {
      const { data, errors } = await parsePdfToCartItems(file)
      onLoad(data, errors, file.name)
    } catch (err) {
      setError(`Failed to parse PDF: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const borderColor = hasData ? '#1e5c2c' : loading ? '#FF5800' : error ? '#c0392b' : '#CECECE'
  const bgColor = hasData ? '#f0faf2' : loading ? '#fff9f7' : error ? '#fff5f5' : '#fafafa'

  return (
    <div>
      <div
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: 6,
          padding: '1rem 1.2rem',
          background: bgColor,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: 20 }}>
            {loading ? '⏳' : hasData ? '✅' : '📋'}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#131A48' }}>
              cart.pdf
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              {loading
                ? 'Parsing PDF…'
                : hasData
                ? fileName
                : 'Upload your cart PDF'}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: loading ? '#888' : hasData ? '#1e5c2c' : '#FF5800',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {loading ? 'Loading…' : hasData ? 'Change' : 'Upload'}
            </span>
          </div>
        </div>
      </div>

      {/* Inline error message */}
      {error && !loading && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.75rem',
            background: '#fff5f5',
            border: '1px solid #f5c6cb',
            borderRadius: 4,
            fontSize: 12,
            color: '#c0392b',
          }}
        >
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
