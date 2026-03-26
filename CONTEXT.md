# RE-Analyzer-Pro — Development Context

> This file is for AI-assisted development continuity. Read this at the start of each session.

---

## Project Overview

A multifamily real estate investment underwriting app for Andrew Schildcrout (andrew@chaiholdings.com), Chai Holdings. Built for personal use initially, designed to scale to multi-user SaaS.

**Stack:** React 18 + TypeScript + Tailwind CSS + Supabase + Vite + Capacitor (iOS)

**Local path:** `~/Applications/Claude/RE-Analyzer-Pro`
**GitHub:** `3JTexas/RE-Analyzer-Pro` (public)
**Live:** https://3jtexas.github.io/RE-Analyzer-Pro/
**Supabase project:** `RE-Analyzer-Pro` — `mrraacrijhzlchskuzru.supabase.co`
**Dev server:** `npm run dev` → `http://localhost:5173`

---

## App Store / TestFlight

- **App Store Connect name:** RE Analyze Pro
- **Bundle ID:** `com.ChaiHoldings.dealanalyzer`
- **Last build uploaded:** 1.0 (3) — Mar 21, 2026
- **Login:** andrew@chaiholdings.com / apple dev: andrew@3jtexas.com
- **TestFlight group:** Andrew@3jtexas.com — Internal Group, 1 tester, build 3 assigned
- **Encryption compliance:** Answer "No" after each upload in App Store Connect

---

## Architecture

```
src/
  lib/
    calc.ts          ← Pure calculation engine — all model math, no React
    supabase.ts      ← Supabase client init
    uiState.ts       ← loadCompareState / saveCompareState helpers
  types/
    index.ts         ← ModelInputs, ModelOutputs, Property, Scenario types
  hooks/
    useAuth.ts       ← Auth state (signIn, signUp, signOut)
    useScenario.ts   ← Property/scenario CRUD, getScenariosForProperty
  components/
    model/
      ModelCalculator.tsx  ← Main 6-tab underwriting UI
    pdf/
      PdfReport.tsx        ← @react-pdf/renderer PDF export
    layout/
      AppShell.tsx         ← Bottom nav shell (max-w-3xl)
    ui/
      index.tsx            ← Shared primitives
    OMSetupFlow.tsx        ← PDF upload + AI extraction + manual entry flow
  pages/
    LoginPage.tsx
    PropertiesPage.tsx     ← New property → launches OMSetupFlow directly
    PropertyPage.tsx       ← Scenarios list + create + duplicate
    ScenarioPage.tsx       ← Loads scenario + property meta, passes to ModelCalculator
    DemoPage.tsx
  App.tsx
  main.tsx
supabase/
  schema.sql
  functions/
    extract-om/
      index.ts             ← Edge Function — PDF → Anthropic API → JSON (deployed)
```

---

## Database Schema

```sql
properties (id, user_id, name, address, units, year_built, notes, compare_state jsonb, created_at, updated_at)
scenarios  (id, property_id, user_id, name, method, inputs jsonb, is_default, created_at, updated_at)
```

---

## ModelInputs — Full Field List

```ts
// Income
tu, ou, rent, vp
otherIncome: { label, amount }[]

// Financing
price, ir, lev, am, lf, cc

// Expenses
tax, ins, util, rm, cs, ga, res, pm
expCollapse: boolean
expPct: number
otherExpenses: { label, amount }[]

// Tax
brk, land, costSeg, is1031, basis1031, equity1031

// Offer calculator
targetCapRate?: number
targetOfferPrice?: number
offerCalcMode?: 'cap' | 'price'
```

**All defaults are zero.** No hardcoded values anywhere.

---

## Model Logic (calc.ts)

- EGI = collected + sum(otherIncome)
- Expenses: itemized OR EGI × expPct% + otherExpenses
- Depreciation: is1031 + basis1031 > 0 → carryover basis; else price × (1 - land%)
- Cost seg: costSeg% of deprBase → 100% bonus; remainder → 27.5yr SL
- equity1031 reduces cash to close
- All defaults zero

---

## Method Auto-Derivation

The stored `method` field in the DB is legacy and should NOT be trusted for calculations. Instead:

```ts
const effectiveMethod = (inputs.ou > 0 && inputs.ou < inputs.tu) ? 'physical' : 'om'
```

- OM As-Presented (is_default=true) is always forced to 'om' in resolveInputs
- All other scenarios auto-derive from ou vs tu
- **Pending refactor:** Remove `method` field from DB and types entirely

---

## Tabs (6 total)

1. **OM** — broker's as-presented figures, read-only, unlock to edit
2. **Flags** — auto-computed OM discrepancy flags + stressed scenario metrics. Red dot when high-risk flags exist.
3. **Inputs** — buyer's underwriting inputs
4. **P&L** — income statement + offer calculator
5. **Tax** — REP + bonus dep + 1031 analysis (hidden on OM scenario)
6. **Compare** — multi-scenario side-by-side (A baseline + B/C/D vs A)

