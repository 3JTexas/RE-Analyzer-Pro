import type { ModelInputs, ModelOutputs } from '../types'

// ── Blank template ────────────────────────────────────────────────────────
export const OM_DEFAULTS: ModelInputs = {
  tu: 0, ou: 0, rent: 0, vp: 0,
  price: 0, ir: 0, lev: 0, am: 0, lf: 0, cc: 0,
  tax: 0, ins: 0, utilElec: 0, utilWater: 0, utilTrash: 0, util: 0, rm: 0, cs: 0,
  ga: 0, res: 0, pm: 0, expCollapse: false, expPct: 0,
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

// ── Main calculation ──────────────────────────────────────────────────────
export function calculate(inputs: ModelInputs, useOM: boolean): ModelOutputs {
  const { tu, ou, rent, vp, price, ir, lev, am, lf, cc,
          tax, util, cs, ga, brk, land, costSeg, is1031, basis1031,
          expCollapse, expPct } = inputs
  const otherIncome = inputs.otherIncome ?? []
  const otherExpenses = inputs.otherExpenses ?? []

  // Income
  const GSR = rent * tu * 12
  let pv: number, av: number, col: number
  if (useOM) {
    pv = GSR * vp / 100; av = 0; col = GSR - pv
  } else {
    const baseCol = rent * ou * 12
    pv = GSR - baseCol; av = baseCol * vp / 100; col = baseCol - av
  }
  const vac = pv + av
  const otherIncomeTotal = otherIncome.reduce((s, x) => s + (x.amount || 0), 0)
  const EGI = col + otherIncomeTotal

  // Debt
  const loan = price * lev / 100
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
    pmAmt = EGI * inputs.pm / 100
    exp = tax + insTotal + util + rmTotal + cs + ga + resTotal + pmAmt + otherExpensesTotal
  }

  // Operations
  const NOI = EGI - exp
  const CF = NOI - ds
  const cap = price ? (NOI / price) * 100 : 0
  const dcr = ds ? NOI / ds : 0

  // Depreciation — 1031 uses carryover basis, otherwise price × (1 - land%)
  const deprBase = is1031 && basis1031 > 0
    ? basis1031
    : price * (1 - land / 100)
  const costSegFrac = costSeg / 100
  const bd = deprBase * costSegFrac
  const sl = (deprBase * (1 - costSegFrac)) / 27.5
  const ti = NOI - int1
  const loss = ti - bd - sl
  const ts = Math.abs(loss) * brk / 100

  // Returns
  const at = CF + ts
  const y1 = at + prin1
  const coc = eq ? (CF / eq) * 100 : 0
  const atc = eq ? (at / eq) * 100 : 0
  const r1 = eq ? (y1 / eq) * 100 : 0
  const r2 = eq ? ((CF + sl * brk / 100 + prin1) / eq) * 100 : 0

  return {
    GSR, pv, av, vac, col, EGI,
    loan, down, lfee, ccAmt, eq, mp, ds, int1, prin1,
    taxTotal: tax, ins: insTotal, util, rm: rmTotal, cs, ga, res: resTotal, pm: pmAmt,
    pmPct: inputs.pm,
    otherIncomeTotal, otherExpensesTotal,
    exp, NOI, CF, cap, dcr,
    deprBase, bd, sl, ti, loss, ts, at, y1,
    coc, atc, r1, r2,
    price, lev, lfp: lf, ir, am, land, costSeg, tu, ou, rent, vp, brk,
  }
}
