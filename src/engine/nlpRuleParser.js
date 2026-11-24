/**
 * nlpRuleParser.js
 *
 * Parses a natural-language rule description into a DiscountRule object using
 * OpenAI's ChatGPT models (e.g. gpt-4o-mini, gpt-4o, gpt-3.5-turbo).
 * Returns { rule, error } — exactly one will be non-null.
 *
 * DiscountRule shape (output):
 * {
 *   ruleId:       string   — "NLP-<timestamp>"
 *   scope:        "brand" | "platform" | "cart"
 *   appliesTo:    string   — brand/platform name, or "" for cart scope
 *   type:         "percentage" | "flat"
 *   value:        number   — positive
 *   stackable:    boolean
 *   minCartValue: number | null — required for cart scope
 * }
 */

const SYSTEM_INSTRUCTION = `You are a discount rule parser for an e-commerce cart pricing engine.

Your job is to convert a natural-language rule description into a structured JSON object.

## DiscountRule schema
{
  "scope":        "brand" | "platform" | "cart",
  "appliesTo":    string,   // brand name (scope=brand), platform name (scope=platform), or "" (scope=cart)
  "type":         "percentage" | "flat",
  "value":        number,   // positive number — percentage as integer (e.g. 20 for 20%), flat amount in rupees
  "stackable":    boolean,  // true if this rule stacks on top of other offers; false otherwise
  "minCartValue": number | null  // minimum cart total (rupees) required; only used for scope=cart, otherwise null
}

## Rules
- scope is REQUIRED and must be exactly one of: "brand", "platform", "cart"
- appliesTo is REQUIRED (non-empty) for scope=brand and scope=platform; must be "" for scope=cart
- type is REQUIRED and must be exactly one of: "percentage", "flat"
- value must be a positive number
- stackable defaults to false when not mentioned
- minCartValue is REQUIRED (a positive number) for scope=cart; must be null for other scopes
- If the input does not give a specific discount value, or the scope is ambiguous, or the description is unresolvable, return: {"ambiguous": true, "reason": "<concise explanation of what is missing>"}

## Canonical Examples

Input: "20% off for Natura Casa brand, stackable with other offers"
Output: {"scope":"brand","appliesTo":"Natura Casa","type":"percentage","value":20,"stackable":true,"minCartValue":null}

Input: "Rs.100 flat discount on all Flipkart items"
Output: {"scope":"platform","appliesTo":"Flipkart","type":"flat","value":100,"stackable":false,"minCartValue":null}

Input: "10% off if cart value is more than Rs.5,000"
Output: {"scope":"cart","appliesTo":"","type":"percentage","value":10,"stackable":false,"minCartValue":5000}

Input: "Give a discount for big orders"
Output: {"ambiguous":true,"reason":"Discount value and threshold are missing. Please specify the discount percentage/amount and conditions."}

Respond with ONLY a valid JSON object matching this specification.`

/**
 * Validates the parsed rule object and returns an error string or null.
 */
function validateRule(obj) {
  const validScopes = ['brand', 'platform', 'cart']
  const validTypes = ['percentage', 'flat']

  if (!validScopes.includes(obj.scope)) {
    return `Invalid scope "${obj.scope}". Must be one of: brand, platform, cart.`
  }
  if (!validTypes.includes(obj.type)) {
    return `Invalid type "${obj.type}". Must be one of: percentage, flat.`
  }
  if (typeof obj.value !== 'number' || obj.value <= 0 || isNaN(obj.value)) {
    return `Invalid value "${obj.value}". Must be a positive number.`
  }
  if (obj.scope === 'cart') {
    if (
      obj.minCartValue === null ||
      obj.minCartValue === undefined ||
      typeof obj.minCartValue !== 'number' ||
      isNaN(obj.minCartValue) ||
      obj.minCartValue <= 0
    ) {
      return `minCartValue is required and must be a positive number for cart-scope rules. Got: "${obj.minCartValue}".`
    }
  } else {
    if (!obj.appliesTo || typeof obj.appliesTo !== 'string' || obj.appliesTo.trim() === '') {
      return `appliesTo is required (non-empty) for scope="${obj.scope}" rules.`
    }
  }
  return null
}

/**
 * Parses a natural-language discount rule description into a DiscountRule object using OpenAI's API.
 *
 * @param {string} text   - The natural-language rule description from the user.
 * @param {string} apiKey - OpenAI API key.
 * @param {string} [model='gpt-4o-mini'] - OpenAI model name.
 * @returns {Promise<{ rule: object|null, error: string|null }>}
 */
export async function parseNaturalLanguageRule(text, apiKey, model = 'gpt-4o-mini') {
  if (!text || !text.trim()) {
    return { rule: null, error: 'Please enter a rule description.' }
  }
  if (!apiKey || !apiKey.trim()) {
    return { rule: null, error: 'OpenAI API key is missing. Please provide your API key.' }
  }

  let rawContent = ''
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim() || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0.1,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const errMsg = data?.error?.message || `OpenAI API returned status ${response.status}`
      return { rule: null, error: `ChatGPT API error: ${errMsg}` }
    }

    rawContent = data.choices?.[0]?.message?.content || ''
  } catch (err) {
    const msg = err?.message || String(err)
    return { rule: null, error: `Network/API error: ${msg}` }
  }

  // Strip markdown fences just in case
  const cleaned = rawContent
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return {
      rule: null,
      error: `Could not parse model response as JSON. Raw response: ${rawContent.slice(0, 200)}`,
    }
  }

  // Handle ambiguous response
  if (parsed.ambiguous === true) {
    const reason = parsed.reason || 'The rule description is ambiguous or incomplete.'
    return { rule: null, error: `Ambiguous input: ${reason}` }
  }

  // Normalise types
  if (typeof parsed.stackable !== 'boolean') {
    parsed.stackable = String(parsed.stackable).toLowerCase() === 'true'
  }
  if (parsed.minCartValue !== null && parsed.minCartValue !== undefined) {
    parsed.minCartValue = Number(parsed.minCartValue)
  } else {
    parsed.minCartValue = null
  }
  parsed.value = Number(parsed.value)

  // Validate against rule schema
  const validationError = validateRule(parsed)
  if (validationError) {
    return { rule: null, error: `Validation error: ${validationError}` }
  }

  const rule = {
    ruleId: 'NLP-' + Date.now(),
    scope: parsed.scope,
    appliesTo: parsed.scope === 'cart' ? '' : parsed.appliesTo.trim(),
    type: parsed.type,
    value: parsed.value,
    stackable: parsed.stackable,
    minCartValue: parsed.scope === 'cart' ? parsed.minCartValue : null,
  }

  return { rule, error: null }
}
