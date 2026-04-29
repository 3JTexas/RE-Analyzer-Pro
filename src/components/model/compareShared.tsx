import { calculate, fmtDollar, fmtNeg, fmtPct, fmtX, fmtDelta, fmtDeltaPct } from '../../lib/calc'

// Column color palettes — extended to 6 to support cross-property compare.
// In-property compare (CompareTab inside ModelCalculator) still caps at 4.
export const COL_STYLES = [
  { hdrBg: 'bg-blue-900',   hdrText: 'text-blue-200',   border: 'border-blue-700',   val: 'text-blue-700'   },
  { hdrBg: 'bg-amber-900',  hdrText: 'text-amber-200',  border: 'border-amber-700',  val: 'text-amber-700'  },
  { hdrBg: 'bg-green-900',  hdrText: 'text-green-200',  border: 'border-green-700',  val: 'text-green-700'  },
  { hdrBg: 'bg-purple-900', hdrText: 'text-purple-200', border: 'border-purple-700', val: 'text-purple-700' },
  { hdrBg: 'bg-rose-900',   hdrText: 'text-rose-200',   border: 'border-rose-700',   val: 'text-rose-700'   },
  { hdrBg: 'bg-teal-900',   hdrText: 'text-teal-200',   border: 'border-teal-700',   val: 'text-teal-700'   },
]
export const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

export type RowSpec = {
  label: string
  get: (d: ReturnType<typeof calculate>) => number
  paren?: boolean
  pct?: boolean
  x?: boolean
  noD?: boolean
  bold?: boolean
  indent?: boolean
}

export const ROW_SPECS: RowSpec[] = [
  { label: 'Gross potential rent',     get: d => d.GSR,   bold: true  },
  { label: '  Vacancy deduction',      get: d => d.vac,   paren: true, indent: true },
  { label: '  Collected rental income',get: d => d.col,   indent: true },
  { label: 'Effective gross income',   get: d => d.EGI,   bold: true  },
  { label: 'Total expenses',           get: d => d.exp,   paren: true },
  { label: 'NOI',                      get: d => d.NOI,   bold: true  },
  { label: 'Annual debt service',      get: d => d.ds,    paren: true, noD: true },
  { label: 'Pre-tax cash flow',        get: d => d.CF                 },
  { label: 'After-tax cash flow',      get: d => d.at                 },
  { label: 'Cap rate',                 get: d => d.cap,   pct: true   },
  { label: 'DCR',                      get: d => d.dcr,   x: true     },
  { label: 'Y1 total ROE',             get: d => d.r1,    pct: true, bold: true },
  { label: 'Yr 2+ stabilized ROE',     get: d => d.r2,    pct: true   },
]

export function fmtVal(v: number, spec: RowSpec): string {
  if (spec.pct) return fmtPct(v)
  if (spec.x)   return fmtX(v)
  if (spec.paren) return `(${fmtDollar(Math.abs(v))})`
  return fmtNeg(v)
}

export function fmtDeltaVal(d: number, spec: RowSpec): string {
  if (spec.noD) return '—'
  if (spec.pct) return fmtDeltaPct(d)
  if (spec.x)   return (d >= 0 ? '+' : '') + d.toFixed(2) + '×'
  return fmtDelta(d)
}