---

## Flags Tab Logic

Flags computed from inputs + propertyYearBuilt:
1. Tax reassessment — effective rate < 1.8% of price → flags delta to ~2.0% millage
2. Physical vacancy > stated vacancy → flags EGI overstatement
3. Insurance < benchmark (age-adjusted: >60yr = $3,000/door, >40yr = $2,500, else $2,000)
4. R&M < benchmark (age-adjusted: >60yr = $900/unit, >40yr = $700, else $500)
5. Reserves < benchmark (age-adjusted: >60yr = $700/unit, >40yr = $500, else $350)

Stressed scenario card at bottom shows NOI/cap/DCR/CoC with all benchmarks applied.

---

## Offer Calculator

Located at bottom of P&L tab (hidden on OM scenario). Two modes via pill toggle:
- **Target cap rate** → solve implied offer price (NOI / cap%)
- **Target price** → solve implied cap rate (NOI / price)
Both modes show: price, cap rate, delta vs asking ($ and %), price/unit, DCR, down payment, loan amount.
"Apply to Inputs" button writes offer price to `inputs.price`, clears calculator, requires manual Save.
Fields: `targetCapRate`, `targetOfferPrice`, `offerCalcMode` persist in `ModelInputs`.

---

## 1031 Exchange Fields

When `is1031` toggled on (hidden on OM scenario):
- `equity1031` — proceeds rolling in (reduces cash to close)
- `basis1031` — estimated carryover adjusted basis (determines depreciation base)

---

## Compare Tab Persistence

- Column selections (A–D) stored in `properties.compare_state` jsonb column
- `src/lib/uiState.ts` provides `loadCompareState(propertyId)` / `saveCompareState(propertyId, state)`
- Loads on mount via `useEffect`; "Save layout" button in tab header persists to DB
- PDF report reflects current Compare tab selection order at time of export

---

## New Property Flow

1. PropertiesPage → "New property" → OMSetupFlow (showPropertyFields=true)
2. OMSetupFlow → Import PDF → name/address/yearBuilt auto-populated from extraction
3. otherIncome rows shown in review screen (editable, removable)
4. Confirm → creates property (with year_built) + OM scenario → navigates to scenario
5. PropertyPage → "+ Scenario" → OMSetupFlow (no property fields)

---

## Supabase Edge Function: extract-om

- **URL:** `https://mrraacrijhzlchskuzru.supabase.co/functions/v1/extract-om`
- **Deployed:** Yes (last deployed Mar 23 2026)
- **max_tokens:** 2000

### Extraction status:
- ✅ price, tu, ou, rent (broker stated avg), vp, lev, ir, am
- ✅ tax, ins, util, rm, cs, ga, res, pm
- ✅ otherIncome array, propertyName, propertyAddress, yearBuilt

---

## PDF Report

- Cover page: property, address, units, year built, price, scenario, date
- Page 2: key metrics, P&L, tax analysis, cash to close
- Page 3: scenario comparison — columns from Compare tab selection order (A, B, C, D)
- Side-by-side only renders when 2+ scenarios selected in Compare tab

---

## Supabase Auth

- Email confirmation: OFF
- Legacy `eyJ...` anon key
- andrew@chaiholdings.com is confirmed user

---

## GitHub

