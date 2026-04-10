import { useState, useMemo } from 'react'
import { RefreshCw, Download, Lock, Unlock, Sparkles, X, Calendar } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { DealTermsPdf } from './DealTermsPdf'
import { calculate, calc1031, fmtDollar, fmtPct, fmtX, fmtNeg } from '../../lib/calc'
import type { ModelInputs } from '../../types'
import type { KeyDates } from '../../types/pipeline'
import { deriveKeyDatesFromPSA, EMPTY_KEY_DATES } from '../../types/pipeline'

interface Props {
  dealScenario: { name: string; inputs: ModelInputs }
  actualInputs: Partial<ModelInputs>
  onUpdateActuals: (actuals: Partial<ModelInputs>) => void
  onChangeScenario: () => void
  propertyName: string
  propertyAddress: string | null
  keyDates?: KeyDates
  onUpdateKeyDates?: (dates: KeyDates) => void
  psaExtractedTerms?: Record<string, any> | null
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
  tip?: string
}

const FIELDS: FieldDef[] = [
  // Income
  { key: 'tu', label: 'Total Units', section: 'Income', step: 1, tip: 'Total number of rentable units in the property, including vacant ones' },
  { key: 'ou', label: 'Occupied Units', section: 'Income', step: 1, tip: 'Number of units currently leased and generating rent. When less than total units, the model uses physical vacancy instead of gross vacancy percentage' },
  { key: 'rent', label: 'Avg Rent / Unit / Mo', section: 'Income', dollar: true, step: 25, tip: 'Average monthly rent per unit. Multiplied by total units × 12 to calculate Gross Scheduled Rent. If using a rent roll, this is overridden by individual unit rents' },
  { key: 'vp', label: 'Vacancy %', section: 'Income', pct: true, step: 0.5, tip: 'Percentage of income lost to vacancy and collection loss. In gross vacancy mode, applied to scheduled rent. In physical vacancy mode, represents additional turnover buffer on top of actual empty units' },
  // Financing
  { key: 'price', label: 'Purchase Price', section: 'Financing', dollar: true, step: 10000, tip: 'Total acquisition price. Used to calculate loan amount (price × LTV), cap rate (NOI ÷ price), and depreciable basis for tax benefits' },
  { key: 'ir', label: 'Interest Rate', section: 'Financing', pct: true, step: 0.125, tip: 'Annual interest rate on the mortgage. Combined with LTV and amortization to determine monthly debt service payment' },
  { key: 'lev', label: 'LTV', section: 'Financing', pct: true, step: 1, tip: 'Loan-to-Value ratio — the percentage of the purchase price financed by the lender. 75% LTV on a $2M property = $1.5M loan, $500K down payment' },
  { key: 'am', label: 'Amortization', section: 'Financing', unit: 'years', step: 5, tip: 'Number of years over which the loan is amortized. Longer amortization = lower monthly payments but more total interest paid. Common: 25 or 30 years for multifamily' },
  { key: 'lf', label: 'Lender Fee', section: 'Financing', pct: true, step: 0.125, tip: 'Origination fee charged by the lender, expressed as a percentage of the loan amount. Typically 0.5%–1.5%. Added to your cash needed at closing' },
  { key: 'cc', label: 'Closing Costs', section: 'Financing', pct: true, step: 0.25, tip: 'Total closing costs as a percentage of purchase price — title insurance, attorney fees, appraisal, survey, environmental, etc. Typically 1%–3%' },
  // Expenses
  { key: 'tax', label: 'Real Estate Taxes', section: 'Expenses', dollar: true, unit: '/yr', step: 500, tip: 'Annual property tax bill. After acquisition, expect reassessment to ~2% of purchase price in most Texas counties. Check the Flags tab for reassessment warnings' },
  { key: 'ins', label: 'Insurance', section: 'Expenses', dollar: true, unit: '/unit/yr', perUnit: true, step: 100, tip: 'Property insurance cost per unit per year. Older buildings cost more — benchmark: $2,000/unit (<40yr), $2,500 (40-60yr), $3,000 (60yr+). Stored per-unit, multiplied by total units for annual total' },
  { key: 'util', label: 'Total Utilities', section: 'Expenses', dollar: true, unit: '/yr', step: 500, tip: 'Annual landlord-paid utility expense (electric + water + trash). If tenants pay directly (sub-metered), those components drop to zero or near-zero' },
  { key: 'rm', label: 'R&M', section: 'Expenses', dollar: true, unit: '/unit/yr', perUnit: true, step: 50, tip: 'Repairs & Maintenance per unit per year — routine fixes, appliance repairs, turnover costs. Benchmark: $500/unit (<40yr), $700 (40-60yr), $900 (60yr+)' },
  { key: 'cs', label: 'Contract Services', section: 'Expenses', dollar: true, unit: '/yr', step: 100, tip: 'Annual cost for ongoing service contracts — landscaping, pest control, HVAC maintenance, elevator service, pool maintenance, etc.' },
  { key: 'ga', label: 'G&A', section: 'Expenses', dollar: true, unit: '/yr', step: 100, tip: 'General & Administrative — office supplies, software, accounting, legal, advertising, tenant screening, bank fees, and other overhead not covered by other categories' },
  { key: 'res', label: 'Reserves', section: 'Expenses', dollar: true, unit: '/unit/yr', perUnit: true, step: 50, tip: 'Capital replacement reserves per unit per year — money set aside for future big-ticket items (roof, HVAC, parking lot). Benchmark: $350/unit (<40yr), $500 (40-60yr), $700 (60yr+)' },
  { key: 'pm', label: 'Prop Mgmt', section: 'Expenses', pct: true, unit: '% EGI', step: 0.5, tip: 'Property management fee as a percentage of Effective Gross Income, or a flat $/unit/month. Typically 5%–10% of EGI for third-party management. Self-managed properties still budget 5%+ for the time invested' },
  { key: 'capx', label: 'Cap X', section: 'Expenses', dollar: true, unit: '/yr', step: 1000, tip: 'Capital expenditures — large one-time improvements like a new roof, HVAC replacement, plumbing overhaul, or unit renovations. Not a recurring operating expense. Tracked at the deal level, not in the underwriting model' },
  // Tax
  { key: 'brk', label: 'Tax Bracket', section: 'Tax Strategy', pct: true, step: 1, tip: 'Your marginal federal income tax rate. Determines how much each dollar of depreciation saves you. Example: 37% bracket means $100K of paper losses saves $37K in taxes. Include state tax if applicable' },
  { key: 'land', label: 'Land %', section: 'Tax Strategy', pct: true, step: 1, tip: 'Percentage of purchase price allocated to land (non-depreciable). The IRS requires separating land from improvements because you can only depreciate the building, not the dirt. Typically 15%–25% based on county appraiser records' },
  { key: 'costSeg', label: 'Cost Seg %', section: 'Tax Strategy', pct: true, step: 1, tip: 'Percentage of the depreciable basis allocated to short-life components (5, 7, and 15-year property) via a cost segregation study. These components qualify for 100% bonus depreciation in Year 1, creating a massive paper loss. Typical range: 20%–35% of building value. Requires a professional cost seg study ($5K–$15K)' },
]

