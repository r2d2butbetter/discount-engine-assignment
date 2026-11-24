/**
 * NlpRuleInput.jsx
 *
 * A self-contained React component that lets the user describe a discount rule
 * in natural language and parses it via OpenAI ChatGPT (gpt-4o-mini / gpt-4o).
 *
 * Props:
 *   initialApiKey   {string}   — OpenAI API key (from import.meta.env.VITE_OPENAI_API_KEY)
 *   onRuleConfirmed {function} — called with the confirmed DiscountRule object
 */

import { useState } from 'react'
import { parseNaturalLanguageRule } from '../engine/nlpRuleParser.js'

// ── Styles ────────────────────────────────────────────────────────

const S = {
  section: {
    background: '#fff',
    border: '1px solid #CECECE',
    borderRadius: 6,
    padding: '1.2rem 1.4rem',
    marginBottom: '1.2rem',
    fontFamily: 'Arial, sans-serif',
  },
  sectionTitle: {
    fontFamily: 'Georgia, serif',
    fontWeight: 700,
    fontSize: 14,
    color: '#131A48',
    marginBottom: '0.7rem',
    paddingBottom: 6,
    borderBottom: '2px solid #FF5800',
    display: 'inline-block',
  },
  textarea: {
    width: '100%',
    minHeight: 75,
    padding: '0.6rem 0.8rem',
    fontSize: 13,
    fontFamily: 'Arial, sans-serif',
    border: '1px solid #CECECE',
    borderRadius: 4,
    color: '#131A48',
    resize: 'vertical',
    boxSizing: 'border-box',
    outline: 'none',
  },
  keyInput: {
    width: '100%',
    maxWidth: 380,
    padding: '0.45rem 0.7rem',
    fontSize: 12,
    fontFamily: 'monospace',
    border: '1px solid #CECECE',
    borderRadius: 4,
    color: '#131A48',
    boxSizing: 'border-box',
    outline: 'none',
  },
  select: {
    padding: '0.45rem 0.7rem',
    fontSize: 12,
    border: '1px solid #CECECE',
    borderRadius: 4,
    color: '#131A48',
    outline: 'none',
    background: '#fff',
  },
  btn: {
    background: '#FF5800',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.55rem 1.6rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.55rem 1.6rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'not-allowed',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  btnGreen: {
    background: '#1e5c2c',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.5rem 1.3rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.03em',
    marginRight: '0.5rem',
  },
  btnOutline: {
    background: '#fff',
    color: '#131A48',
    border: '1px solid #CECECE',
    borderRadius: 4,
    padding: '0.5rem 1.3rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  errorBox: {
    background: '#fff3f0',
    border: '1px solid #FF5800',
    borderRadius: 4,
    padding: '0.7rem 1rem',
    color: '#c0392b',
    fontSize: 13,
    marginTop: '0.75rem',
  },
  card: {
    background: '#f7f7f9',
    border: '1px solid #CECECE',
    borderRadius: 6,
    padding: '1rem 1.2rem',
    marginTop: '0.9rem',
  },
  cardTitle: {
    fontFamily: 'Georgia, serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#131A48',
    marginBottom: '0.6rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  tdLabel: {
    padding: '4px 8px 4px 0',
    color: '#888',
    fontWeight: 600,
    fontSize: 12,
    width: '38%',
    verticalAlign: 'top',
  },
  tdValue: {
    padding: '4px 0',
    color: '#131A48',
    fontWeight: 500,
    fontSize: 13,
    verticalAlign: 'top',
  },
  spinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid #fff',
    borderTop: '2px solid #FF5800',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    marginRight: 8,
    verticalAlign: 'middle',
  },
}

// ── Helpers ───────────────────────────────────────────────────────

function formatValue(rule) {
  return rule.type === 'percentage' ? `${rule.value}% off` : `Rs.${rule.value} off`
}

function formatScope(scope) {
  return scope.charAt(0).toUpperCase() + scope.slice(1)
}

// ── Component ─────────────────────────────────────────────────────

