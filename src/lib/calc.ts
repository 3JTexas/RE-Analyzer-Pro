import type { ModelInputs, ModelOutputs } from '../types'

// ── Blank template ────────────────────────────────────────────────────────
export const DEFAULT_INPUTS: ModelInputs = {
  tu: 0, ou: 0, rent: 0, vp: 0,
  price: 0, ir: 0, lev: 0, am: 0, lf: 0, cc: 0,
  tax: 0, ins: 0, utilElec: 0, utilElecSubmetered: false, utilWater: 0, utilWaterSubmetered: false, utilTrash: 0, util: 0, rm: 0, cs: 0,
  ga: 0, res: 0, pm: 0, pmMode: 'pct', pmPerUnit: 0, expCollapse: false, expPct: 0,
  brk: 0, land: 0, costSeg: 0, is1031: false, basis1031: 0, equity1031: 0,
  otherIncome: [],
  otherExpenses: [],
}

// ── Formatting helpers ────────────────────────────────────────────────────
export function fmtDollar(v: number): string {
  return '$' + Math.round(Math.abs(v)).toLocaleString()
}
export function fmtNeg(v: number): string {
  return v < 0 ? `(${fmtDollar(v)})` : fmtDollar(v)
}
export function fmtPct(v: number, digits = 2): string {
  return v.toFixed(digits) + '%'
}
export function fmtX(v: number): string {
  return v.toFixed(2) + '×'
}
export function fmtDelta(v: number): string {
  return (v >= 0 ? '+' : '-') + '$' + Math.round(Math.abs(v)).toLocaleString()
}
export function fmtDeltaPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + 'pp'
}

// ── Core math ─────────────────────────────────────────────────────────────
export function pmtCalcExport(P: number, annRate: number, years: number): number {
  return pmtCalc(P, annRate, years)
}