const SECTIONS = ['Income', 'Financing', 'Expenses', 'Tax Strategy']

function ActualInput({ value, field, onChange, onClear, hasActual }: {
  value: string | number; field: FieldDef; onChange: (v: string) => void; onClear: () => void; hasActual: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        step={field.step}
        value={hasActual ? value : ''}
        placeholder="—"
        onChange={e => onChange(e.target.value)}
        onFocus={e => setTimeout(() => e.target.select(), 0)}
        className={`w-28 text-xs text-right border rounded px-2 py-1 focus:outline-none transition-colors
          ${hasActual
            ? 'border-[#c9a84c] bg-amber-50 font-semibold text-gray-900 focus:border-[#c9a84c]'
            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 focus:border-[#c9a84c]'}`}
      />
      {hasActual && (
        <button onClick={onClear}
          className="text-gray-300 hover:text-red-400 text-[10px] font-bold" title="Clear actual">
          ×
        </button>
      )}
    </div>
  )
}

function fmtFieldVal(val: number | undefined, field: FieldDef): string {
  if (val === undefined || val === null) return '—'
  if (field.dollar) return fmtDollar(val)
  if (field.pct) return `${val}%`
  if (field.unit) return `${val} ${field.unit}`
  return String(val)
}

export function DealTermsSection({ dealScenario, actualInputs, onUpdateActuals, onChangeScenario, propertyName, propertyAddress, keyDates: keyDatesProp, onUpdateKeyDates, psaExtractedTerms }: Props) {
  const keyDates = keyDatesProp ?? EMPTY_KEY_DATES
  const projected = dealScenario.inputs
  const [generating, setGenerating] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [rentGrowth, setRentGrowth] = useState(() => (actualInputs as any)._rentGrowth ?? 2)
  const [expGrowth, setExpGrowth] = useState(() => (actualInputs as any)._expGrowth ?? 3)

  const updateRentGrowth = (val: number) => {
    setRentGrowth(val)
    onUpdateActuals({ ...actualInputs, _rentGrowth: val })
  }
  const updateExpGrowth = (val: number) => {
    setExpGrowth(val)
    onUpdateActuals({ ...actualInputs, _expGrowth: val })
  }

  // Merge actuals over projected for calculation
  const effectiveInputs: ModelInputs = useMemo(() => ({
    ...projected,
    ...Object.fromEntries(
      Object.entries(actualInputs).filter(([_, v]) => v !== undefined && v !== null)
    ),
  }), [projected, actualInputs])

  const projectedCalc = useMemo(() => calculate(projected, !(projected.ou > 0 && projected.ou < projected.tu)), [projected])
  const actualCalc = useMemo(() => calculate(effectiveInputs, !(effectiveInputs.ou > 0 && effectiveInputs.ou < effectiveInputs.tu)), [effectiveInputs])

  // 5-year projection: scale Year 1 actuals (or projected) by growth rates
  const yearCalcs = useMemo(() => {
    const baseInputs = effectiveInputs
    const useOM = !(baseInputs.ou > 0 && baseInputs.ou < baseInputs.tu)
    return [2, 3, 4, 5].map(year => {
      const rg = Math.pow(1 + rentGrowth / 100, year - 1)
      const eg = Math.pow(1 + expGrowth / 100, year - 1)
      const scaled: ModelInputs = {
        ...baseInputs,
        // Scale income
        rent: baseInputs.rent * rg,
        rentRoll: baseInputs.rentRoll?.map(u => ({ ...u, rent: (u.rent || 0) * rg })),
        otherIncome: baseInputs.otherIncome?.map(x => ({ ...x, amount: (x.amount || 0) * rg })),
        // Scale expenses
        tax: baseInputs.tax * eg,
        ins: baseInputs.ins * eg,
        rm: baseInputs.rm * eg,
        res: baseInputs.res * eg,
        cs: baseInputs.cs * eg,
        ga: baseInputs.ga * eg,
        util: baseInputs.util * eg,
        utilElec: baseInputs.utilElec * eg,
        utilWater: baseInputs.utilWater * eg,
        utilTrash: baseInputs.utilTrash * eg,
        pmPerUnit: baseInputs.pmPerUnit * eg,
        otherExpenses: baseInputs.otherExpenses?.map(x => ({ ...x, amount: (x.amount || 0) * eg })),
        // Years 2+: no bonus depreciation (one-time Y1 event), full-year SL only
        costSeg: 0,
        closingDate: undefined,
      }
      return calculate(scaled, useOM)
    })
  }, [effectiveInputs, rentGrowth, expGrowth])

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
        <div className="flex items-center gap-3">
          <button onClick={() => setUnlocked(!unlocked)}
            className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors
              ${unlocked ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {unlocked ? <><Unlock size={10} /> Editing Actuals</> : <><Lock size={10} /> Locked</>}
          </button>
          <button onClick={onChangeScenario}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={10} /> Change scenario
          </button>
          <button
            onClick={async () => {
              setGenerating(true)
              try {
                const blob = await pdf(
                  <DealTermsPdf projected={projected} actualInputs={actualInputs} scenarioName={dealScenario.name}
                    propertyName={propertyName} propertyAddress={propertyAddress} keyDates={keyDates} />
                ).toBlob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${(propertyName || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_Deal_Terms.pdf`
                a.click()
                URL.revokeObjectURL(url)
              } finally { setGenerating(false) }
            }}
            disabled={generating}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-50">
            {generating ? 'Generating...' : <><Download size={12} /> PDF</>}
          </button>
        </div>
      </div>

      {/* Key Dates */}
      {onUpdateKeyDates && (() => {
        const DATE_FIELDS: { key: keyof KeyDates; label: string }[] = [
          { key: 'effectiveDate', label: 'Effective Date' },
          { key: 'earnestMoneyDueDate', label: 'Earnest Money Due' },
          { key: 'ddEndDate', label: 'DD Period Ends' },
          { key: 'financingDeadlineDate', label: 'Financing Deadline' },
          { key: 'closingDate', label: 'Closing Date' },
        ]

        const daysUntil = (dateStr: string | null): number | null => {
          if (!dateStr) return null
          const diff = new Date(dateStr + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)
          return Math.ceil(diff / 86400000)
        }

        const countdownBadge = (dateStr: string | null) => {
          const days = daysUntil(dateStr)
          if (days === null) return null
          if (days < 0) return <span className="text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{Math.abs(days)}d overdue</span>
          if (days === 0) return <span className="text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Today</span>
          if (days <= 7) return <span className="text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{days}d</span>
          if (days <= 14) return <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{days}d</span>
          return <span className="text-[9px] font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">{days}d</span>
        }

        const fmtDate = (dateStr: string | null) => {
          if (!dateStr) return '—'
          return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }

        const updateDate = (key: keyof KeyDates, val: string) => {
          onUpdateKeyDates({ ...keyDates, [key]: val || null })
        }

        const clearDate = (key: keyof KeyDates) => {
          onUpdateKeyDates({ ...keyDates, [key]: null })
        }

        const populateFromPSA = () => {
          if (!psaExtractedTerms) return
          const derived = deriveKeyDatesFromPSA(psaExtractedTerms)
          // Only fill nulls — don't overwrite manual entries
          const merged = { ...keyDates }
          for (const [k, v] of Object.entries(derived)) {
            if (v && !(merged as any)[k]) (merged as any)[k] = v
          }
          onUpdateKeyDates(merged)
        }

        const hasAnyDate = DATE_FIELDS.some(f => keyDates[f.key])

        return (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-5">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a1a2e]">
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-white" />
                <h3 className="text-xs font-semibold text-white">Key Dates</h3>
              </div>
              {psaExtractedTerms && (
                <button onClick={populateFromPSA}
                  className="flex items-center gap-1 text-[10px] font-medium text-[#c9a84c] hover:text-amber-300 transition-colors">
                  <Sparkles size={10} /> Populate from PSA
                </button>
              )}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 w-48">Deadline</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Date</th>
                  <th className="text-right px-4 py-2 font-semibold text-gray-600 w-24">Status</th>
                  {unlocked && <th className="w-8"></th>}
                </tr>
              </thead>
              <tbody>
                {DATE_FIELDS.map((f, i) => {
                  const val = keyDates[f.key]
                  return (
                    <tr key={f.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{f.label}</td>
                      <td className="px-4 py-2.5">
                        {unlocked ? (
                          <input
                            type="date"
                            value={val ?? ''}
                            onChange={e => updateDate(f.key, e.target.value)}
                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white w-44"
                          />
                        ) : (
                          <span className={val ? 'text-gray-900' : 'text-gray-300'}>{fmtDate(val)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">{countdownBadge(val)}</td>
                      {unlocked && (
                        <td className="px-2 py-2.5">
                          {val && (
                            <button onClick={() => clearDate(f.key)} className="text-gray-300 hover:text-red-400" title="Clear">
                              <X size={12} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!hasAnyDate && !unlocked && (
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] text-gray-400">No dates set yet — unlock to enter manually{psaExtractedTerms ? ' or populate from PSA' : ''}</p>
              </div>
            )}
          </div>
        )
      })()}

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
                        <td className="px-4 py-2 font-medium text-gray-800" title={field.tip}>
                          {field.label}
                          {field.unit && <span className="text-gray-400 font-normal ml-1">{field.unit}</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {fmtFieldVal(projVal, field)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {unlocked ? (
                            <ActualInput
                              value={hasActual ? actVal : ''}
                              field={field}
                              onChange={v => setActual(field.key, v)}
                              onClear={() => clearActual(field.key)}
                              hasActual={hasActual}
                            />
                          ) : (
                            <span className={`text-xs ${hasActual ? 'font-semibold text-gray-900' : 'text-gray-300'}`}>
                              {hasActual ? fmtFieldVal(actNum, field) : '—'}
                            </span>
                          )}
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

      {/* P&L comparison with 5-year projection */}
      {hasActuals && (
        <div className="mb-4">
          <div className="bg-[#1a1a2e] px-4 py-2 rounded-t-lg flex items-center justify-between">
            <h4 className="text-xs font-semibold text-white">P&L Impact — Projected vs Actual + 5-Year Hold</h4>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[10px] text-gray-300">
                Rent Growth
                <input type="number" step={0.5} value={rentGrowth}
                  onChange={e => updateRentGrowth(parseFloat(e.target.value) || 0)}
                  className="w-14 text-[10px] text-right bg-white/10 border border-white/20 text-white rounded px-1.5 py-0.5 focus:outline-none focus:border-[#c9a84c]" />
                <span className="text-gray-400">%</span>
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-gray-300">
                Exp Escalation
                <input type="number" step={0.5} value={expGrowth}
                  onChange={e => updateExpGrowth(parseFloat(e.target.value) || 0)}
                  className="w-14 text-[10px] text-right bg-white/10 border border-white/20 text-white rounded px-1.5 py-0.5 focus:outline-none focus:border-[#c9a84c]" />
                <span className="text-gray-400">%</span>
              </label>
            </div>
          </div>
          <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg overflow-x-auto pb-1">
            <table className="w-full text-xs" style={{ minWidth: 780 }}>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-semibold text-gray-600 whitespace-nowrap">Line Item</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Projected</th>
                  <th className="text-right px-3 py-2 font-semibold text-[#c9a84c] whitespace-nowrap">Year 1</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Delta</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500 whitespace-nowrap border-l border-gray-200">Year 2</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">Year 3</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">Year 4</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">Year 5</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const capxAmt = Number(effectiveInputs.capx) || 0
                  const capxProj = Number(projected.capx) || 0
                  const ex1031 = effectiveInputs.is1031 ? calc1031(effectiveInputs) : null
                  // Tax deferred: use full calc if prior sale data exists, otherwise estimate from deferred gain
                  const deferredGain = effectiveInputs.deferredGain1031 ?? 0
                  const cgRate = (effectiveInputs.cgRate ?? 20) / 100
                  const taxDeferred = ex1031?.totalTaxDeferred
                    ?? (effectiveInputs.is1031 && deferredGain > 0 ? deferredGain * cgRate : 0)
                  const rows: { label: string; tip: string; p: number; a: number; yVals: number[]; bold: boolean; highlight?: boolean; highlight1031?: boolean }[] = [
                    { label: 'Gross Scheduled Rent', tip: 'Total rent if every unit were occupied at current market rent, before any vacancy deduction', p: projectedCalc.GSR, a: actualCalc.GSR, yVals: yearCalcs.map(yc => yc.GSR), bold: false },
                    { label: 'Vacancy', tip: 'Lost rent from unoccupied units and collection loss. Physical vacancy uses actual empty units; gross vacancy uses a percentage of scheduled rent', p: -projectedCalc.vac, a: -actualCalc.vac, yVals: yearCalcs.map(yc => -yc.vac), bold: false },
                    { label: 'Effective Gross Income', tip: 'Actual collected rent after vacancy, plus other income (laundry, parking, fees). This is the real top-line revenue the property generates', p: projectedCalc.EGI, a: actualCalc.EGI, yVals: yearCalcs.map(yc => yc.EGI), bold: true },
                    { label: 'Total Expenses', tip: 'All operating expenses: taxes, insurance, utilities, R&M, contract services, G&A, reserves, and property management. Scaled by the expense escalation rate for future years', p: -projectedCalc.exp, a: -actualCalc.exp, yVals: yearCalcs.map(yc => -yc.exp), bold: false },
                    { label: 'NOI', tip: 'Net Operating Income = EGI minus expenses. The key metric for property valuation (price ÷ NOI = cap rate). Does not include debt service or taxes', p: projectedCalc.NOI, a: actualCalc.NOI, yVals: yearCalcs.map(yc => yc.NOI), bold: true, highlight: true },
                    { label: 'Debt Service', tip: 'Annual mortgage payments (principal + interest). Fixed for the life of the loan based on your interest rate, LTV, and amortization period', p: -projectedCalc.ds, a: -actualCalc.ds, yVals: yearCalcs.map(yc => -yc.ds), bold: false },
                    ...(capxAmt > 0 || capxProj > 0 ? [
                      { label: 'Cap X', tip: 'Capital expenditures — large one-time improvements like roof, HVAC, plumbing, or unit renovations. Not a recurring operating expense. Year 1 only in this projection', p: -capxProj, a: -capxAmt, yVals: [0, 0, 0, 0], bold: false },
                    ] : []),
                    { label: 'Pre-Tax Cash Flow', tip: 'Cash in your pocket before tax benefits. NOI minus debt service minus Cap X. This is the actual cash the property distributes to you each year', p: projectedCalc.CF - capxProj, a: actualCalc.CF - capxAmt, yVals: yearCalcs.map(yc => yc.CF), bold: true },
                    { label: 'Tax Savings', tip: 'Income tax saved through depreciation deductions. Year 1 includes bonus depreciation (cost seg allocation taken 100% upfront). Years 2+ show only straight-line depreciation over 27.5 years', p: projectedCalc.ts, a: actualCalc.ts, yVals: yearCalcs.map(yc => yc.ts), bold: false },
                    { label: 'After-Tax Cash Flow', tip: 'Pre-tax cash flow plus tax savings from depreciation. This is your true annual return — the real money you keep after all expenses, debt, and tax benefits', p: projectedCalc.at - capxProj, a: actualCalc.at - capxAmt, yVals: yearCalcs.map(yc => yc.at), bold: true },
                    ...(taxDeferred > 0 ? [
                      { label: '1031 Tax Deferred', tip: `One-time tax savings from a 1031 exchange — realized at closing, not annual income. When you sell investment property, you normally owe two taxes: (1) Capital gains tax (${(cgRate * 100).toFixed(1)}%) on the profit above your adjusted basis, and (2) Depreciation recapture tax (25%) on all depreciation you claimed on the prior property. A 1031 exchange defers BOTH taxes by rolling proceeds into a replacement property within 180 days. The tradeoff: your depreciable basis on the new property is reduced by the deferred gain ($${fmtDollar(deferredGain).replace('$','')}), which means smaller annual depreciation deductions going forward. This number${ex1031 ? ' includes both capital gains and recapture tax' : ' reflects capital gains tax only — fill in Prior Sale Price and Depreciation Taken in the Tax tab to include recapture tax (25% on depreciation claimed), which would increase this amount'}. The deferred tax is not forgiven — it's due if you eventually sell without another 1031, but many investors use serial 1031s or hold until death (stepped-up basis eliminates the deferred gain entirely).`, p: taxDeferred, a: taxDeferred, yVals: [0, 0, 0, 0], bold: false, highlight1031: true, y1Only: true },
                      { label: 'Total Year 1 Benefit', tip: 'The complete economic benefit in Year 1: after-tax cash flow from operations plus the one-time tax savings from the 1031 exchange. This is the total value the deal delivers in its first year — ongoing cash returns plus the tax you kept by not selling outright', p: (projectedCalc.at - capxProj) + taxDeferred, a: (actualCalc.at - capxAmt) + taxDeferred, yVals: [0, 0, 0, 0], bold: true, highlight1031: true, y1Only: true },
                    ] : []),
                  ]
                  // Cumulative running totals: Y1 after-tax (+ 1031 if applicable) + each subsequent year
                  const y1Total = (actualCalc.at - capxAmt) + taxDeferred
                  const cumulative = yearCalcs.map((yc, yi) => {
                    let total = y1Total
                    for (let j = 0; j <= yi; j++) total += yearCalcs[j].at
                    return total
                  })

                  return (<>
                    {rows.map((row, i) => {
                      const delta = row.a - row.p
                      const isY1Only = (row as any).y1Only
                      return (
                        <tr key={i} className={(row as any).highlight1031 ? 'bg-amber-50 border-t border-amber-200' : row.highlight ? 'bg-green-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className={`px-4 py-2 whitespace-nowrap ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`} title={row.tip}>{row.label}</td>
                          <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">{fmtNeg(row.p)}</td>
                          <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${row.bold ? 'text-gray-900' : 'text-gray-700'}`}>{fmtNeg(row.a)}</td>
                          <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-gray-300">
                            {isY1Only ? '' : Math.abs(delta) < 1 ? '—' : <span className={delta > 0 ? 'text-green-600' : 'text-red-600'}>{`${delta > 0 ? '+' : '-'}${fmtDollar(Math.abs(delta))}`}</span>}
                          </td>
                          {row.yVals.map((val, yi) => (
                            <td key={yi} className={`px-3 py-2 text-right whitespace-nowrap ${yi === 0 ? 'border-l border-gray-200' : ''}`}>
                              {isY1Only ? '' : <span className={row.bold ? 'font-medium text-gray-800' : 'text-gray-500'}>{fmtNeg(val)}</span>}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                    <tr className="bg-[#1a1a2e]">
                      <td className="px-4 py-2 whitespace-nowrap font-semibold text-white text-xs" title="Running cumulative total: Year 1 after-tax cash flow (including 1031 tax deferred if applicable) plus each subsequent year's after-tax cash flow">Cumulative</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right font-semibold text-white whitespace-nowrap">{fmtDollar(y1Total)}</td>
                      <td className="px-3 py-2"></td>
                      {cumulative.map((val, yi) => (
                        <td key={yi} className={`px-3 py-2 text-right font-semibold text-white whitespace-nowrap ${yi === 0 ? 'border-l border-gray-600' : ''}`}>
                          {fmtDollar(val)}
                        </td>
                      ))}
                    </tr>
                  </>)
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
