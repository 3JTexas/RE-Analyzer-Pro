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
    excelExport.ts   ← Excel workbook generator (exceljs) — live formulas
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
properties     (id, user_id, name, address, units, year_built, notes, compare_state jsonb, display_order, crexi_url, property_image_url, created_at, updated_at)
scenarios      (id, property_id, user_id, name, method, inputs jsonb, is_default, created_at, updated_at)
user_defaults  (id, user_id, defaults jsonb, created_at, updated_at)
```

---

## ModelInputs — Full Field List

```ts
// Income
tu, ou, rent, vp
otherIncome: { label, amount }[]
rentRoll?: RentRollUnit[]       // per-unit rent roll
useRentRoll?: boolean           // toggle: true = use rent roll, false = blended avg

// Financing
price, ir, lev, am, lf, cc

// Expenses
tax, ins, utilElec, utilElecSubmetered, utilWater, utilWaterSubmetered, utilTrash, util
rm, cs, ga, res, pm, pmMode ('pct'|'unit'), pmPerUnit
expCollapse: boolean
expPct: number
otherExpenses: { label, amount }[]

// Tax (all on Tax tab — NOT Inputs tab)
brk, land, costSeg, is1031, basis1031, equity1031

// 1031 Exchange Analysis
priorSalePrice?, priorSellingCostsPct? (default 5), priorMortgagePayoff?
priorPurchasePrice?, priorImprovements?, priorDepreciation?
cgRate? (default 20), reclaimRate? (default 25), applyExcessToDown?

