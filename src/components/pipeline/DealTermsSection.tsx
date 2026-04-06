import { useState, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { calculate, fmtDollar, fmtPct, fmtX, fmtNeg } from '../../lib/calc'
import type { ModelInputs } from '../../types'
import type { DealPipeline } from '../../types/pipeline'

interface Props {
  dealScenario: { name: string; inputs: ModelInputs }
  actualInputs: Partial<ModelInputs>
  onUpdateActuals: (actuals: Partial<ModelInputs>) => void
  onChangeScenario: () => void
}

interface FieldDef {
  key: keyof ModelInputs
  label: string
  section: string
  dollar?: boolean
  pct?: boolean
  unit?: string
  perUnit?: boolean   // stored per-unit, displayed per-unit
  step?: number
}

const FIELDS: FieldDef[] = [
  // Income
  { key: 'tu', label: 'Total Units', section: 'Income', step: 1 },
  { key: 'ou', label: 'Occupied Units', section: 'Income', step: 1 },
  { key: 'rent', label: 'Avg Rent / Unit / Mo', section: 'Income', dollar: true, step: 25 },
  { key: 'vp', label: 'Vacancy %', section: 'Income', pct: true, step: 0.5 },
  // Financing
  { key: 'price', label: 'Purchase Price', section: 'Financing', dollar: true, step: 10000 },
  { key: 'ir', label: 'Interest Rate', section: 'Financing', pct: true, step: 0.125 },
  { key: 'lev', label: 'LTV', section: 'Financing', pct: true, step: 1 },
  { key: 'am', label: 'Amortization', section: 'Financing', unit: 'years', step: 5 },
  { key: 'lf', label: 'Lender Fee', section: 'Financing', pct: true, step: 0.125 },
  { key: 'cc', label: 'Closing Costs', section: 'Financing', pct: true, step: 0.25 },
  // Expenses
  { key: 'tax', label: 'Real Estate Taxes', section: 'Expenses', dollar: true, unit: '/yr', step: 500 },
  { key: 'ins', label: 'Insurance', section: 'Expenses', dollar: true, unit: '/unit/yr', perUnit: true, step: 100 },
  { key: 'util', label: 'Total Utilities', section: 'Expenses', dollar: true, unit: '/yr', step: 500 },
  { key: 'rm', label: 'R&M', section: 'Expenses', dollar: true, unit: '/unit/yr', perUnit: true, step: 50 },
  { key: 'cs', label: 'Contract Services', section: 'Expenses', dollar: true, unit: '/yr', step: 100 },
  { key: 'ga', label: 'G&A', section: 'Expenses', dollar: true, unit: '/yr', step: 100 },
  { key: 'res', label: 'Reserves', section: 'Expenses', dollar: true, unit: '/unit/yr', perUnit: true, step: 50 },
  { key: 'pm', label: 'Prop Mgmt', section: 'Expenses', pct: true, unit: '% EGI', step: 0.5 },
  // Tax
  { key: 'brk', label: 'Tax Bracket', section: 'Tax Strategy', pct: true, step: 1 },
  { key: 'land', label: 'Land %', section: 'Tax Strategy', pct: true, step: 1 },
  { key: 'costSeg', label: 'Cost Seg %', section: 'Tax Strategy', pct: true, step: 1 },
]

const SECTIONS = ['Income', 'Financing', 'Expenses', 'Tax Strategy']

function fmtFieldVal(val: number | undefined, field: FieldDef): string {
  if (val === undefined || val === null) return '—'
  if (field.dollar) return fmtDollar(val)
  if (field.pct) return `${val}%`
  if (field.unit) return `${val} ${field.unit}`
  return String(val)
}

export function DealTermsSection({ dealScenario, actualInputs, onUpdateActuals, onChangeScenario }: Props) {
  const projected = dealScenario.inputs
  const [editing, setEditing] = useState(false)

  // Merge actuals over projected for calculation
  const effectiveInputs: ModelInputs = useMemo(() => ({
    ...projected,
    ...Object.fromEntries(
      Object.entries(actualInputs).filter(([_, v]) => v !== undefined && v !== null)
    ),
  }), [projected, actualInputs])

  const projectedCalc = useMemo(() => calculate(projected, !(projected.ou > 0 && projected.ou < projected.tu)), [projected])
  const actualCalc = useMemo(() => calculate(effectiveInputs, !(effectiveInputs.ou > 0 && effectiveInputs.ou < effectiveInputs.tu)), [effectiveInputs])

  const hasActuals = Object.keys(actualInputs).filter(k => (actualInputs as any)[k] !== undefined && (actualInputs as any)[k] !== null && (actualInputs as any)[k] !== '').length > 0

  const setActual = (key: keyof ModelInputs, val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val
    onUpdateActuals({ ...actualInputs, [key]: isNaN(num) ? undefined : num })
  }

  const clearActual = (key: keyof ModelInputs) => {
    const next = { ...actualInputs }
    delete (next as any)[key]
    onUpdateActuals(next)
  }

  const deltaColor = (projected: number, actual: number, higherIsBetter: boolean) => {
    if (actual === projected) return 'text-gray-400'
    const better = higherIsBetter ? actual > projected : actual < projected
    return better ? 'text-green-600' : 'text-red-600'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Deal Terms — {dealScenario.name}</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Projected from scenario · Enter actuals as quotes come in</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onChangeScenario}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={10} /> Change scenario
          </button>
        </div>
      </div>

      {/* Key metrics comparison */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'NOI', proj: projectedCalc.NOI, act: actualCalc.NOI, fmt: fmtDollar, better: true },
          { label: 'Cap Rate', proj: projectedCalc.cap, act: actualCalc.cap, fmt: fmtPct, better: true },
          { label: 'DCR', proj: projectedCalc.dcr, act: actualCalc.dcr, fmt: fmtX, better: true },
          { label: 'Cash-on-Cash', proj: projectedCalc.coc, act: actualCalc.coc, fmt: fmtPct, better: true },
        ].map(m => (
          <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-[10px] text-gray-500 mb-1">{m.label}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-gray-900">{m.fmt(hasActuals ? m.act : m.proj)}</span>
              {hasActuals && m.proj !== m.act && (
                <span className={`text-[10px] font-medium ${deltaColor(m.proj, m.act, m.better)}`}>
                  was {m.fmt(m.proj)}
                </span>
              )}
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5">{hasActuals ? 'with actuals' : 'projected'}</div>
          </div>
        ))}
      </div>

      {/* Projected vs Actual table by section */}
      {SECTIONS.map(section => {
        const sectionFields = FIELDS.filter(f => f.section === section)
        return (
          <div key={section} className="mb-4">
            <div className="bg-[#1a1a2e] px-4 py-2 rounded-t-lg">
              <h4 className="text-xs font-semibold text-white">{section}</h4>
            </div>
            <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2 font-semibold text-gray-600 w-1/4">Field</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600 w-1/4">Projected</th>
                    <th className="text-right px-4 py-2 font-semibold text-[#c9a84c] w-1/4">Actual</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600 w-1/4">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionFields.map((field, i) => {
                    const projVal = (projected as any)[field.key] as number ?? 0
                    const actVal = (actualInputs as any)[field.key]
                    const hasActual = actVal !== undefined && actVal !== null && actVal !== ''
                    const actNum = hasActual ? Number(actVal) : projVal
                    const delta = actNum - projVal
                    const isExpense = section === 'Expenses'

                    return (
                      <tr key={field.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-2 font-medium text-gray-800">
                          {field.label}
                          {field.unit && <span className="text-gray-400 font-normal ml-1">{field.unit}</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {fmtFieldVal(projVal, field)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={hasActual ? actVal : ''}
                              step={field.step}
                              placeholder="—"
                              onChange={e => setActual(field.key, e.target.value)}
                              className={`w-24 text-xs text-right border rounded px-2 py-1 focus:outline-none transition-colors
                                ${hasActual
                                  ? 'border-[#c9a84c] bg-amber-50 font-semibold text-gray-900 focus:border-[#c9a84c]'
                                  : 'border-transparent bg-transparent text-gray-400 hover:border-gray-200 focus:border-[#c9a84c]'}`}
                            />
                            {hasActual && (
                              <button onClick={() => clearActual(field.key)}
                                className="text-gray-300 hover:text-red-400 text-[10px] font-bold" title="Clear actual">
                                ×
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-2 text-right font-medium
                          ${!hasActual ? 'text-gray-300' :
                            delta === 0 ? 'text-gray-400' :
                            isExpense ? (delta > 0 ? 'text-red-600' : 'text-green-600') :
                            (delta > 0 ? 'text-green-600' : 'text-red-600')}`}>
                          {!hasActual ? '—' :
                            delta === 0 ? '—' :
                            field.dollar ? `${delta > 0 ? '+' : '-'}${fmtDollar(Math.abs(delta))}` :
                            field.pct ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}%` :
                            `${delta > 0 ? '+' : ''}${delta}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* P&L comparison */}
      {hasActuals && (
        <div className="mb-4">
          <div className="bg-[#1a1a2e] px-4 py-2 rounded-t-lg">
            <h4 className="text-xs font-semibold text-white">P&L Impact — Projected vs Actual</h4>
          </div>
          <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Line Item</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">Projected</th>
                  <th className="text-right px-4 py-2 font-semibold text-[#c9a84c]">Actual</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600">Delta</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Gross Scheduled Rent', p: projectedCalc.GSR, a: actualCalc.GSR, bold: false },
                  { label: 'Vacancy', p: -projectedCalc.vac, a: -actualCalc.vac, bold: false },
                  { label: 'Effective Gross Income', p: projectedCalc.EGI, a: actualCalc.EGI, bold: true },
                  { label: 'Total Expenses', p: -projectedCalc.exp, a: -actualCalc.exp, bold: false },
                  { label: 'NOI', p: projectedCalc.NOI, a: actualCalc.NOI, bold: true, highlight: true },
                  { label: 'Debt Service', p: -projectedCalc.ds, a: -actualCalc.ds, bold: false },
                  { label: 'Pre-Tax Cash Flow', p: projectedCalc.CF, a: actualCalc.CF, bold: true },
                  { label: 'Tax Savings', p: projectedCalc.ts, a: actualCalc.ts, bold: false },
                  { label: 'After-Tax Cash Flow', p: projectedCalc.at, a: actualCalc.at, bold: true },
                ].map((row, i) => {
                  const delta = row.a - row.p
                  return (
                    <tr key={i} className={row.highlight ? 'bg-green-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className={`px-4 py-2 ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.label}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{fmtNeg(row.p)}</td>
                      <td className={`px-4 py-2 text-right font-medium ${row.bold ? 'text-gray-900' : 'text-gray-700'}`}>{fmtNeg(row.a)}</td>
                      <td className={`px-4 py-2 text-right font-medium
                        ${delta === 0 ? 'text-gray-300' : delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(delta) < 1 ? '—' : `${delta > 0 ? '+' : '-'}${fmtDollar(Math.abs(delta))}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
