// ── Model inputs ──────────────────────────────────────────────────────────
export interface ModelInputs {
  // Income
  tu: number       // total units
  ou: number       // occupied units
  rent: number     // avg rent / unit / month
  vp: number       // vacancy % (of GSR in OM mode; of occupied rent in PO mode)
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
  util: number     // utilities $
  rm: number       // repairs & maintenance $/unit/yr
  cs: number       // contract services $
  ga: number       // G&A $
  res: number      // reserves $/unit/yr
  pm: number       // property management % of EGI
  expCollapse: boolean  // use blended expense ratio instead of itemized
  expPct: number        // expense ratio % of EGI (when expCollapse = true)
  otherIncome: { label: string; amount: number }[]   // user-defined income line items
  otherExpenses: { label: string; amount: number }[] // user-defined expense line items
  // Tax
  brk: number      // tax bracket %
  land: number     // land % (non-depreciable)
  costSeg: number  // cost seg % allocated to 5/7/15yr components (default 23)
  is1031: boolean  // 1031 exchange — use carryover basis for depreciation
  basis1031: number // carryover adjusted basis $ (used when is1031 = true)
  equity1031: number // 1031 equity rolling in $ (reduces cash to close)
  targetCapRate?: number // offer calculator target cap rate %
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
  sl: number        // 27.5yr SL depreciation
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
  created_at: string
  updated_at: string
  scenarios?: Scenario[]
}

export interface Scenario {
  id: string
  property_id: string
  user_id: string
  name: string
  method: 'om' | 'physical'
  inputs: ModelInputs
  is_default: boolean
  created_at: string
  updated_at: string
}

// ── UI helpers ────────────────────────────────────────────────────────────
export type Method = 'om' | 'physical'

export interface DeltaRow {
  label: string
  om: string
  ph: string
  delta: string
  deltaValue: number
  indent?: boolean
  bold?: boolean
}
