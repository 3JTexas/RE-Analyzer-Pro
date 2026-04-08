import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { calculate, fmtDollar, fmtPct, fmtX, fmtNeg } from '../../lib/calc'
import type { ModelInputs } from '../../types'
import type { KeyDates } from '../../types/pipeline'

const C = { text: '#1a1a2e', gray: '#666', muted: '#888', accent: '#c9a84c', green: '#1D6B3E', red: '#A32D2D', border: '#E5E3DC' }

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
  disclaimer: { fontSize: 7, color: C.muted, marginTop: 16, lineHeight: 1.5, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
})

const fmtD = (v: number) => `$${Math.round(v).toLocaleString()}`
const fmtFieldVal = (v: number, dollar?: boolean, pct?: boolean, unit?: string) =>
  dollar ? fmtD(v) : pct ? `${v}%` : unit ? `${v} ${unit}` : String(v)

interface FieldDef {
  key: string; label: string; dollar?: boolean; pct?: boolean; unit?: string; section: string
}

const FIELDS: FieldDef[] = [
  { key: 'tu', label: 'Total Units', section: 'Income' },
  { key: 'ou', label: 'Occupied Units', section: 'Income' },
  { key: 'rent', label: 'Avg Rent / Unit / Mo', section: 'Income', dollar: true },
  { key: 'vp', label: 'Vacancy %', section: 'Income', pct: true },
  { key: 'price', label: 'Purchase Price', section: 'Financing', dollar: true },
  { key: 'ir', label: 'Interest Rate', section: 'Financing', pct: true },
  { key: 'lev', label: 'LTV', section: 'Financing', pct: true },
  { key: 'am', label: 'Amortization', section: 'Financing', unit: 'years' },
  { key: 'lf', label: 'Lender Fee', section: 'Financing', pct: true },
  { key: 'cc', label: 'Closing Costs', section: 'Financing', pct: true },
  { key: 'tax', label: 'Real Estate Taxes', section: 'Expenses', dollar: true },
  { key: 'ins', label: 'Insurance', section: 'Expenses', dollar: true, unit: '/unit/yr' },
  { key: 'util', label: 'Total Utilities', section: 'Expenses', dollar: true },
  { key: 'rm', label: 'R&M', section: 'Expenses', dollar: true, unit: '/unit/yr' },
  { key: 'cs', label: 'Contract Services', section: 'Expenses', dollar: true },
  { key: 'ga', label: 'G&A', section: 'Expenses', dollar: true },
  { key: 'res', label: 'Reserves', section: 'Expenses', dollar: true, unit: '/unit/yr' },
  { key: 'pm', label: 'Prop Mgmt', section: 'Expenses', pct: true },
]

const SECTIONS = ['Income', 'Financing', 'Expenses']

interface Props {
  projected: ModelInputs
  actualInputs: Partial<ModelInputs>
  scenarioName: string
  propertyName: string
  propertyAddress: string | null
  keyDates?: KeyDates
}