- PAT: Classic token with `repo` + `workflow` scopes (expires May 12 2026)
- Push with: `git add -A && git commit -m "..." && git push origin main`
- GitHub Pages: deployed via `.github/workflows/deploy.yml` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` repo secrets

---

## Pending Features / Known Issues (priority order)

1. **Method refactor** — remove `method` field from DB/types; derive purely from inputs. Currently auto-derived at runtime as workaround.
2. **Settings / User Defaults page** — gear icon; user_defaults table; seeds new scenarios with preferred defaults (bracket, IR, LTV, land%, costSeg%).
3. **Per-unit rent roll** — individual unit rows replacing blended avg. OM import maps rent roll table to unit rows.
4. **Tax assessor PDF import** — upload county appraiser PDF → extract assessed value, land/improvement split, tax bill → auto-populate corrected tax and land% in Flags tab.
5. **Update Node.js 20 → 24 in `deploy.yml`** — before June 2026 when Node 20 reaches EOL in GitHub Actions.
6. **Responsive layout** — proper breakpoint-aware design for desktop.

---

## Design Decisions

- JSONB inputs — no migrations ever needed
- All defaults zero — no hidden assumptions
- omBadge() — dynamic OM comparison badges, silent when matching
- lf and cc use omBadge() — no hardcoded badges
- 1031 section and offer calculator hidden on OM As-Presented scenario
- Flags benchmarks age-adjusted using propertyYearBuilt from DB
- AppShell max-w-3xl (768px)
- Legacy Supabase anon key — new key caused auth redirect issues
- Anthropic API key never in frontend — always via Edge Function
- All future code changes use Claude Code directly — never patch files in chat

---

## Seacrest Apartments — Current State

- year_built = 1935 saved in DB ✅
- Scenarios: "OM As-Presented" (is_default, om) + "OM fact checked" (ou=7, corrected expenses)
- OM As-Presented: NOI $123,292, cap 6.32%, DCR 1.32×
- OM fact checked: NOI ~$90,670, cap 4.65%, DCR 0.97× — corrected taxes/insurance/R&M/reserves + 1 vacant unit
- Key flags: tax reassessment ($20,726 → ~$39,000), physical vacancy (12.5% vs 4%), insurance ($1,800 vs $3,000/door)
- Seller paid $1,745,000 Oct 2024, asking $1,950,000 (~$205K markup in 5 months)
- Both parcels: 215 S Seacrest Blvd (PCN 08-43-45-28-10-016-0220) + 107 SW 2nd Ave (PCN 08-43-45-28-10-016-0260)

---

## Session — March 24, 2026

- Added `compare_state jsonb` column to `properties` table (migration run successfully in Supabase SQL Editor)
- Created `src/lib/uiState.ts` with `loadCompareState` / `saveCompareState` helpers
- Compare tab now loads persisted column selections on mount and has a "Save layout" button
- Offer calculator `targetCapRate` added to `ModelInputs` and persists with scenario Save
- GitHub Pages deployment live at https://3jtexas.github.io/RE-Analyzer-Pro/
- Repo made public to enable GitHub Pages free tier
- Claude Code confirmed working — all future code changes use Claude Code directly, never patch files in chat
- Fixed `vite.config.ts` base path: `'/'` for dev, `'/RE-Analyzer-Pro/'` for production
- Number input UX: auto-select on focus, strip leading zeros, restore 0 on empty blur
- Dollar fields display with comma separators (price, rent, tax, ins, util, rm, cs, ga, res, equity1031, basis1031)
- Info tooltips on Land %, Cost Seg %, and Est. Carryover Basis fields

---

## Session — March 25, 2026 (morning)

**OM Method Fix**
- OM As-Presented scenario (is_default=true) now always forces `'om'` method regardless of `ou/tu` values
- Fixed `effectiveMethod` derivation to check `omScenario?.id === currentScenarioId` before auto-deriving

**PDF Cover Page Redesign**
- White background, Chai Holdings logo top-left (~180px wide), property photo (or placeholder)
- Key metrics grid: Purchase Price (with price/unit), Units, Cap Rate, NOI, DCR, Y1 ROE, Pre-tax CF, Equity
- All pages use light theme: section headers on `#F8F8F8`, table headers light gray, text `#1a1a2e`
- `Chai_Logo.jpeg` in `public/` (sourced from Outlook attachments, 851x240px)

**Property Photo Upload**
- OMSetupFlow review screen: optional photo upload with Camera icon
- PropertyPage: "Photo" button in header uploads to `property-images` Supabase Storage bucket
- `property_image_url text` column added to `properties` table
- Supabase Storage RLS policies: INSERT/UPDATE for authenticated, SELECT for public
- Photos pre-fetched as base64 data URLs to bypass CORS in `@react-pdf/renderer`

**Bidirectional Offer Calculator**
- Two pill-toggle modes: "Target cap rate" (solve price) and "Target price" (solve cap rate)
- "Apply to Inputs" button: writes implied offer price to `inputs.price`, clears calculator, requires manual Save
- New `ModelInputs` fields: `targetOfferPrice?: number`, `offerCalcMode?: 'cap' | 'price'`

**Compare Tab & PDF Price Consistency**
- Compare tab price row: always shows `inputs.price` as "Purchase Price"
- PDF: uses `inputs.price` throughout, no back-calculated offer prices
- PDF comparison table: "Purchase Price" added as bold first row
- PDF method label: `deriveMethodLabel()` auto-derives from scenario name and `ou/tu`

**Tooltips**
- Fixed Unicode escapes, added info tooltips to all 20+ InputField instances
- `SectionHeader` component accepts optional `tooltip` prop

---

## Latest Session — March 25, 2026 (continued)

**LOI Generator**
- Simple and Buyer-Friendly templates via `@react-pdf/renderer`
- Modal on scenario tab bar, pulls from active scenario `inputs.price` and `inputs.lev`
- LOI button hidden on OM As-Presented scenario
- DD deliverables split: LOI-execution (rent roll, P&L, leases, utilities, tax bills, contracts, rent payment status) and PSA-execution (title, survey, COO, env reports, loss runs, litigation, estoppels)
- Non-binding language revised: removed exclusivity clause, confidentiality binding only
- Files: `src/types/loi.ts`, `src/components/loi/LOIDocument.tsx`, `src/components/loi/LOIModal.tsx`

