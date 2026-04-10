// ── Rent roll unit ────────────────────────────────────────────────────────
export interface RentRollUnit {
  id: string           // uuid, generated client-side
  label: string        // e.g. "Unit 1", "Unit A"
  type: string         // e.g. "1bd/1ba", "Studio", "2bd/1ba"
  sqft: number
  rent: number         // monthly rent
  leaseEnd?: string    // lease expiration date string e.g. "06/04/2026"
  vacant?: boolean     // true if unit is vacant
}

// ── Model inputs ──────────────────────────────────────────────────────────
export interface ModelInputs {
  // Income
  tu: number       // total units
  ou: number       // occupied units
  rent: number     // avg rent / unit / month
  vp: number       // vacancy % (of GSR when fully occupied; turnover buffer when physically vacant)
  // Financing
  price: number
  ir: number       // interest rate %
  lev: number      // LTV %
  am: number       // amortization years
  lf: number       // lender fee %
  cc: number       // closing costs % of purchase price
  // Expenses
  tax: number      // real estate taxes $
  ins: number      // insurance $/door/yr
  utilElec: number  // Electric (landlord-paid)
  utilElecSubmetered: boolean // tenants pay electric directly
  utilWater: number // Water & Sewer
  utilWaterSubmetered: boolean // tenants pay water directly
  utilTrash: number // Trash Removal
  util: number      // Total utilities — auto-sum of above three, but editable
  rm: number       // repairs & maintenance $/unit/yr
  cs: number       // contract services $
  ga: number       // G&A $
  res: number      // reserves $/unit/yr
  pm: number       // property management % of EGI
  pmMode: 'pct' | 'unit'  // % of EGI or $/unit/month
  pmPerUnit: number        // $/unit/month (used when pmMode = 'unit')
  expCollapse: boolean  // use blended expense ratio instead of itemized
  expPct: number        // expense ratio % of EGI (when expCollapse = true)
  otherIncome: { label: string; amount: number }[]   // user-defined income line items
  otherExpenses: { label: string; amount: number }[] // user-defined expense line items
  // Tax
  brk: number      // tax bracket %
  land: number     // land % (non-depreciable)
  costSeg: number  // cost seg % allocated to 5/7/15yr components (default 23)
  closingDate?: string // closing date (YYYY-MM-DD) — determines partial-year depreciation
  is1031: boolean  // 1031 exchange — use carryover basis for depreciation
  basis1031: number // carryover adjusted basis $ (manual override, used when is1031 = true)
  equity1031: number // 1031 equity rolling in $ (reduces cash to close)
  deferredGain1031?: number // deferred gain from relinquished sale (auto-calc from prior sale or manual entry)
  targetCapRate?: number // offer calculator target cap rate %
  targetOfferPrice?: number // offer calculator target price $
  offerCalcMode?: 'cap' | 'price' // which offer calculator mode is active
  // Rent roll
  rentRoll?: RentRollUnit[]
  useRentRoll?: boolean   // toggle: true = use rent roll, false = use blended avg rent
  // 1031 exchange analysis
  priorSalePrice?: number        // sale price of relinquished property
  priorSellingCostsPct?: number  // selling costs % (default 5)
  priorMortgagePayoff?: number   // remaining loan balance on prior property
  priorPurchasePrice?: number    // original purchase price of prior property
  priorImprovements?: number     // capital improvements made
  priorDepreciation?: number     // total depreciation taken on prior property
  cgRate?: number                // long-term cap gains rate % (default 20)
  reclaimRate?: number           // depreciation recapture rate % (default 25)
  applyExcessToDown?: boolean    // apply excess 1031 proceeds to additional down payment
  // Deal-level (not used in calc engine)
  capx?: number                  // Year 1 capital expenditures $ (Deal Terms only, pipeline-level)
}

// ── Computed outputs ──────────────────────────────────────────────────────
export interface ModelOutputs {
  // Income
  GSR: number
  pv: number
  av: number
  vac: number
  col: number
  EGI: number
  // Debt
  loan: number
  down: number
  lfee: number
  ccAmt: number
  eq: number
  mp: number
  ds: number
  int1: number
  prin1: number
  // Expenses (totals)
  taxTotal: number
  ins: number
  util: number
  rm: number
  cs: number
  ga: number
  res: number
  pm: number
  pmPct: number
  exp: number
  otherIncomeTotal: number
  otherExpensesTotal: number
  // Operations
  NOI: number
  CF: number
  cap: number
  dcr: number
  // Tax
  deprBase: number  // depreciable basis used
  bd: number        // bonus depreciation
  sl: number        // 27.5yr SL depreciation (full year)
  slY1: number      // SL depreciation for year 1 (partial if closing date set)
  closingMonths: number // months of depreciation in year 1 (1-12)
  ti: number        // taxable income before dep
  loss: number      // paper loss
  ts: number        // tax savings
  at: number        // after-tax cash flow
  y1: number        // total Y1 economic return
  // Returns
  coc: number
  atc: number
  r1: number
  r2: number
  // Pass-through for display
  price: number
  lev: number
  lfp: number
  ir: number
  am: number
  land: number
  costSeg: number
  tu: number
  ou: number
  rent: number
  vp: number
  brk: number
}

// ── Database types ────────────────────────────────────────────────────────
export interface Property {
  id: string
  user_id: string
  name: string
  address: string | null
  units: number | null
  year_built: number | null
  notes: string | null
  status: 'research' | 'pending' | 'active' | 'closed'
  display_order: number
  crexi_url: string | null
  property_image_url: string | null
  created_at: string
  updated_at: string
  scenarios?: Scenario[]
}

export interface Scenario {
  id: string
  property_id: string
  user_id: string
  name: string
  method?: string  // legacy DB field — ignored at runtime
  inputs: ModelInputs
  is_default: boolean
  created_at: string
  updated_at: string
}

// ── UI helpers ────────────────────────────────────────────────────────────

export interface DeltaRow {
  label: string
  om: string
  ph: string
  delta: string
  deltaValue: number
  indent?: boolean
  bold?: boolean
}

export interface TaxRecordExtraction {
  assessedValue: number | null
  landValue: number | null
  improvementValue: number | null
  landPct: number | null
  taxableValue: number | null
  annualTaxBill: number | null
  millageRate: number | null
  taxYear: number | null
  parcelId: string | null
  ownerName: string | null
  propertyAddress: string | null
}
