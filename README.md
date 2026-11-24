# Opptra Discount Engine

An extensible, customer-facing cart pricing and discount engine built for Opptra Central Tech. It calculates optimal customer savings across brand, platform, and cart-level discount campaigns with clear, plain-language breakdown strings.

## Live Deployment
- **Live URL:** `https://your-deployment-url.vercel.app` *(Replace with your live URL upon deployment)*

---

## Running Locally (Under 3 Steps)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **(Optional) Configure OpenAI API key for Natural Language Rule Input (ChatGPT):**
   ```bash
   cp .env.example .env
   # Add your key: VITE_OPENAI_API_KEY=sk-...
   ```
   *Note: You can also paste your OpenAI API key directly inside the web interface without editing `.env`!*

3. **Start local dev server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173).

---

## Features Built

### 1. Foundation Engine
- **Item-Level Rules:** Evaluates brand and platform discounts against each cart item.
- **Max Savings Selection:** When multiple non-stackable offers match an item, selects the one providing the highest rupee discount.
- **Stackable Rules:** Stacks percentage or flat rules sequentially on top of winning non-stackable rules.
- **Customer Breakdown:** Provides clear plain-language reasoning for each applied or skipped rule.

### 2. Task 1: Cart-Level Offers
- Extends rule schema to support `scope: "cart"` and `min_cart_value`.
- Evaluates cart-level rules after all item-level discounts are computed.
- If item subtotal meets or exceeds `min_cart_value`, applies the cart discount.
- Renders a dedicated cart offer row (e.g., `Cart offer: 10% off — Rs.593 saved`) and displays the final cart total. If the threshold is not met, the offer row is cleanly omitted.

### 3. Task 2: Natural Language Rule Input (LLM / ChatGPT)
- Natural language input powered by OpenAI ChatGPT (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`).
- Translates plain English rule descriptions into validated `DiscountRule` objects via direct JSON-mode API requests.
- **In-App Key Configuration:** Users can supply their key via `.env` or paste it directly in the UI.
- **Pre-Use Validation & Confirmation:** Parsed rules are shown in an interactive confirmation card with full breakdown (Scope, Applies To, Type, Discount, Stackable, Min Cart Value) before being committed to active rules.
- **Ambiguity Detection:** Detects incomplete or vague prompts (e.g. *"Give a discount for big orders"*) and returns user-friendly actionable guidance instead of crashing.

### 4. Task 3: PDF Cart Upload
- Direct PDF upload support alongside CSV using client-side `pdfjs-dist`.
- Extracts tabular cart data (Product, Brand, Platform, Base Price) directly in the browser with no backend required.
- Parses currency symbols (`Rs.`, `₹`), commas, and numeric prices.
- **Fault-Tolerant:** Malformed or incomplete rows are reported in row-level error banners while valid items are still loaded and evaluated.

---

## Project Structure

```
src/
  engine/
    discountEngine.js   ← Pure discount logic (item-level + cart-level)
    csvParser.js        ← CSV parser supporting brand, platform, and cart rules
    nlpRuleParser.js    ← ChatGPT NLP parser with schema validation & ambiguity checks
    pdfParser.js        ← Client-side PDF table extraction and CartItem mapper
  components/
    CsvUploader.jsx     ← CSV upload component
    PdfUploader.jsx     ← PDF upload component with loading & error states
    NlpRuleInput.jsx    ← Natural language input + confirmation card UI
    DataTable.jsx       ← Reusable tabular data viewer
    ErrorBanner.jsx     ← Row-level and system error notification
  App.jsx               ← Top-level state orchestration & results summary
  main.jsx              ← Vite application entry point

sample-data/
  rules.csv             ← Sample rules including RULE-01 through RULE-04
  cart.csv              ← Sample cart items ITEM-01 through ITEM-06
```

---

## Sample Data Verification

| Item | Base Price | Rule(s) Applied | Final Price | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ITEM-01** | Rs.1,299 | RULE-01 wins (Rs.195 saving > Rs.150) | Rs.1,104 | Max discount |
| **ITEM-02** | Rs.849 | RULE-02 (−Rs.150) + RULE-03 stacked (−10%) | Rs.629 | Stacked |
| **ITEM-03** | Rs.599 | RULE-01 (15% off) | Rs.509 | Discount applied |
| **ITEM-04** | Rs.2,499 | No rules match | Rs.2,499 | No offer |
| **ITEM-05** | Rs.449 | RULE-01 (15% off) | Rs.382 | Discount applied |
| **ITEM-06** | Rs.899 | RULE-03 (10% off, stackable) | Rs.809 | Discount applied |
| **Cart Subtotal** | | | **Rs.5,932** | |
| **Cart Offer — RULE-04** | | Rs.5,932 ≥ Rs.4,000 → 10% off entire cart | **−Rs.593** | Cart offer |
| **Final Cart Total** | | | **Rs.5,339** | |

---

## Design Decisions & Tradeoffs

1. **Client-Side Architecture (No Backend):**
   - Both PDF parsing (`pdfjs-dist`) and LLM requests are executed directly in the browser. This eliminates server maintenance and latency, keeping the prototype self-contained and zero-cost to deploy on static hosts like Vercel or Netlify.
   - *Tradeoff:* For production environments handling sensitive API keys or large batch PDFs, moving LLM and PDF parsing to a backend edge function would protect keys and offload browser memory.

2. **LLM Validation & Mandatory Confirmation:**
   - LLMs can hallucinate or misinterpret edge-case phrasing. We enforce strict post-parsing JSON schema verification (bounds checking, required scope matching, positive number constraints).
   - The confirmation step ensures human oversight so incorrect discounts are never silently injected into customer checkout flows.

3. **Input Adaptation vs. Engine Modification:**
   - The discount engine remains pure and uncoupled from upload formats. Both CSV, PDF, and NLP inputs adapt to internal data shapes (`DiscountRule`, `CartItem`) before touching the calculation pipeline.