**OM Extraction Improvements**
- Switched to native PDF document API with `type: 'document'` blocks
- Improved prompt with field-by-field extraction hints and Crexi-format tips
- Increased `max_tokens` to 4000
- Defensive JSON extraction: strips code fences, finds `{` to `}`
- Base64 prefix stripping for `data:application/pdf;base64,`
- Field mapping fix: `numericKeys` set with `parseFloat` for string-typed numbers
- `ou` defaults to `tu` when not extracted

**Utility Sub-Fields**
- Added `utilElec`, `utilWater`, `utilTrash` to `ModelInputs` with auto-sum into `util`
- Three sub-field inputs in Inputs tab with left-border grouping
- Total Utilities shows "auto" badge when matching sum
- Edge function extracts individual utility line items

**Sub-Metering Toggles**
- `utilElecSubmetered` and `utilWaterSubmetered` boolean fields
- Inline pill toggles on Electric and Water inputs
- When sub-metered: label changes to "property only ($)", blue badge, suppressed per-unit sub-label
- Flags tab: amber warning if sub-metered but cost seems high, info note if $0

**Extraction Quality Warnings**
- Critical field banners (price, tu, tax, ins) — red card on OM review screen
- Expected field banners (ir, am, lev, pm) — amber card
- Inline field highlighting with "(not found)" badges
- Confirm button blocked until critical fields filled

**Expense Labels & Sub-Labels**
- All expense inputs standardized: annual totals labeled "(annual $)", per-unit fields labeled "$/unit/yr"
- Monthly/per-unit sub-labels on all expense fields in Inputs tab
- P&L expense rows: monthly primary with annual + per-unit parenthetical

**County Tax Assessor PDF Import**
- New edge function: `extract-tax-record` (Claude Sonnet 4, native PDF document API)
- Extracts: assessed value, land/improvement split, land%, taxable value, annual tax bill, millage rate
- `TaxRecordImport` component in Flags tab with modal flow: upload → review → apply
- Writes `annualTaxBill → inputs.tax` and `landPct → inputs.land`

**PDF Tax Page Redesign**
- Replaced all charts/SVG with clean dynamic after-tax table
- Narrative summary paragraph + three metric cards (Y1 benefit, annual ongoing, exhaustion year)
- Table runs Year 1 through exhaustion (min 3yr, max 30yr)
- Year 1 highlighted blue, exhaustion row highlighted red, dark header/totals
- CPA disclaimer footnote

**App Redesign — Light Portal**
- Warm off-white `#f8f7f4` backgrounds, white nav/cards, gold `#c9a84c` accents, navy `#1a1a2e` text
- `BLDG Background.jpeg` at 8% opacity grayscale as full-bleed fixed backdrop
- App constrained to 768px column via `#root` max-width, box-shadow depth
- AppShell: flex column layout, watermark `position: absolute` within column
- Content area: `flex: 1, minHeight: 0, overflowY: auto` — only content scrolls
- Page backgrounds transparent so building shows through
- LoginPage: centered card with navy sign-in button, gold hover

---

## Setting Up on a New Machine

**One-time setup (first time on a new Mac):**
1. `brew install node`
2. `npm install -g @anthropic/claude-code`
3. `brew install supabase/tap/supabase`
4. `git clone https://github.com/3JTexas/RE-Analyzer-Pro ~/Applications/Claude/RE-Analyzer-Pro`
5. `cd ~/Applications/Claude/RE-Analyzer-Pro`
6. `npm install`
7. Create `.env.local` with Supabase keys — copy from existing machine or get from Supabase dashboard:
   ```
   VITE_SUPABASE_URL=https://mrraacrijhzlchskuzru.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

**Every subsequent session on any machine:**
```
cd ~/Applications/Claude/RE-Analyzer-Pro
git pull
npm run dev
```

Note: `node_modules/`, `dist/`, and `ios/` are gitignored — `npm install` recreates them. The `.env.local` file is also gitignored and must be copied manually to each machine.

---

## Pending Features / Known Issues (updated)

1. **Method refactor** — remove `method` field from DB/types; derive purely from inputs
2. **Settings / User Defaults page** — gear icon; user_defaults table; preferred defaults
3. **Per-unit rent roll** — individual unit rows replacing blended avg
4. **Update Node.js 20 → 24 in `deploy.yml`** — before June 2026 EOL
5. **Responsive layout** — desktop breakpoint-aware design

---

*Last updated: March 25, 2026*
