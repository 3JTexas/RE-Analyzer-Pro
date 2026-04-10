import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { calculate, calc1031, fmtDollar, fmtPct, fmtX, fmtNeg } from '../../lib/calc'
import type { ModelInputs } from '../../types'
import type { KeyDates } from '../../types/pipeline'

const C = { text: '#1a1a2e', gray: '#666', muted: '#888', accent: '#c9a84c', green: '#1D6B3E', red: '#A32D2D', border: '#E5E3DC', amber: '#92700C' }

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: C.text, padding: '0.6in' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 2 },
  subtitle: { fontSize: 10, color: C.gray, marginBottom: 12 },
  orangeLine: { height: 2, backgroundColor: C.accent, marginBottom: 14 },
  metricsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  metricCard: { flex: 1, backgroundColor: '#F8F8F8', borderRadius: 4, padding: '6 8', borderWidth: 0.5, borderColor: '#E0E0E0' },
  metricLabel: { fontSize: 7, color: C.muted, marginBottom: 2 },
  metricValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  metricSub: { fontSize: 7, color: C.muted, marginTop: 1 },
  sectionHdr: { backgroundColor: C.text, padding: '5 8', marginTop: 10, marginBottom: 0 },
  sectionHdrText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: 'white' },
  tableHdr: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderBottomWidth: 0.5, borderBottomColor: C.border, padding: '4 8' },
  tableHdrText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.text },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: C.border, padding: '4 8' },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: C.border, padding: '4 8', backgroundColor: '#FAFAF8' },
  disclaimer: { fontSize: 7, color: C.muted, marginTop: 12, lineHeight: 1.5, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
})

const fmtD = (v: number) => `$${Math.round(v).toLocaleString()}`
const fmtFieldVal = (v: number, dollar?: boolean, pct?: boolean, unit?: string) =>
  dollar ? fmtD(v) : pct ? `${v}%` : unit ? `${v} ${unit}` : String(v)

interface FieldDef {
  key: string; label: string; dollar?: boolean; pct?: boolean; unit?: string; section: string; perUnit?: boolean; isRent?: boolean
}

const FIELDS: FieldDef[] = [
  { key: 'tu', label: 'Total Units', section: 'Income' },
  { key: 'ou', label: 'Occupied Units', section: 'Income' },
  { key: 'rent', label: 'Avg Rent / Unit / Mo', section: 'Income', dollar: true, isRent: true },
  { key: 'vp', label: 'Vacancy %', section: 'Income', pct: true },
  { key: 'price', label: 'Purchase Price', section: 'Financing', dollar: true },
  { key: 'ir', label: 'Interest Rate', section: 'Financing', pct: true },
  { key: 'lev', label: 'LTV', section: 'Financing', pct: true },
  { key: 'am', label: 'Amortization', section: 'Financing', unit: 'years' },
  { key: 'lf', label: 'Lender Fee', section: 'Financing', pct: true },
  { key: 'cc', label: 'Closing Costs', section: 'Financing', pct: true },
  { key: 'tax', label: 'Real Estate Taxes', section: 'Expenses', dollar: true },
  { key: 'ins', label: 'Insurance', section: 'Expenses', dollar: true, unit: '/unit/yr', perUnit: true },
  { key: 'util', label: 'Total Utilities', section: 'Expenses', dollar: true },
  { key: 'rm', label: 'R&M', section: 'Expenses', dollar: true, unit: '/unit/yr', perUnit: true },
  { key: 'cs', label: 'Contract Services', section: 'Expenses', dollar: true },
  { key: 'ga', label: 'G&A', section: 'Expenses', dollar: true },
  { key: 'res', label: 'Reserves', section: 'Expenses', dollar: true, unit: '/unit/yr', perUnit: true },
  { key: 'pm', label: 'Prop Mgmt', section: 'Expenses', pct: true },
  { key: 'capx', label: 'Cap X', section: 'Expenses', dollar: true },
]

const SECTIONS = ['Income', 'Financing', 'Expenses']