export function DealTermsPdf({ projected, actualInputs, scenarioName, propertyName, propertyAddress, keyDates }: Props) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const logoSrc = `${import.meta.env.BASE_URL}Chai_Logo.jpeg`

  const effective: ModelInputs = { ...projected, ...Object.fromEntries(Object.entries(actualInputs).filter(([_, v]) => v !== undefined && v !== null)) }
  const projCalc = calculate(projected, !(projected.ou > 0 && projected.ou < projected.tu))
  const actCalc = calculate(effective, !(effective.ou > 0 && effective.ou < effective.tu))
  const hasActuals = Object.keys(actualInputs).filter(k => (actualInputs as any)[k] !== undefined && (actualInputs as any)[k] !== null).length > 0

  return (
    <Document title={`Deal Terms — ${propertyName}`}>
      <Page size="LETTER" style={s.page}>
        <Image src={logoSrc} style={{ width: 120, marginBottom: 10 }} />
        <Text style={s.title}>Deal Terms — {propertyName}</Text>
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
            { label: 'NOI', val: hasActuals ? actCalc.NOI : projCalc.NOI, prev: projCalc.NOI, fmt: fmtDollar },
            { label: 'Cap Rate', val: hasActuals ? actCalc.cap : projCalc.cap, prev: projCalc.cap, fmt: fmtPct },
            { label: 'DCR', val: hasActuals ? actCalc.dcr : projCalc.dcr, prev: projCalc.dcr, fmt: fmtX },
            { label: 'Cash-on-Cash', val: hasActuals ? actCalc.coc : projCalc.coc, prev: projCalc.coc, fmt: fmtPct },
          ].map(m => (
            <View key={m.label} style={s.metricCard}>
              <Text style={s.metricLabel}>{m.label}</Text>
              <Text style={s.metricValue}>{m.fmt(m.val)}</Text>
              {hasActuals && Math.abs(m.val - m.prev) > 0.01 && (
                <Text style={[s.metricSub, { color: m.val > m.prev ? C.green : C.red }]}>was {m.fmt(m.prev)}</Text>
              )}
            </View>
          ))}
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
                <Text style={[s.tableHdrText, { flex: 1.5, textAlign: 'right' }]}>Projected</Text>
                {hasActuals && <Text style={[s.tableHdrText, { flex: 1.5, textAlign: 'right', color: C.accent }]}>Actual</Text>}
                {hasActuals && <Text style={[s.tableHdrText, { flex: 1, textAlign: 'right' }]}>Delta</Text>}
              </View>
              {sectionFields.map((f, i) => {
                const projVal = (projected as any)[f.key] ?? 0
                const actVal = (actualInputs as any)[f.key]
                const hasAct = actVal !== undefined && actVal !== null
                const actNum = hasAct ? Number(actVal) : projVal
                const delta = actNum - projVal
                const isExpense = section === 'Expenses'
                return (
                  <View key={f.key} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={{ flex: 2, fontSize: 8.5 }}>{f.label}{f.unit ? ` ${f.unit}` : ''}</Text>
                    <Text style={{ flex: 1.5, fontSize: 8.5, textAlign: 'right', color: C.gray }}>{fmtFieldVal(projVal, f.dollar, f.pct, f.unit)}</Text>
                    {hasActuals && (
                      <Text style={{ flex: 1.5, fontSize: 8.5, textAlign: 'right', fontFamily: hasAct ? 'Helvetica-Bold' : 'Helvetica', color: hasAct ? C.text : C.muted }}>
                        {hasAct ? fmtFieldVal(actNum, f.dollar, f.pct) : '—'}
                      </Text>
                    )}
                    {hasActuals && (
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

        {/* P&L comparison */}
        {hasActuals && (
          <View>
            <View style={[s.sectionHdr, { marginTop: 14 }]}>
              <Text style={s.sectionHdrText}>P&L IMPACT — PROJECTED VS ACTUAL</Text>
            </View>
            <View style={s.tableHdr}>
              <Text style={[s.tableHdrText, { flex: 2.5 }]}>Line Item</Text>
              <Text style={[s.tableHdrText, { flex: 1.5, textAlign: 'right' }]}>Projected</Text>
              <Text style={[s.tableHdrText, { flex: 1.5, textAlign: 'right', color: C.accent }]}>Actual</Text>
              <Text style={[s.tableHdrText, { flex: 1, textAlign: 'right' }]}>Delta</Text>
            </View>
            {[
              { label: 'Gross Scheduled Rent', p: projCalc.GSR, a: actCalc.GSR, bold: false },
              { label: 'Vacancy', p: -projCalc.vac, a: -actCalc.vac, bold: false },
              { label: 'Effective Gross Income', p: projCalc.EGI, a: actCalc.EGI, bold: true },
              { label: 'Total Expenses', p: -projCalc.exp, a: -actCalc.exp, bold: false },
              { label: 'NOI', p: projCalc.NOI, a: actCalc.NOI, bold: true },
              { label: 'Debt Service', p: -projCalc.ds, a: -actCalc.ds, bold: false },
              { label: 'Pre-Tax Cash Flow', p: projCalc.CF, a: actCalc.CF, bold: true },
              { label: 'After-Tax Cash Flow', p: projCalc.at, a: actCalc.at, bold: true },
            ].map((row, i) => {
              const delta = row.a - row.p
              return (
                <View key={i} style={row.bold && row.label === 'NOI' ? [s.tableRow, { backgroundColor: '#EAF3DE' }] : i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={{ flex: 2.5, fontSize: 8.5, fontFamily: row.bold ? 'Helvetica-Bold' : 'Helvetica' }}>{row.label}</Text>
                  <Text style={{ flex: 1.5, fontSize: 8.5, textAlign: 'right', color: C.gray }}>{fmtNeg(row.p)}</Text>
                  <Text style={{ flex: 1.5, fontSize: 8.5, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{fmtNeg(row.a)}</Text>
                  <Text style={{ flex: 1, fontSize: 8.5, textAlign: 'right', fontFamily: 'Helvetica-Bold',
                    color: Math.abs(delta) < 1 ? C.muted : delta > 0 ? C.green : C.red }}>
                    {Math.abs(delta) < 1 ? '—' : `${delta > 0 ? '+' : '-'}${fmtD(Math.abs(delta))}`}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        <Text style={s.disclaimer}>
          Projected figures from underwriting scenario "{scenarioName}". Actual figures reflect quotes and terms received during due diligence.
          All calculations are estimates and should be independently verified. Consult qualified professionals before making investment decisions.
        </Text>
      </Page>
    </Document>
  )
}