// Offer calculator
targetCapRate?: number
targetOfferPrice?: number
offerCalcMode?: 'cap' | 'price'
```

**All defaults are zero.** No hardcoded values anywhere.

---

## Model Logic (calc.ts)

- Income: rent roll path (sum non-vacant unit rents) OR blended avg (rent × tu × 12)
- EGI = collected + sum(otherIncome)
- Expenses: itemized OR EGI × expPct% + otherExpenses
- **Prop mgmt**: `pmMode === 'unit'` → `pmPerUnit * 12 * tu`; else `EGI * pm / 100`
- Depreciation: is1031 + basis1031 > 0 → carryover basis; else price × (1 - land%)
- Cost seg: costSeg% of deprBase → 100% bonus; remainder → 27.5yr SL
- 1031: calc1031() computes adjusted basis, capital gain, recapture tax, cap gains tax, total tax deferred, net proceeds, excess capital
- applyExcessToDown overrides loan = price - netProceeds (improves DCR)
- equity1031 auto-set from calc1031 netProceeds when priorSalePrice > 0
- **Vacancy mode**: derived from inputs — `ou > 0 && ou < tu` = physical; else gross vacancy. No stored `method` field.
- All defaults zero (`DEFAULT_INPUTS` in calc.ts)

---

## Vacancy Mode Derivation

The `method` DB column is legacy and ignored at runtime. Vacancy mode is derived purely from inputs:

```ts
const useOM = (inp: ModelInputs, isDefault?: boolean) => isDefault || !(inp.ou > 0 && inp.ou < inp.tu)
```

- Broker scenario (is_default=true): always uses gross vacancy
- All other scenarios: `ou < tu` → physical vacancy; else gross vacancy
- No `Method` type exists in the codebase — removed April 2, 2026

---

## Tabs (6 total)

1. **Broker** — broker's as-presented figures, read-only, unlock to edit
2. **Flags** — auto-computed broker discrepancy flags + stressed scenario metrics. Red dot when high-risk flags exist.
3. **Inputs** — buyer's underwriting inputs (Income, Financing, Expenses only — no tax fields)
4. **P&L** — income statement + offer calculator + 1031 equity applied banner + Cash-on-Cash return
5. **Tax** — Tax Strategy inputs (brk, land%, costSeg%, 1031 toggle) + 1031 Exchange Analysis + Bonus Depreciation + 27.5yr Depreciation Schedule + REP analysis + Return on equity (hidden on broker scenario)
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

## 1031 Exchange Analysis

Toggle `is1031` on Tax tab (hidden on OM scenario). Full analysis:
- **Inputs:** priorSalePrice, sellingCostsPct (5%), mortgagePayoff, priorPurchasePrice, priorImprovements, priorDepreciation, cgRate (20%), reclaimRate (25%)
- **Computed:** adjustedBasis, capitalGain, recaptureTax, capGainsTax, totalTaxDeferred, netProceeds, requiredDown, excessCapital
- **applyExcessToDown** checkbox: applies excess 1031 proceeds to additional down payment, overrides loan amount in main calc, improves DCR
- **equity1031** auto-calculated from netProceeds when priorSalePrice > 0 (read-only on Tax tab); editable when no prior sale data
- **basis1031** — carryover adjusted basis for depreciation on new property (always editable)
- **P&L tab** shows amber "1031 equity applied: $X" banner when active
- Bar chart: "Sell & pay tax" vs "1031 Exchange" net proceeds comparison

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
- **Deployed:** Yes (last deployed Mar 29 2026)
- **max_tokens:** 4000
- **Model:** claude-sonnet-4-20250514

### Extraction status:
- ✅ price, tu, ou, rent (broker stated avg), vp, lev, ir, am
- ✅ tax, ins, util, utilElec, utilWater, utilTrash, rm, cs, ga, res, pm — ALL as annual totals
- ✅ utilElecSubmetered, utilWaterSubmetered booleans
- ✅ otherIncome array, propertyName, propertyAddress, yearBuilt
- ✅ rentRoll array — individual unit data when rent roll table present in OM
- Post-extraction: ins/rm/res divided by tu (app stores per-unit internally)

---

## PDF Report

- Cover page: property, address, units, year built, price, scenario, date, property photo
- Page 2: key metrics, P&L, tax analysis, cash to close
- Rent roll page: when useRentRoll=true, Unit | Type | Sq Ft | Rent/mo | Lease End table with totals
- Scenario comparison page: columns from Compare tab selection order (A, B, C, D)
- Side-by-side only renders when 2+ scenarios selected in Compare tab
- PDF preview modal before download

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

## Session — March 29, 2026

**Auth / Infrastructure fixes:**
- Fixed 401 on extract-om edge function — root cause was "Verify JWT with legacy secret" toggle enabled in Supabase Edge Functions settings. Disabled it. Also switched OMSetupFlow from raw fetch to supabase.functions.invoke() for correct auth.
- Fixed empty VITE_SUPABASE_ANON_KEY GitHub Actions secret — was blank, causing all production builds to have no key baked in.
- Node.js 20 → 24 in deploy.yml

**LOI template updates:**
- Corrected legal language to match Andrew's reviewed PDF
- Signature block: "Andrew Schildcrout for Chai Holdings, LLC / Its Managing Member"
- Added Property Alterations, Purchase and Sale Agreement, and Brokers sections
- Fixed two-column signature layout

**Settings modal:**
- Built SettingsModal with user defaults (brk, IR, LTV, land%, costSeg%, am, pm)
- user_defaults Supabase table created
- Accessible from avatar dropdown menu
- Auto-closes after save confirmation

**OM extraction fixes:**
- Insurance, R&M, reserves now extracted as annual totals (were incorrectly per-unit)
- Post-extraction conversion divides ins/rm/res by tu before storing (app stores per-unit internally)
- OMSetupFlow stale data bug fixed — full state reset on mount

**Per-unit rent roll:**
- RentRollUnit type added (id, label, type, sqft, rent, leaseEnd, vacant)
- useRentRoll toggle on Inputs tab
- Rent roll table UI with add/delete rows, vacant checkbox, lease end dates
- calc.ts income path: sum non-vacant unit rents when useRentRoll=true
- OM extraction maps individual unit data to RentRollUnit[] when rent roll table present
- PDF report shows rent roll table when useRentRoll is true

**Tax tab — full reorganization:**
- Moved brk, land%, costSeg%, is1031, equity1031, basis1031 OFF Inputs tab
- Tax tab now has "Tax Strategy" section at top with all tax inputs in two-column layout
- 1031 toggle gates entire 1031 Exchange Analysis section
- Inputs tab now clean: Income, Financing, Expenses only
- P&L tab shows amber "1031 equity applied: $X" banner when active

**1031 Exchange Analysis — complete build:**
- Full field set: prior sale price, selling costs %, mortgage payoff, original purchase price, capital improvements, depreciation taken, cap gains rate %, recapture rate %
- calc1031() function in calc.ts: adjusted basis, capital gain, recapture tax, cap gains tax, total tax deferred, net proceeds, required down, excess capital
- applyExcessToDown checkbox — applies excess 1031 proceeds to down payment, reduces loan in main calc, improves DCR
- equity1031 auto-calculated from net proceeds when priorSalePrice > 0
- All 8 fields have descriptive tooltips
- Bar chart: "Sell & pay tax" vs "1031 Exchange" net proceeds comparison

**Tax tab — bonus dep and depreciation visualizations:**
- Three chart sections: 1031 Exchange Analysis, Bonus Depreciation, 27.5-Year Depreciation Schedule
- Each has summary card + Chart.js bar chart (via react-chartjs-2)
- Bonus dep chart shows Year 1 red bar (paper loss) vs green years 2-10
- 27.5-yr chart shows teal annual bars + blue cumulative line, dual y-axis
- Descriptive tooltips on all section headers explaining SL, bonus dep, 1031 mechanics

**Tooltip clipping fix:**
- InfoTooltip component uses position:fixed + ReactDOM.createPortal to escape overflow:hidden containers
- Applied to InputField, SectionHeader, and ColTip tooltips

**PDF preview modal:**
- PDF now previews in modal before download
- PDFViewer renders inline, Download button in modal header

**Crexi URL field:**
- crexi_url column added to properties table
- "View on Crexi" button in property header when URL is set
- Inline edit via pencil icon

**Drag to reorder properties:**
- display_order column added to properties table
- Grip handle on property cards for drag reorder
- Order persists to Supabase

---

## Session — March 30, 2026

**PDF button → per-tab export dropdown:**
- Converted the PDF button into a dropdown menu with options: Full Report, P&L, Tax, Flags, OM As-Presented, Inputs
- Each option opens the existing preview modal rendering only the selected tab's page(s)
- `PdfReport.tsx` — added `exportTab?: 'full' | 'pl' | 'tax' | 'flags' | 'om' | 'inputs'` prop; each value renders only the relevant page(s)
- Flags, OM, and Inputs did not previously have dedicated PDF pages — simple clean pages added matching existing light theme (#f8f7f4 bg, navy text, gold accents)
- `ModelCalculator.tsx` — PDF button now a dropdown (absolute-positioned div, closes on outside click); sets `exportTab` state and opens preview modal
- Download filename is tab-specific: `[PropertyName]_PL.pdf`, `[PropertyName]_Tax.pdf`, etc.; Full Report retains `[PropertyName]_Full_Report.pdf`
- LOI button unchanged

---

## Session — March 31 / April 2, 2026

**Loan label fix:**
- "Loan (after excess 1031)" label now only shows when BOTH `applyExcessToDown === true` AND computed excess > 0
- Affects MetricCard sub-label (line ~1632) and Cash Flow breakdown row (line ~1656)

**Cash-on-Cash return added to P&L:**
- `d.coc` was already computed in calc.ts — added PLRow after "Pre-tax cash flow" in main UI and PDF

**Property management fee — $/unit toggle:**
- New `ModelInputs` fields: `pmMode: 'pct' | 'unit'`, `pmPerUnit: number`
- Input field now has a toggle button switching between "% EGI" and "$/unit" modes
- calc.ts: `pmAmt = pmMode === 'unit' ? pmPerUnit * 12 * tu : EGI * pm / 100`
- `pmPct` output now always computed as effective %: `(pmAmt / EGI) * 100`
- P&L label adapts to show mode context
- Helper line below input shows annual total + effective % regardless of mode

**Interactive Excel workbook export:**
- New `src/lib/excelExport.ts` — generates `.xlsx` with live Excel formulas via `exceljs` + `file-saver`
- 4 sheets: **Inputs** (editable yellow cells), **P&L** (annual + monthly columns), **Financing** (loan, cash to close, prepayment), **Tax Analysis** (depreciation, paper loss, tax savings, returns)
- All formula cells reference Inputs sheet — change any input, everything recalculates
- "Excel" button added to scenario toolbar between Save and PDF
- Downloads as `{PropertyName}_Model.xlsx`

**Method refactor — COMPLETED:**
- Removed `Method` type export from `src/types/index.ts`
- `Scenario.method` marked optional/legacy — still in DB column but ignored at runtime
- Removed `method` parameter from `createScenario()`, `save()`, `onSave()` callbacks
- Vacancy mode now derived purely from inputs: `!(ou > 0 && ou < tu)` = gross vacancy, else physical
- `useOM()` helper function in ModelCalculator derives this inline

**All "OM" terminology replaced with "Broker":**
- `OM_DEFAULTS` → `DEFAULT_INPUTS` (calc.ts)
- `OmSetupFlow` → `SetupFlow`, `OmConfirmMeta` → `SetupConfirmMeta` (OMSetupFlow.tsx — file not renamed)
- `omScenario` → `brokerScenario`, `omBadge` → `brokerBadge`, `isDefaultOM` → `isBrokerScenario`
- `omLocked/omSnapshot` → `brokerLocked/brokerSnapshot`
- `omInputs/omTabD` → `brokerInputs/brokerTabD`
- Tab ID: `'om'` → `'broker'` (activeTab, ExportTab, PrintTab types)
- Tab label: "OM" → "Broker"
- Default scenario name: "OM As-Presented" → "As-Presented"
- Badge text on all input fields: "OM" → "Broker"
- All user-facing strings: "OM method" → removed, "OM figures" → "Broker figures", "vs OM" → "vs Broker"
- PDF: removed `method` prop from `ReportDocument` and `generatePDF`, `deriveMethodLabel()` → `deriveVacancyLabel()`
- PDF: `isOM` → `isPhysical` (inverted), "OM As-Presented" → "Broker As-Presented", "OM Value" → "Broker Value"
- PropertyPage: scenario cards show `is_default ? 'Broker figures' : 'Scenario'` instead of method
- SetupFlow: "Import the OM" → "Import the broker PDF", "Create OM scenario" → "Create scenario"

**Files changed in refactor (10 files):**
- `src/types/index.ts` — removed Method type, Scenario.method optional
- `src/lib/calc.ts` — OM_DEFAULTS → DEFAULT_INPUTS
- `src/hooks/useScenario.ts` — removed method param from save/create
- `src/components/OMSetupFlow.tsx` — renamed exports + all OM text
- `src/components/model/ModelCalculator.tsx` — bulk rename + method removal
- `src/components/pdf/PdfReport.tsx` — removed method prop + all OM text
- `src/pages/PropertyPage.tsx` — updated imports, removed method usage
- `src/pages/PropertiesPage.tsx` — updated imports
- `src/pages/ScenarioPage.tsx` — removed method from save/props
- `src/components/TaxRecordImport.tsx` — "OM" → "Current" in tax comparison label

---

## Pending Features / Known Issues (updated)

1. ~~**Method refactor**~~ — DONE (April 2, 2026)
2. ~~**QA the OM→Broker refactor**~~ — DONE (April 3, 2026) — all 6 tabs verified, no "OM" text remaining
3. **Responsive layout** — desktop breakpoint-aware design
4. **Verify rent roll extraction** — test end-to-end with Bay Drive broker PDF
5. **Tax assessor PDF import** — extract-tax-record edge function + TaxRecordImport component (built Mar 25, needs testing)
6. **PDF tab pages QA** — verify Flags, Broker, and Inputs PDF pages render clean data

---

## Session — April 3, 2026

**Full codebase review (Claude Code):**
- Read every source file in the project (40+ files) from scratch
- Documented complete architecture, all features, DB schema, known issues
- Updated all memory files for future session continuity

**9 Bug fixes:**
- TaxRecordImport: switched from raw `fetch()` to `supabase.functions.invoke()` (prevents 401s)
- Removed unused `zustand` dependency from package.json
- Fixed capacitor.config.ts bundle ID: `com.yourname.dealanalyzer` → `com.ChaiHoldings.dealanalyzer`
- Removed legacy `method: 'om'` hardcoded inserts from useScenario.ts (lines 89, 110)
- Updated schema.sql: added compare_state + property_image_url columns, fixed `units default 8`, relaxed method constraint
- Added React ErrorBoundary wrapping entire App with reload button
- Fixed ModelCalculator land/costSeg defaults: 20/23 → 0/0 (user defaults system handles non-zero preferences)
- Updated copyright footers from 2025 → 2026 on LoginPage + ResetPasswordPage
- Rewrote README.md to reflect current 6-tab UI and all features

**Broker badge bug fix:**
- `brokerBadge()` function was returning `{ badge: 'changed' }` correctly, but explicit `badge="Broker"` props on InputField components were overriding the spread
- Fixed by making `brokerBadge()` always return a badge (either "Broker"/blue or "changed"/amber)
- Removed all hardcoded `badge="Broker"` from fields that use `{...brokerBadge()}`
- Added `brokerBadge()` to income fields (tu, ou, rent, vp) that previously only had hardcoded badge

**Basis1031 auto-calculation:**
- When priorPurchasePrice, priorImprovements, or priorDepreciation change, basis1031 is now auto-calculated as `adjustedBasis` from `calc1031()`
- All five 1031 input fields (priorSalePrice, priorMortgagePayoff, priorPurchasePrice, priorImprovements, priorDepreciation) now recalculate both equity1031 and basis1031
- basis1031 field remains manually editable when no prior sale data is entered

**Duplicate scenario merges user defaults:**
- When duplicating a scenario from PropertyPage, user defaults (from Settings) are now merged into the copy
- Only fills fields that are 0/unset in the source scenario — preserves existing values
- Imported useUserDefaults hook into PropertyPage

**Broker refactor QA — PASSED:**
- Walked through all 6 tabs on broker and non-broker scenarios
- Verified: no "OM" text anywhere, badges correct, LOI hidden on broker, offer calc hidden on broker
- Compare tab: deltas calculating correctly across scenarios
- 1031 section, flags, stressed scenario all working

**Automated TestFlight CI/CD:**
- New workflow: `.github/workflows/testflight.yml`
- Triggers: manual dispatch (`workflow_dispatch`) or version tags (`v*`) — NOT every push
- Uses cloud-managed signing via App Store Connect API key (Admin role required)
- API key stored as base64 in GitHub Secret (GitHub strips newlines from PEM files)
- macOS runner: builds web → cap add/sync → pod install → xcodebuild archive → export → upload
- Build number auto-increments from timestamp
- After upload: answer "No" to encryption compliance in App Store Connect
- GitHub Secrets: `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY` (base64), `APPLE_TEAM_ID`
- To trigger: `gh workflow run testflight.yml` or `git tag v1.1 && git push --tags`
- Apple login: andrew@3jtexas.com (not chaiholdings)

---

## Upcoming Feature: Deal Pipeline / Transaction Tracker

### Overview
Once a property moves from underwriting to active deal, a new "Pipeline" workflow is needed — separate from the 6-tab underwriting shell. Accessed via a "Track Deal →" button on PropertyPage. This is a distinct full-screen interface, not crammed into the existing tab structure.

### Proposed Sub-Sections
1. **Timeline** — milestone tracker (LOI signed, PSA executed, inspection period, financing contingency, closing date)
2. **Documents** — upload, tag, and AI-extract key terms from LOI, PSA, inspection reports, contracts
3. **Deal Team** — vendors by role (attorney, inspector, PM, lender, title, broker, appraiser) with multiple candidates per role and a "selected" flag
4. **Expenses** — categorized running log (travel, professional fees, inspections, earnest money, appraisal, etc.)
5. **Repair Estimates** — itemized list with contractor, amount, status; supports re-trade negotiation; potential PDF output to send seller

### Document Extraction Targets
- **LOI:** purchase price, closing date, DD period, deposit amount, contingencies
- **PSA:** all of above plus additional contract terms
- Uses same Anthropic API extraction pattern as existing extract-om edge function

### UI Direction
- Mobile-first view (current 768px shell) for quick reference
- Richer desktop-first layout for heavy data entry (wider than 768px)
- Consider separate route: `/properties/:id/pipeline`

### Open Questions (need answers before building)
1. Trigger: always visible per property, or only after manually marking "Under Contract"?
2. Document extraction fields — confirm full field list for LOI and PSA
3. Deal team roles — confirm full list beyond attorney/inspector/PM
4. Expenses — budget vs. actual, or just running log? Category list?
5. Repair estimates — tied to inspection findings or free-form? Generate re-trade PDF?
6. Closing — does property graduate to portfolio/asset management view after closing?
7. Multi-property — master pipeline view across all active deals, or always property-by-property?

### Current Status
- Feature scoped and FULLY BUILT on April 6, 2026

### What's Built
- 4 property statuses: Research → Pending → Active → Closed (pill toggle on PropertyPage)
- Mini-pipeline (Pending): Deal Terms + LOI status tracker, Documents, Contacts (attorney + broker)
- Full pipeline (Active): Timeline milestones, Documents, Deal Team (8 roles + sub-contacts), Expenses (budget vs actual), Repairs (+ re-trade PDF)
- Deals dashboard on home page with Properties | Deals pill toggle, metrics cards, deal summary cards
- AI extraction edge function (extract-deal-doc) for LOI, PSA, and inspection reports
- Scenario selector: "Which scenario is your offer?" — links deal terms to a specific scenario
- Wide layout (1280px) on pipeline pages, responsive grid on properties/scenarios

### New Database Tables
- `deal_pipelines` — JSONB for loi_tracking, milestones, deal_team, repair_estimates, expense_budgets + deal_scenario_id
- `deal_documents` — file uploads with AI extraction results
- `deal_expenses` — budget vs actual by category

### New Files
- `src/types/pipeline.ts` — all pipeline types
- `src/hooks/usePipeline.ts` — pipeline, document, expense hooks
- `src/pages/PipelinePage.tsx` — main pipeline page with conditional tabs
- `src/components/pipeline/TimelineSection.tsx` — milestone tracker
- `src/components/pipeline/DocumentsSection.tsx` — document upload + AI extraction
- `src/components/pipeline/DealTeamSection.tsx` — vendor management with sub-contacts
- `src/components/pipeline/ExpensesSection.tsx` — budget vs actual
- `src/components/pipeline/RepairsSection.tsx` — repair estimates
- `src/components/pipeline/RepairsPdf.tsx` — re-trade PDF via @react-pdf/renderer
- `supabase/functions/extract-deal-doc/` — edge function for document AI extraction

### Pending for Pipeline
- Deploy extract-deal-doc edge function to Supabase
- Adobe Acrobat Sign integration for e-signatures (future)
- Import inspection findings into repair estimates
- LOI diff: compare uploaded executed LOI against generated version

---

## Session — April 6, 2026

**Responsive desktop layout:**
- Removed 768px #root constraint — full viewport width on desktop
- AppShell: desktop nav links inline in header, backdrop-blur, no bottom tabs on desktop
- Properties page: 2-3 column grid for property cards
- PropertyPage: 2-column scenario grid
- ModelCalculator: max-w-5xl centered with more padding
- Building watermark at 8% opacity covers full viewport
- Mobile unchanged

**Deal Pipeline — full build:**
- Property status system: Research → Pending → Active → Closed
- Status pills on PropertyPage (dropdown replaced with clear pill buttons)
- Track Deal → button navigates to pipeline page
- PipelinePage: wide layout (1280px), conditional tabs based on status
- Mini-pipeline for Pending: Deal Terms (LOI status tracker with 5 states, scenario selector, locked deal terms from scenario), Documents, Contacts
- Full pipeline for Active: Timeline (milestones with progress bar, expandable editors), Documents (upload + AI extraction), Deal Team (8 roles with sub-contacts), Expenses (budget vs actual by 9 categories with progress bars), Repairs (severity, status, contractor, re-trade PDF)
- Deals dashboard: Properties | Deals pill toggle, metrics cards (Active, Pending, Pipeline Value, Closed), deal summary cards linking to pipeline
- AI extraction edge function: doc-type-specific prompts for LOI, PSA, inspection reports

**Bug fixes earlier in session:**
- 9 cleanup bugs (TaxRecordImport, zustand, capacitor ID, method inserts, schema.sql, error boundary, defaults, copyright, README)
- Badge bug: brokerBadge now correctly shows "changed" vs "Broker"
- Basis1031 auto-calculation from prior sale fields
- Duplicate scenario merges user defaults
- Broker refactor QA passed all checks

**TestFlight CI/CD:**
- Automated TestFlight workflow via GitHub Actions
- Cloud-managed signing with App Store Connect API key (Admin role)
- Base64-encoded .p8 key in GitHub Secrets
- Encryption compliance auto-set via Info.plist injection
- Triggers: manual dispatch or version tags only (not every push)
- Base path fix: VITE_BASE_URL=/ for Capacitor builds

---

*Last updated: April 6, 2026*

*Last updated: April 6, 2026*