function pmtCalc(P: number, annRate: number, years: number): number {
  const r = annRate / 100 / 12
  const n = years * 12
  if (r === 0 || n === 0) return P / (n || 1)
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function y1Interest(P: number, annRate: number, years: number): number {
  if (annRate === 0 || years === 0) return 0
  const r = annRate / 100 / 12
  const m = pmtCalc(P, annRate, years)
  let bal = P, tot = 0
  for (let i = 0; i < 12; i++) {
    const ip = bal * r
    tot += ip
    bal -= m - ip
  }
  return tot
}

// ── 1031 Exchange calculation ─────────────────────────────────────────────
export interface Exchange1031 {
  sellingCosts: number
  adjustedBasis: number
  capitalGain: number
  recaptureTax: number
  capGainsTax: number
  totalTaxDeferred: number
  netProceeds: number
  requiredDown: number
  excessCapital: number
}

export function calc1031(inputs: ModelInputs): Exchange1031 | null {
  const sale = inputs.priorSalePrice ?? 0
  if (sale <= 0) return null
  const sellingCostsPct = inputs.priorSellingCostsPct ?? 5
  const mortgage = inputs.priorMortgagePayoff ?? 0
  const purchase = inputs.priorPurchasePrice ?? 0
  const improvements = inputs.priorImprovements ?? 0
  const depreciation = inputs.priorDepreciation ?? 0
  const cgRate = (inputs.cgRate ?? 20) / 100
  const reclaimRate = (inputs.reclaimRate ?? 25) / 100

  const sellingCosts = sale * sellingCostsPct / 100
  const adjustedBasis = purchase + improvements - depreciation
  const capitalGain = Math.max(0, sale - sellingCosts - adjustedBasis)
  const recaptureTax = depreciation * reclaimRate
  const capGainsTax = capitalGain * cgRate
  const totalTaxDeferred = capGainsTax + recaptureTax
  const netProceeds = sale - sellingCosts - mortgage
  const requiredDown = inputs.price * (1 - inputs.lev / 100)
  const excessCapital = Math.max(0, netProceeds - requiredDown)

  return { sellingCosts, adjustedBasis, capitalGain, recaptureTax, capGainsTax, totalTaxDeferred, netProceeds, requiredDown, excessCapital }
}

// ── NNN (single-tenant triple-net) calculation ───────────────────────────
// Branched off the main calculate() when inputs.propertyType === 'nnn'.
// Differences vs multifamily:
//  - GSR = nnnAnnualRent (one number, no per-unit math)
//  - Vacancy = 0 during the lease (set 0 unless explicitly modeled)
//  - LL expenses = landlord reserves + (taxes/insurance ONLY if not pure NNN)
//  - Depreciation horizon = 39 years (commercial) instead of 27.5
//  - 1031 logic still applies via the shared deferred-basis path
function calculateNNN(inputs: ModelInputs): ModelOutputs {
  const {
    price, ir, lev, am, lf, cc,
    brk, land, costSeg,
    is1031, basis1031,
    buildingSqft = 0,
    nnnAnnualRent = 0,
    landlordReservesAnnual = 0,
    tax = 0, ins = 0,
    nnnType,
  } = inputs

  const otherIncome = inputs.otherIncome ?? []
  const otherExpenses = inputs.otherExpenses ?? []

  // Income — annual base rent, no vacancy during lease
  const GSR = nnnAnnualRent
  const pv = 0
  const av = 0
  const vac = 0
  const col = GSR
  const otherIncomeTotal = otherIncome.reduce((s, x) => s + (x.amount || 0), 0)
  const EGI = col + otherIncomeTotal

  // Landlord expenses depend on lease type:
  //  - Absolute NNN / NNN: tenant pays taxes + insurance + CAM. LL = reserves only.
  //  - NN: tenant pays taxes + insurance. LL pays CAM (modeled as reserves).
  //  - Modified gross: LL covers more — include taxes + insurance.
  const isFullNNN = nnnType === 'NNN' || nnnType === 'absolute_NNN'
  const llTax = isFullNNN ? 0 : tax
  const llIns = isFullNNN ? 0 : ins
  const otherExpensesTotal = otherExpenses.reduce((s, x) => s + (x.amount || 0), 0)
  const exp = landlordReservesAnnual + llTax + llIns + otherExpensesTotal

  const NOI = EGI - exp

  // Debt — same financing math as MF (no 1031 applyExcessToDown for v1 NNN)
  const stdLoan = price * lev / 100
  const loan = stdLoan
  const down = price - loan
  const lfee = loan * lf / 100
  const ccAmt = price * cc / 100
  const eq = down + lfee
  const mp = pmtCalc(loan, ir, am)
  const ds = mp * 12
  const int1 = y1Interest(loan, ir, am)
  const prin1 = ds - int1

  const CF = NOI - ds
  const cap = price ? (NOI / price) * 100 : 0
  const dcr = ds ? NOI / ds : 0

  // Depreciation — 39-year commercial straight-line
  const deferredGain = is1031 ? (inputs.deferredGain1031 ?? 0) : 0
  const deprBase = is1031 && basis1031 > 0
    ? basis1031
    : deferredGain > 0
      ? (price - deferredGain) * (1 - land / 100)
      : price * (1 - land / 100)
  const costSegFrac = costSeg / 100
  const bd = deprBase * costSegFrac
  const sl = (deprBase * (1 - costSegFrac)) / 39  // commercial 39yr (vs MF 27.5yr)

  const closingDate = inputs.closingDate
  let closingMonths = 12
  if (closingDate) {
    const month = new Date(closingDate + 'T00:00:00').getMonth() + 1
    closingMonths = 12 - month + 0.5
  }
  const slY1 = sl * (closingMonths / 12)

  const ti = NOI - int1
  const loss = ti - bd - slY1
  const ts = Math.abs(loss) * brk / 100

  const at = CF + ts
  const y1 = at + prin1
  const coc = eq ? (CF / eq) * 100 : 0
  const atc = eq ? (at / eq) * 100 : 0
  const r1 = eq ? (y1 / eq) * 100 : 0
  const r2 = eq ? ((CF + slY1 * brk / 100 + prin1) / eq) * 100 : 0

  // Use buildingSqft as the "tu" pass-through so per-SF UI logic can read it.
  // This is a UI convention only — the math above doesn't depend on it.
  return {
    GSR, pv, av, vac, col, EGI,
    loan, down, lfee, ccAmt, eq, mp, ds, int1, prin1,
    taxTotal: llTax, ins: llIns, util: 0, rm: 0, cs: 0, ga: 0,
    res: landlordReservesAnnual, pm: 0, pmPct: 0,
    otherIncomeTotal, otherExpensesTotal,
    exp, NOI, CF, cap, dcr,
    deprBase, bd, sl, slY1, closingMonths, ti, loss, ts, at, y1,
    coc, atc, r1, r2,
    price, lev, lfp: lf, ir, am, land, costSeg,
    tu: buildingSqft, ou: buildingSqft, rent: 0, vp: 0, brk,
  }
}

// ── Main calculation ──────────────────────────────────────────────────────
export function calculate(inputs: ModelInputs, useOM: boolean): ModelOutputs {
  // NNN deals follow a separate underwriting path
  if (inputs.propertyType === 'nnn') return calculateNNN(inputs)

  const { tu, ou, rent, vp, price, ir, lev, am, lf, cc,
          tax, util, cs, ga, brk, land, costSeg, is1031, basis1031,
          expCollapse, expPct } = inputs
  const otherIncome = inputs.otherIncome ?? []
  const otherExpenses = inputs.otherExpenses ?? []

  // Income — rent roll path vs blended avg
  const rentRoll = inputs.rentRoll
  const useRR = inputs.useRentRoll && rentRoll && rentRoll.length > 0
  const rrMonthly = useRR ? rentRoll!.filter(u => !u.vacant).reduce((s, u) => s + (u.rent || 0), 0) : 0
  const rrOccupied = useRR ? rentRoll!.filter(u => !u.vacant).length : ou
  const effectiveRent = useRR ? (tu > 0 ? rrMonthly / tu : 0) : rent
  const effectiveOu = useRR ? rrOccupied : ou

  const GSR = useRR ? rrMonthly * 12 : rent * tu * 12
  let pv: number, av: number, col: number
  if (useOM) {
    pv = GSR * vp / 100; av = 0; col = GSR - pv
  } else {
    const baseCol = useRR ? rrMonthly * 12 : effectiveRent * effectiveOu * 12
    pv = GSR - baseCol; av = baseCol * vp / 100; col = baseCol - av
  }
  const vac = pv + av
  const otherIncomeTotal = otherIncome.reduce((s, x) => s + (x.amount || 0), 0)
  const EGI = col + otherIncomeTotal

  // Debt — 1031 applyExcessToDown: only the EXCESS beyond standard cash-to-close reduces the loan
  const ex1031 = is1031 ? calc1031(inputs) : null
  const equity1031Amt = is1031 ? (ex1031 && ex1031.netProceeds > 0 ? ex1031.netProceeds : (inputs.equity1031 ?? 0)) : 0
  const stdLoan = price * lev / 100
  const stdDown = price - stdLoan
  const stdLfee = stdLoan * lf / 100
  const stdCcAmt = price * cc / 100
  const stdCashToClose = stdDown + stdLfee + stdCcAmt
  const excess1031 = Math.max(0, equity1031Amt - stdCashToClose)
  const useExcess = is1031 && inputs.applyExcessToDown && excess1031 > 0
  const loan = useExcess
    ? Math.max(0, stdLoan - excess1031)
    : stdLoan
  const down = price - loan
  const lfee = loan * lf / 100
  const ccAmt = price * cc / 100
  const eq = down + lfee
  const mp = pmtCalc(loan, ir, am)
  const ds = mp * 12
  const int1 = y1Interest(loan, ir, am)
  const prin1 = ds - int1

  // Expenses
  let exp: number
  let insTotal: number, rmTotal: number, resTotal: number, pmAmt: number
  const otherExpensesTotal = otherExpenses.reduce((s, x) => s + (x.amount || 0), 0)
  if (expCollapse) {
    exp = EGI * expPct / 100 + otherExpensesTotal
    insTotal = 0; rmTotal = 0; resTotal = 0; pmAmt = 0
  } else {
    insTotal = inputs.ins * tu
    rmTotal = inputs.rm * tu
    resTotal = inputs.res * tu
    pmAmt = inputs.pmMode === 'unit' ? inputs.pmPerUnit * 12 * tu : EGI * inputs.pm / 100
    exp = tax + insTotal + util + rmTotal + cs + ga + resTotal + pmAmt + otherExpensesTotal
  }

  // Operations
  const NOI = EGI - exp
  const CF = NOI - ds
  const cap = price ? (NOI / price) * 100 : 0
  const dcr = ds ? NOI / ds : 0

  // Depreciation — 1031 reduces basis by deferred gain, otherwise price × (1 - land%)
  // Deferred gain: use manual entry if provided, otherwise auto-calc from prior sale
  const manualGain = inputs.deferredGain1031 ?? 0
  const autoGain = ex1031 ? ex1031.capitalGain : 0
  const deferredGain = is1031 ? (manualGain > 0 ? manualGain : autoGain) : 0
  const deprBase = is1031 && basis1031 > 0
    ? basis1031  // full manual basis override
    : deferredGain > 0
      ? (price - deferredGain) * (1 - land / 100)
      : price * (1 - land / 100)
  const costSegFrac = costSeg / 100
  const bd = deprBase * costSegFrac
  const sl = (deprBase * (1 - costSegFrac)) / 27.5  // full-year SL

  // Closing date → partial year 1 SL depreciation
  // IRS mid-month convention: property placed in service in middle of closing month
  const closingDate = inputs.closingDate
  let closingMonths = 12
  if (closingDate) {
    const month = new Date(closingDate + 'T00:00:00').getMonth() + 1 // 1-12
    closingMonths = 12 - month + 0.5  // mid-month convention: half the closing month + remaining months
  }
  const slY1 = sl * (closingMonths / 12)

  const ti = NOI - int1
  const loss = ti - bd - slY1
  const ts = Math.abs(loss) * brk / 100

  // Returns
  const at = CF + ts
  const y1 = at + prin1
  const coc = eq ? (CF / eq) * 100 : 0
  const atc = eq ? (at / eq) * 100 : 0
  const r1 = eq ? (y1 / eq) * 100 : 0
  const r2 = eq ? ((CF + slY1 * brk / 100 + prin1) / eq) * 100 : 0

  return {
    GSR, pv, av, vac, col, EGI,
    loan, down, lfee, ccAmt, eq, mp, ds, int1, prin1,
    taxTotal: tax, ins: insTotal, util, rm: rmTotal, cs, ga, res: resTotal, pm: pmAmt,
    pmPct: EGI ? (pmAmt / EGI) * 100 : 0,
    otherIncomeTotal, otherExpensesTotal,
    exp, NOI, CF, cap, dcr,
    deprBase, bd, sl, slY1, closingMonths, ti, loss, ts, at, y1,
    coc, atc, r1, r2,
    price, lev, lfp: lf, ir, am, land, costSeg, tu, ou: effectiveOu, rent: effectiveRent, vp, brk,
  }
}