export default function NlpRuleInput({ initialApiKey = '', onRuleConfirmed }) {
  const [apiKey, setApiKey] = useState(initialApiKey)
  const [showKeyField, setShowKeyField] = useState(!initialApiKey)
  const [model, setModel] = useState('gpt-4o-mini')
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsedRule, setParsedRule] = useState(null)
  const [error, setError] = useState(null)

  async function handleParse() {
    if (!inputText.trim()) return
    if (!apiKey.trim()) {
      setError('Please provide an OpenAI API key (sk-...) to use ChatGPT rule parsing.')
      setShowKeyField(true)
      return
    }

    setLoading(true)
    setError(null)
    setParsedRule(null)

    const { rule, error: err } = await parseNaturalLanguageRule(inputText, apiKey, model)

    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setParsedRule(rule)
    }
  }

  function handleAddRule() {
    if (!parsedRule) return
    onRuleConfirmed(parsedRule)
    setParsedRule(null)
    setInputText('')
    setError(null)
  }

  function handleDiscard() {
    setParsedRule(null)
    setError(null)
  }

  const canParse = inputText.trim().length > 0 && !loading

  return (
    <div style={S.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={S.sectionTitle}>Natural Language Rule Input (ChatGPT)</div>
        <button
          onClick={() => setShowKeyField(!showKeyField)}
          style={{
            background: 'none',
            border: 'none',
            color: '#FF5800',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {showKeyField ? 'Hide API Key' : apiKey ? '🔑 OpenAI Key Configured' : '⚙️ Configure API Key'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: '0.6rem' }}>
        Describe a discount rule in plain English and let ChatGPT parse it into a structured rule.
      </div>

      {/* API Key and Model configuration */}
      {showKeyField && (
        <div
          style={{
            background: '#fafafa',
            border: '1px solid #eee',
            borderRadius: 4,
            padding: '0.75rem 1rem',
            marginBottom: '0.8rem',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#131A48', marginBottom: 4 }}>
            OpenAI Configuration
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
            <input
              type="password"
              placeholder="Paste OpenAI API Key (sk-...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={S.keyInput}
            />
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={S.select}
            >
              <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            </select>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            Tip: You can also save <code>VITE_OPENAI_API_KEY=your_key</code> in a <code>.env</code> file.
          </div>
        </div>
      )}

      {/* Textarea */}
      <textarea
        style={S.textarea}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder={'e.g. "20% off for Natura Casa brand, stackable with other offers" or "Rs.100 flat discount on all Flipkart items"'}
        disabled={loading}
        rows={3}
      />

      {/* Action Row */}
      <div style={{ marginTop: '0.6rem' }}>
        <button
          style={canParse ? S.btn : S.btnDisabled}
          onClick={handleParse}
          disabled={!canParse}
        >
          {loading ? (
            <>
              <span style={S.spinner} />
              Parsing with ChatGPT…
            </>
          ) : (
            'Parse Rule with ChatGPT'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={S.errorBox}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Confirmation card */}
      {parsedRule && !error && (
        <div style={S.card}>
          <div style={S.cardTitle}>Parsed Rule — Please confirm</div>
          <table style={S.table}>
            <tbody>
              <tr>
                <td style={S.tdLabel}>Rule ID</td>
                <td style={S.tdValue}>{parsedRule.ruleId}</td>
              </tr>
              <tr>
                <td style={S.tdLabel}>Scope</td>
                <td style={S.tdValue}>{formatScope(parsedRule.scope)}</td>
              </tr>
              {parsedRule.scope !== 'cart' && (
                <tr>
                  <td style={S.tdLabel}>Applies To</td>
                  <td style={S.tdValue}>{parsedRule.appliesTo}</td>
                </tr>
              )}
              <tr>
                <td style={S.tdLabel}>Type</td>
                <td style={S.tdValue}>{formatScope(parsedRule.type)}</td>
              </tr>
              <tr>
                <td style={S.tdLabel}>Discount</td>
                <td style={{ ...S.tdValue, color: '#1e5c2c', fontWeight: 700 }}>
                  {formatValue(parsedRule)}
                </td>
              </tr>
              <tr>
                <td style={S.tdLabel}>Stackable</td>
                <td style={S.tdValue}>{parsedRule.stackable ? 'Yes' : 'No'}</td>
              </tr>
              {parsedRule.scope === 'cart' && (
                <tr>
                  <td style={S.tdLabel}>Min Cart Value</td>
                  <td style={S.tdValue}>Rs.{parsedRule.minCartValue?.toLocaleString('en-IN')}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ marginTop: '0.9rem' }}>
            <button style={S.btnGreen} onClick={handleAddRule}>
              Add Rule ✓
            </button>
            <button style={S.btnOutline} onClick={handleDiscard}>
              Discard ✗
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