// Glossary definitions for the P&L line items
const GLOSSARY: { term: string; definition: string }[] = [
  { term: 'Gross Scheduled Rent', definition: 'Total rent if every unit were occupied at current market rent, before any vacancy deduction.' },
  { term: 'Vacancy', definition: 'Lost rent from unoccupied units and collection loss.' },
  { term: 'Effective Gross Income', definition: 'Collected rent after vacancy plus other income (laundry, parking, fees).' },
  { term: 'Total Expenses', definition: 'All operating expenses: taxes, insurance, utilities, R&M, contract services, G&A, reserves, and property management.' },
  { term: 'NOI', definition: 'Net Operating Income = EGI minus expenses. Key metric for valuation (price / NOI = cap rate). Excludes debt service and taxes.' },
  { term: 'Debt Service', definition: 'Annual mortgage payments (principal + interest). Fixed for the life of the loan.' },
  { term: 'Cap X', definition: 'Capital expenditures — large one-time improvements (roof, HVAC, plumbing). Year 1 only.' },
  { term: 'Pre-Tax Cash Flow', definition: 'NOI minus debt service minus Cap X. The actual cash the property distributes before tax benefits.' },
  { term: 'Tax Savings', definition: 'Income tax saved via depreciation. Year 1 includes bonus depreciation (cost seg). Years 2+ are straight-line only over 27.5 years.' },
  { term: 'After-Tax Cash Flow', definition: 'Pre-tax cash flow plus tax savings. Your true annual return after all expenses, debt, and tax benefits.' },
  { term: '1031 Tax Deferred', definition: 'Capital gains + recapture tax avoided via 1031 exchange. One-time at closing. Deferred, not forgiven — eliminated at death via stepped-up basis.' },
  { term: 'Total Year 1 Benefit', definition: 'After-tax cash flow plus 1031 tax deferred. The complete economic value the deal delivers in Year 1.' },
  { term: 'Rent Growth', definition: 'Annual percentage increase applied to all income (rent, other income) for projection years 2-5.' },
  { term: 'Expense Escalation', definition: 'Annual percentage increase applied to all operating expenses for projection years 2-5. Debt service is not escalated.' },
]

interface Props {
  projected: ModelInputs
  actualInputs: Partial<ModelInputs>
  scenarioName: string
  propertyName: string
  propertyAddress: string | null
  keyDates?: KeyDates
  mode?: 'full' | 'projected' | 'actual'  // full = both columns, projected = projected only, actual = actuals only
}

export function DealTermsPdf({ projected, actualInputs, scenarioName, propertyName, propertyAddress, keyDates, mode = 'full' }: Props) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const logoSrc = `${import.meta.env.BASE_URL}Chai_Logo.jpeg`

  const effective: ModelInputs = { ...projected, ...Object.fromEntries(Object.entries(actualInputs).filter(([_, v]) => v !== undefined && v !== null)) }
  const projCalc = calculate(projected, !(projected.ou > 0 && projected.ou < projected.tu))
  const actCalc = calculate(effective, !(effective.ou > 0 && effective.ou < effective.tu))
  const hasActuals = Object.keys(actualInputs).filter(k => (actualInputs as any)[k] !== undefined && (actualInputs as any)[k] !== null).length > 0

  // Growth rates (persisted in actualInputs)
  const rentGrowth = (actualInputs as any)._rentGrowth ?? 2
  const expGrowth = (actualInputs as any)._expGrowth ?? 3

  // 5-year projection
  const useOM = !(effective.ou > 0 && effective.ou < effective.tu)
  const yearCalcs = [2, 3, 4, 5].map(year => {
    const rg = Math.pow(1 + rentGrowth / 100, year - 1)
    const eg = Math.pow(1 + expGrowth / 100, year - 1)
    const scaled: ModelInputs = {
      ...effective,
      rent: effective.rent * rg,
      rentRoll: effective.rentRoll?.map(u => ({ ...u, rent: (u.rent || 0) * rg })),
      otherIncome: effective.otherIncome?.map(x => ({ ...x, amount: (x.amount || 0) * rg })),
      tax: effective.tax * eg, ins: effective.ins * eg, rm: effective.rm * eg, res: effective.res * eg,
      cs: effective.cs * eg, ga: effective.ga * eg, util: effective.util * eg,
      utilElec: effective.utilElec * eg, utilWater: effective.utilWater * eg, utilTrash: effective.utilTrash * eg,
      pmPerUnit: effective.pmPerUnit * eg,
      otherExpenses: effective.otherExpenses?.map(x => ({ ...x, amount: (x.amount || 0) * eg })),
      costSeg: 0, closingDate: undefined,
    }
    return calculate(scaled, useOM)
  })

  // Cap X and 1031
  const capxAmt = Number(effective.capx) || 0
  const capxProj = Number(projected.capx) || 0
  const ex1031 = effective.is1031 ? calc1031(effective) : null
  const deferredGain = effective.deferredGain1031 ?? 0
  const cgRate = (effective.cgRate ?? 20) / 100
  const taxDeferred = ex1031?.totalTaxDeferred ?? (effective.is1031 && deferredGain > 0 ? deferredGain * cgRate : 0)

  return (
    <Document title={`Deal Terms — ${propertyName}`}>
      <Page size="LETTER" style={s.page}>
        <Image src={logoSrc} style={{ width: 120, marginBottom: 10 }} />
        <Text style={s.title}>Deal Terms{mode === 'projected' ? ' (Projected)' : mode === 'actual' ? ' (Actual)' : ''} — {propertyName}</Text>
        <Text style={s.subtitle}>{propertyAddress ? `${propertyAddress} · ` : ''}{scenarioName} · {date}</Text>
        <View style={s.orangeLine} />

        {/* Key Dates */}
        {keyDates && Object.values(keyDates).some(v => v) && (() => {
          const fmtDt = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
          const dateFields: { label: string; value: string | null }[] = [
            { label: 'Effective Date', value: keyDates.effectiveDate },
            { label: 'Earnest Money Due', value: keyDates.earnestMoneyDueDate },
            { label: 'DD Period Ends', value: keyDates.ddEndDate },
            { label: 'Financing Deadline', value: keyDates.financingDeadlineDate },
            { label: 'Closing Date', value: keyDates.closingDate },
          ].filter(f => f.value)
          return (
            <View style={{ marginBottom: 12 }}>
              <View style={s.sectionHdr}>
                <Text style={s.sectionHdrText}>KEY DATES</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {dateFields.map((f, i) => (
                  <View key={i} style={{ width: '33.33%', padding: '5 8', borderBottomWidth: 0.3, borderBottomColor: C.border, backgroundColor: i % 2 === 0 ? 'white' : '#FAFAF8' }}>
                    <Text style={{ fontSize: 7, color: C.muted, marginBottom: 1 }}>{f.label}</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text }}>{fmtDt(f.value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )
        })()}

        {/* Key metrics */}
        <View style={s.metricsRow}>
          {[
            { label: 'NOI', proj: projCalc.NOI, act: actCalc.NOI, fmt: fmtDollar },
            { label: 'Cap Rate', proj: projCalc.cap, act: actCalc.cap, fmt: fmtPct },
            { label: 'DCR', proj: projCalc.dcr, act: actCalc.dcr, fmt: fmtX },
            { label: 'Cash-on-Cash', proj: projCalc.coc, act: actCalc.coc, fmt: fmtPct },
          ].map(m => {
            const val = mode === 'projected' ? m.proj : (hasActuals ? m.act : m.proj)
            const showDelta = mode === 'full' && hasActuals && Math.abs(m.act - m.proj) > 0.01
            return (
              <View key={m.label} style={s.metricCard}>
                <Text style={s.metricLabel}>{m.label}</Text>
                <Text style={s.metricValue}>{m.fmt(val)}</Text>
                {showDelta && (
                  <Text style={[s.metricSub, { color: m.act > m.proj ? C.green : C.red }]}>was {m.fmt(m.proj)}</Text>
                )}
              </View>
            )
          })}
        </View>

        {/* Deal terms table by section */}
        {SECTIONS.map(section => {
          const sectionFields = FIELDS.filter(f => f.section === section)
          return (
            <View key={section}>
              <View style={s.sectionHdr}>
                <Text style={s.sectionHdrText}>{section.toUpperCase()}</Text>
              </View>
              <View style={s.tableHdr}>
                <Text style={[s.tableHdrText, { flex: 2 }]}>Field</Text>
                {mode !== 'actual' && <Text style={[s.tableHdrText, { flex: 1.5, textAlign: 'right' }]}>Projected</Text>}
                {mode !== 'projected' && hasActuals && <Text style={[s.tableHdrText, { flex: 1.5, textAlign: 'right', color: C.accent }]}>{mode === 'actual' ? 'Value' : 'Actual'}</Text>}
                {mode === 'full' && hasActuals && <Text style={[s.tableHdrText, { flex: 1, textAlign: 'right' }]}>Delta</Text>}
              </View>
              {sectionFields.map((f, i) => {
                const projVal = (projected as any)[f.key] ?? 0
                const actVal = (actualInputs as any)[f.key]
                const hasAct = actVal !== undefined && actVal !== null
                const actNum = hasAct ? Number(actVal) : projVal
                const delta = actNum - projVal
                const isExpense = section === 'Expenses'
                const tu = effective.tu || 0
                const annualize = (val: number): string | null => {
                  if (!val || !tu) return null
                  if (f.isRent) return `(${fmtD(val * tu * 12)}/yr)`
                  if (f.perUnit) return `(${fmtD(val * tu)}/yr)`
                  return null
                }
                const projAnn = annualize(projVal)
                const actAnn = annualize(actNum)
                return (
                  <View key={f.key} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={{ flex: 2, fontSize: 8.5 }}>{f.label}{f.unit ? ` ${f.unit}` : ''}</Text>
                    {mode !== 'actual' && (
                      <Text style={{ flex: 1.5, fontSize: 8.5, textAlign: 'right', color: C.gray }}>
                        {projAnn && <Text style={{ fontSize: 7, color: '#bbb' }}>{projAnn} </Text>}{fmtFieldVal(projVal, f.dollar, f.pct, f.unit)}
                      </Text>
                    )}
                    {mode !== 'projected' && hasActuals && (
                      <Text style={{ flex: 1.5, fontSize: 8.5, textAlign: 'right',
                        fontFamily: hasAct ? 'Helvetica-Bold' : 'Helvetica',
                        color: mode === 'actual' ? (hasAct ? C.text : C.gray) : (hasAct ? C.text : C.muted) }}>
                        {actAnn && (mode === 'actual' || hasAct) && <Text style={{ fontSize: 7, color: '#bbb', fontFamily: 'Helvetica' }}>{actAnn} </Text>}
                        {mode === 'actual' ? fmtFieldVal(actNum, f.dollar, f.pct) : (hasAct ? fmtFieldVal(actNum, f.dollar, f.pct) : '—')}
                      </Text>
                    )}
                    {mode === 'full' && hasActuals && (
                      <Text style={{ flex: 1, fontSize: 8.5, textAlign: 'right', fontFamily: 'Helvetica-Bold',
                        color: !hasAct || delta === 0 ? C.muted : isExpense ? (delta > 0 ? C.red : C.green) : (delta > 0 ? C.green : C.red) }}>
                        {!hasAct || delta === 0 ? '—' : f.dollar ? `${delta > 0 ? '+' : '-'}${fmtD(Math.abs(delta))}` : f.pct ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}%` : `${delta > 0 ? '+' : ''}${delta}`}
                      </Text>
                    )}
                  </View>
                )
              })}
            </View>
          )
        })}

        {/* P&L Impact with 5-year projection */}
        {(mode === 'full' ? hasActuals : true) && (
          <View>
            <View style={[s.sectionHdr, { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <Text style={s.sectionHdrText}>P&L — 5-YEAR HOLD PROJECTION{mode === 'projected' ? ' (PROJECTED)' : mode === 'actual' ? ' (ACTUAL)' : ''}</Text>
              <Text style={{ fontSize: 7, color: '#999' }}>Rent growth: {rentGrowth}% · Exp escalation: {expGrowth}%</Text>
            </View>
            <View style={s.tableHdr}>
              <Text style={[s.tableHdrText, { flex: 2.2 }]}>Line Item</Text>
              {mode === 'full' && <Text style={[s.tableHdrText, { flex: 1.1, textAlign: 'right' }]}>Projected</Text>}
              <Text style={[s.tableHdrText, { flex: 1.1, textAlign: 'right', color: mode === 'projected' ? C.text : C.accent }]}>Year 1</Text>
              {mode === 'full' && <Text style={[s.tableHdrText, { flex: 0.8, textAlign: 'right' }]}>Delta</Text>}
              <Text style={[s.tableHdrText, { flex: 1, textAlign: 'right' }]}>Year 2</Text>
              <Text style={[s.tableHdrText, { flex: 1, textAlign: 'right' }]}>Year 3</Text>
              <Text style={[s.tableHdrText, { flex: 1, textAlign: 'right' }]}>Year 4</Text>
              <Text style={[s.tableHdrText, { flex: 1, textAlign: 'right' }]}>Year 5</Text>
            </View>
            {(() => {
              // For projected-only mode, recalculate projections from projected inputs (not actuals)
              const projYearCalcs = mode === 'projected' ? [2, 3, 4, 5].map(year => {
                const rg = Math.pow(1 + rentGrowth / 100, year - 1)
                const eg = Math.pow(1 + expGrowth / 100, year - 1)
                const scaled: ModelInputs = {
                  ...projected,
                  rent: projected.rent * rg,
                  rentRoll: projected.rentRoll?.map(u => ({ ...u, rent: (u.rent || 0) * rg })),
                  otherIncome: projected.otherIncome?.map(x => ({ ...x, amount: (x.amount || 0) * rg })),
                  tax: projected.tax * eg, ins: projected.ins * eg, rm: projected.rm * eg, res: projected.res * eg,
                  cs: projected.cs * eg, ga: projected.ga * eg, util: projected.util * eg,
                  utilElec: projected.utilElec * eg, utilWater: projected.utilWater * eg, utilTrash: projected.utilTrash * eg,
                  pmPerUnit: projected.pmPerUnit * eg,
                  otherExpenses: projected.otherExpenses?.map(x => ({ ...x, amount: (x.amount || 0) * eg })),
                  costSeg: 0, closingDate: undefined,
                }
                return calculate(scaled, !(projected.ou > 0 && projected.ou < projected.tu))
              }) : yearCalcs
              const useCalc = mode === 'projected' ? projCalc : actCalc
              const useCx = mode === 'projected' ? capxProj : capxAmt
              const useYears = projYearCalcs
              const rows: { label: string; p: number; a: number; yVals: number[]; bold: boolean; noi?: boolean; amber?: boolean; y1Only?: boolean }[] = [
                { label: 'Gross Scheduled Rent', p: projCalc.GSR, a: useCalc.GSR, yVals: useYears.map(yc => yc.GSR), bold: false },
                { label: 'Vacancy', p: -projCalc.vac, a: -useCalc.vac, yVals: useYears.map(yc => -yc.vac), bold: false },
                { label: 'Effective Gross Income', p: projCalc.EGI, a: useCalc.EGI, yVals: useYears.map(yc => yc.EGI), bold: true },
                { label: 'Total Expenses', p: -projCalc.exp, a: -useCalc.exp, yVals: useYears.map(yc => -yc.exp), bold: false },
                { label: 'NOI', p: projCalc.NOI, a: useCalc.NOI, yVals: useYears.map(yc => yc.NOI), bold: true, noi: true },
                { label: 'Debt Service', p: -projCalc.ds, a: -useCalc.ds, yVals: useYears.map(yc => -yc.ds), bold: false },
                ...(useCx > 0 || (mode === 'full' && (capxAmt > 0 || capxProj > 0)) ? [
                  { label: 'Cap X', p: -capxProj, a: -useCx, yVals: [0, 0, 0, 0], bold: false },
                ] : []),
                { label: 'Pre-Tax Cash Flow', p: projCalc.CF - capxProj, a: useCalc.CF - useCx, yVals: useYears.map(yc => yc.CF), bold: true },
                { label: 'Tax Savings', p: projCalc.ts, a: useCalc.ts, yVals: useYears.map(yc => yc.ts), bold: false },
                { label: 'After-Tax Cash Flow', p: projCalc.at - capxProj, a: useCalc.at - useCx, yVals: useYears.map(yc => yc.at), bold: true },
                ...(taxDeferred > 0 ? [
                  { label: '1031 Tax Deferred', p: taxDeferred, a: taxDeferred, yVals: [0, 0, 0, 0], bold: false, amber: true, y1Only: true },
                  { label: 'Total Year 1 Benefit', p: (projCalc.at - capxProj) + taxDeferred, a: (useCalc.at - useCx) + taxDeferred, yVals: [0, 0, 0, 0], bold: true, amber: true, y1Only: true },
                ] : []),
              ]
              const y1Total = (useCalc.at - useCx) + taxDeferred
              const cumulative = useYears.map((_yc, yi) => {
                let total = y1Total
                for (let j = 0; j <= yi; j++) total += useYears[j].at
                return total
              })

              return (<>
                {rows.map((row, i) => {
                  const delta = row.a - row.p
                  const bg = row.amber ? '#FDF8EC' : row.noi ? '#EAF3DE' : i % 2 === 0 ? 'white' : '#FAFAF8'
                  const y1Val = mode === 'projected' ? row.p : row.a
                  return (
                    <View key={i} style={[s.tableRow, { backgroundColor: bg }]}>
                      <Text style={{ flex: 2.2, fontSize: 8, fontFamily: row.bold ? 'Helvetica-Bold' : 'Helvetica', color: row.amber ? C.amber : C.text }}>{row.label}</Text>
                      {mode === 'full' && <Text style={{ flex: 1.1, fontSize: 8, textAlign: 'right', color: C.gray }}>{fmtNeg(row.p)}</Text>}
                      <Text style={{ flex: 1.1, fontSize: 8, textAlign: 'right', fontFamily: row.bold ? 'Helvetica-Bold' : 'Helvetica', color: row.amber ? C.amber : C.text }}>{fmtNeg(y1Val)}</Text>
                      {mode === 'full' && <Text style={{ flex: 0.8, fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold',
                        color: row.y1Only ? 'transparent' : Math.abs(delta) < 1 ? C.muted : delta > 0 ? C.green : C.red }}>
                        {row.y1Only ? '' : Math.abs(delta) < 1 ? '—' : `${delta > 0 ? '+' : '-'}${fmtD(Math.abs(delta))}`}
                      </Text>}
                      {row.yVals.map((val, yi) => (
                        <Text key={yi} style={{ flex: 1, fontSize: 8, textAlign: 'right', color: row.y1Only ? 'transparent' : row.bold ? C.text : C.gray }}>{row.y1Only ? '' : fmtNeg(val)}</Text>
                      ))}
                    </View>
                  )
                })}
                <View style={[s.tableRow, { backgroundColor: C.text, borderBottomWidth: 0 }]}>
                  <Text style={{ flex: 2.2, fontSize: 8, fontFamily: 'Helvetica-Bold', color: 'white' }}>Cumulative</Text>
                  {mode === 'full' && <Text style={{ flex: 1.1, fontSize: 8 }}></Text>}
                  <Text style={{ flex: 1.1, fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: 'white' }}>{fmtD(y1Total)}</Text>
                  {mode === 'full' && <Text style={{ flex: 0.8, fontSize: 8 }}></Text>}
                  {cumulative.map((val, yi) => (
                    <Text key={yi} style={{ flex: 1, fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: 'white' }}>{fmtD(val)}</Text>
                  ))}
                </View>
              </>)
            })()}
          </View>
        )}

        <Text style={s.disclaimer}>
          Projected figures from underwriting scenario "{scenarioName}". Actual figures reflect quotes and terms received during due diligence.
          Years 2-5 projected using {rentGrowth}% annual rent growth and {expGrowth}% expense escalation. Debt service held constant.
          Tax savings reflect bonus depreciation in Year 1 and straight-line depreciation thereafter.
          All calculations are estimates and should be independently verified. Consult qualified professionals before making investment decisions.
        </Text>
      </Page>

      {/* Page 2: Glossary */}
      <Page size="LETTER" style={s.page}>
        <Text style={[s.title, { fontSize: 14, marginBottom: 4 }]}>Definitions</Text>
        <View style={s.orangeLine} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
          {GLOSSARY.map((item, i) => (
            <View key={i} style={{
              width: '48%',
              marginRight: i % 2 === 0 ? '4%' : 0,
              marginBottom: 8,
              padding: '6 8',
              backgroundColor: '#F8F8F8',
              borderRadius: 3,
              borderLeftWidth: 2,
              borderLeftColor: C.accent,
            }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 2 }}>{item.term}</Text>
              <Text style={{ fontSize: 7, color: C.gray, lineHeight: 1.4 }}>{item.definition}</Text>
            </View>
          ))}
        </View>

        <Text style={[s.disclaimer, { marginTop: 'auto' }]}>
          Prepared by Chai Holdings, LLC. For informational purposes only — not investment, tax, or legal advice.
          Consult a CPA for tax strategy and a qualified attorney for legal matters. {date}
        </Text>
      </Page>
    </Document>
  )
}
