import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { ModelInputs, Method } from '../../types'
import { calculate, fmtDollar, fmtNeg, fmtPct, fmtX, fmtDelta, fmtDeltaPct } from '../../lib/calc'

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#111', padding: '0.5in' },
  coverPage: { fontFamily: 'Helvetica', fontSize: 9, backgroundColor: '#0D2340', padding: '0.75in' },

  coverTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: 'white', marginBottom: 6 },
  coverSub:   { fontSize: 13, color: '#A8C4E0', marginBottom: 4 },
  coverMeta:  { fontSize: 10, color: '#C8D8E8', marginBottom: 3 },
  orangeLine: { height: 3, backgroundColor: '#E07820', marginBottom: 20, marginTop: 8 },

  pageHeader: { borderBottomWidth: 1.5, borderBottomColor: '#E07820', marginBottom: 14, paddingBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pageHeaderLeft:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#0D2340' },
  pageHeaderRight: { fontSize: 7.5, color: '#5F5E5A' },

  sectionHdr: { backgroundColor: '#0D2340', color: 'white', fontFamily: 'Helvetica-Bold',
    fontSize: 8, padding: '5 8', marginTop: 12, marginBottom: 6 },

  metricsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  metricCard: { flex: 1, backgroundColor: '#F1EFE8', borderRadius: 4, padding: '6 8' },
  metricLabel: { fontSize: 7.5, color: '#5F5E5A', marginBottom: 2 },
  metricValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  metricSub:   { fontSize: 7, color: '#888' },

  plRow:     { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.3,
    borderBottomColor: '#E5E3DC', paddingVertical: 2.5 },
  plTotal:   { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#D6E4F4',
    borderTopWidth: 0.6, borderBottomWidth: 0.6, borderColor: '#185FA5', paddingVertical: 3.5, marginTop: 2 },
  plNOI:     { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#EAF3DE',
    borderTopWidth: 0.6, borderBottomWidth: 0.6, borderColor: '#185FA5', paddingVertical: 3.5, marginTop: 2 },
  plLabel:   { flex: 1, fontSize: 8.5 },
  plIndent:  { flex: 1, fontSize: 8.5, paddingLeft: 10, color: '#5F5E5A' },
  plVal:     { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  plTotLabel:{ flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  plTotVal:  { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  table:       { borderWidth: 0.5, borderColor: '#D3D1C7', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  tableHdrRow: { flexDirection: 'row', backgroundColor: '#0D2340' },
  tableHdrCell:{ flex: 1, padding: '4 6', fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: 'white' },
  tableRow:    { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: '#E5E3DC' },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: '#E5E3DC', backgroundColor: '#F1EFE8' },
  tableCell:   { flex: 1, padding: '3 6', fontSize: 8.5 },
  tableCellR:  { flex: 1, padding: '3 6', fontSize: 8.5, textAlign: 'right' },

  alertGreen: { backgroundColor: '#EAF3DE', borderWidth: 0.5, borderColor: '#97c459', borderRadius: 3,
    padding: '5 8', marginBottom: 6 },
  alertAmber: { backgroundColor: '#FAEEDA', borderWidth: 0.5, borderColor: '#fac775', borderRadius: 3,
    padding: '5 8', marginBottom: 6 },
  alertRed:   { backgroundColor: '#FCEBEB', borderWidth: 0.5, borderColor: '#f09595', borderRadius: 3,
    padding: '5 8', marginBottom: 6 },
  alertText:  { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  disclaimer: { marginTop: 14, fontSize: 7.5, color: '#888', borderTopWidth: 0.5, borderTopColor: '#D3D1C7',
    paddingTop: 6, lineHeight: 1.5 },
  twoCol: { flexDirection: 'row', gap: 12 },
  col:    { flex: 1 },
})

// ── Helpers ───────────────────────────────────────────────────────────────
interface HdrProps {
  propertyName: string
  address: string
  scenarioName: string
  method: string
  date: string
}

function PageHdr({ propertyName, address, scenarioName, method, date }: HdrProps) {
  return (
    <View style={s.pageHeader} fixed>
      <Text style={s.pageHeaderLeft}>{propertyName.toUpperCase()}  ·  {address}</Text>
      <Text style={s.pageHeaderRight}>{scenarioName} · {method} · {date}</Text>
    </View>
  )
}

function SectionHdr({ title }: { title: string }) {
  return <View style={s.sectionHdr}><Text>{title.toUpperCase()}</Text></View>
}

function PLRowComp({ label, value, variant = 'normal', indent = false }:
  { label: string; value: string; variant?: string; indent?: boolean }) {
  const isTotal = variant === 'total'
  const isNOI   = variant === 'noi'
  const rowStyle = isTotal ? s.plTotal : isNOI ? s.plNOI : s.plRow
  const lblStyle = (isTotal || isNOI) ? s.plTotLabel : indent ? s.plIndent : s.plLabel
  const valStyle = (isTotal || isNOI) ? s.plTotVal : s.plVal
  const valColor = variant === 'neg' ? '#A32D2D' : variant === 'pos' ? '#1D6B3E' : isNOI ? '#185FA5' : '#111'
  return (
    <View style={rowStyle}>
      <Text style={lblStyle}>{label}</Text>
      <Text style={[valStyle, { color: valColor }]}>{value}</Text>
    </View>
  )
}

// ── PDF Document ──────────────────────────────────────────────────────────
interface ReportProps {
  inputs: ModelInputs
  method: Method
  propertyName: string
  address: string
  units: number
  yearBuilt: number
  scenarioName: string
}

function ReportDocument({ inputs, method, propertyName, address, units, yearBuilt, scenarioName }: ReportProps) {
  const isOM = method === 'om'
  const d    = calculate(inputs, isOM)
  const dom  = calculate(inputs, true)
  const dph  = calculate(inputs, false)
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const methodLabel = isOM ? 'OM Method' : 'Physical Occupancy'
  const dcrColor = d.dcr < 1 ? '#A32D2D' : d.dcr < 1.2 ? '#854F0B' : '#1D6B3E'

  const safeName = (propertyName || 'Investment Property').trim()

  return (
    <Document title={`${propertyName} — ${scenarioName} — Investment Analysis`}>

      {/* ── Cover ──────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.coverPage}>
        <Text style={s.coverSub}>Investment Analysis</Text>
        <Text style={s.coverTitle}>{safeName}</Text>
        <View style={s.orangeLine} />
        {!!address && <Text style={s.coverMeta}>{address}</Text>}
        <Text style={s.coverMeta}>
          {units} Units{yearBuilt ? `  ·  Year Built ${yearBuilt}` : ''}{inputs.price > 0 ? `  ·  Listed ${fmtDollar(inputs.price)}` : ''}
        </Text>
        <Text style={s.coverMeta}>Scenario: {scenarioName}  ·  Method: {methodLabel}</Text>
        <Text style={[s.coverMeta, { marginTop: 12 }]}>Prepared: {date}</Text>
        <Text style={[s.coverMeta, { marginTop: 4 }]}>CONFIDENTIAL — For Discussion Purposes Only</Text>
      </Page>

      {/* ── P&L + Tax ──────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} />

        <SectionHdr title="Key metrics" />
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>NOI</Text>
            <Text style={[s.metricValue, { color: '#185FA5' }]}>{fmtDollar(d.NOI)}</Text>
            <Text style={s.metricSub}>{methodLabel}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Cap rate</Text>
            <Text style={s.metricValue}>{fmtPct(d.cap)}</Text>
            <Text style={s.metricSub}>on purchase price</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>DCR</Text>
            <Text style={[s.metricValue, { color: dcrColor }]}>{fmtX(d.dcr)}</Text>
            <Text style={s.metricSub}>lender min 1.20×</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Pre-tax cash flow</Text>
            <Text style={[s.metricValue, { color: d.CF < 0 ? '#A32D2D' : '#1D6B3E' }]}>{fmtNeg(d.CF)}</Text>
            <Text style={s.metricSub}>after debt service</Text>
          </View>
        </View>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Loan amount</Text>
            <Text style={s.metricValue}>{fmtDollar(d.loan)}</Text>
            <Text style={s.metricSub}>{d.lev.toFixed(0)}% LTV</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Annual debt service</Text>
            <Text style={s.metricValue}>{fmtDollar(d.ds)}</Text>
            <Text style={s.metricSub}>{fmtDollar(d.mp)}/mo</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Equity required</Text>
            <Text style={s.metricValue}>{fmtDollar(d.eq)}</Text>
            <Text style={s.metricSub}>down + lender fee</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Y1 total ROE</Text>
            <Text style={[s.metricValue, { color: '#1D6B3E' }]}>{fmtPct(d.r1)}</Text>
            <Text style={s.metricSub}>REP + bonus dep</Text>
          </View>
        </View>

        <View style={d.dcr < 1 ? s.alertRed : d.dcr < 1.2 ? s.alertAmber : s.alertGreen}>
          <Text style={s.alertText}>
            {d.dcr < 1
              ? `DCR FAIL: ${fmtX(d.dcr)} — NOI ${fmtDollar(d.NOI)} cannot cover debt service ${fmtDollar(d.ds)}`
              : d.dcr < 1.2
              ? `DCR CAUTION: ${fmtX(d.dcr)} — Below 1.20× minimum. NOI must reach ${fmtDollar(d.ds * 1.2)}`
              : `DCR OK: ${fmtX(d.dcr)} — Clears 1.20× minimum. Cushion: ${fmtDollar(d.NOI - d.ds)}/yr`}
          </Text>
        </View>

        <View style={s.twoCol}>
          <View style={s.col}>
            <SectionHdr title={`${isOM ? 'OM method' : 'Physical occupancy'} — income & expense`} />
            <PLRowComp label={isOM ? 'Gross scheduled rent' : 'Gross potential rent'} value={fmtDollar(d.GSR)} variant="pos" />
            <PLRowComp
              label={isOM ? `Less: vacancy (${d.vp}%)` : `Less: physical vacancy (${d.tu - d.ou} units)`}
              value={`(${fmtDollar(d.pv)})`} variant="neg" indent />
            {!isOM && d.av > 0 && (
              <PLRowComp label={`Less: turnover buffer (${d.vp}%)`} value={`(${fmtDollar(d.av)})`} variant="neg" indent />
            )}
            <PLRowComp label="Collected rental income" value={fmtDollar(d.col)} indent />
            <PLRowComp label="Effective gross income" value={fmtDollar(d.EGI)} variant="total" />
            <PLRowComp label="Real estate taxes" value={`(${fmtDollar(d.taxTotal)})`} variant="neg" indent />
            <PLRowComp label={`Insurance (${d.tu} doors)`} value={`(${fmtDollar(d.ins)})`} variant="neg" indent />
            <PLRowComp label="Utilities" value={`(${fmtDollar(d.util)})`} variant="neg" indent />
            <PLRowComp label="R&M" value={`(${fmtDollar(d.rm)})`} variant="neg" indent />
            <PLRowComp label="Contract services" value={`(${fmtDollar(d.cs)})`} variant="neg" indent />
            <PLRowComp label="G&A" value={`(${fmtDollar(d.ga)})`} variant="neg" indent />
            <PLRowComp label="Reserves" value={`(${fmtDollar(d.res)})`} variant="neg" indent />
            <PLRowComp label={`Prop. mgmt (${d.pmPct.toFixed(1)}%)`} value={`(${fmtDollar(d.pm)})`} variant="neg" indent />
            <PLRowComp label="Total expenses" value={`(${fmtDollar(d.exp)})`} variant="total" />
            <PLRowComp label="Net operating income" value={fmtDollar(d.NOI)} variant="noi" />
            <PLRowComp label="Annual debt service" value={`(${fmtDollar(d.ds)})`} variant="neg" indent />
            <PLRowComp label="Pre-tax cash flow" value={fmtNeg(d.CF)} variant="total" />
          </View>

          <View style={s.col}>
            <SectionHdr title="Tax analysis — REP · 100% bonus dep · 1031" />
            <PLRowComp label="NOI" value={fmtDollar(d.NOI)} variant="noi" />
            <PLRowComp label="Less: Y1 mortgage interest" value={`(${fmtDollar(d.int1)})`} variant="neg" indent />
            <PLRowComp label="Income before depreciation" value={fmtNeg(d.ti)} variant="total" />
            <PLRowComp label="Bonus dep 5/7/15-yr (100%)" value={`(${fmtDollar(d.bd)})`} variant="pos" indent />
            <PLRowComp label="27.5-yr SL depreciation" value={`(${fmtDollar(d.sl)})`} variant="pos" indent />
            <PLRowComp label="Year 1 paper loss (REP)" value={`(${fmtDollar(Math.abs(d.loss))})`} variant="total" />
            <PLRowComp label={`Tax savings @ ${d.brk}%`} value={fmtDollar(d.ts)} variant="pos" />
            <PLRowComp label="After-tax cash flow" value={fmtNeg(d.at)} />
            <PLRowComp label="Principal reduction (Y1)" value={fmtDollar(d.prin1)} variant="pos" indent />
            <PLRowComp label="Total Y1 economic return" value={fmtDollar(d.y1)} variant="total" />

            <SectionHdr title="Return on equity" />
            <View style={s.metricsRow}>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>Pre-tax CoC</Text>
                <Text style={[s.metricValue, { fontSize: 12, color: d.coc < 0 ? '#A32D2D' : '#1D6B3E' }]}>{fmtPct(d.coc)}</Text>
              </View>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>After-tax CoC</Text>
                <Text style={[s.metricValue, { fontSize: 12, color: '#1D6B3E' }]}>{fmtPct(d.atc)}</Text>
              </View>
            </View>
            <View style={s.metricsRow}>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>Y1 total ROE</Text>
                <Text style={[s.metricValue, { fontSize: 12, color: '#1D6B3E' }]}>{fmtPct(d.r1)}</Text>
              </View>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>Yr 2+ ROE</Text>
                <Text style={[s.metricValue, { fontSize: 12 }]}>{fmtPct(d.r2)}</Text>
              </View>
            </View>

            <SectionHdr title="Cash to close" />
            <PLRowComp label="Down payment" value={fmtDollar(d.down)} />
            <PLRowComp label="Lender origination fee" value={d.lfee > 0 ? `(${fmtDollar(d.lfee)})` : '$0'} variant="neg" indent />
            {d.ccAmt > 0 && <PLRowComp label={`Closing costs (${inputs.cc}%)`} value={`(${fmtDollar(d.ccAmt)})`} variant="neg" indent />}
            <PLRowComp label="Est. total cash to close" value={fmtDollar(d.eq + d.ccAmt)} variant="total" />
          </View>
        </View>
      </Page>

      {/* ── Side by side ───────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} />
        <SectionHdr title="Side-by-side: OM method vs physical occupancy" />
        <View style={s.table}>
          <View style={s.tableHdrRow}>
            <Text style={[s.tableHdrCell, { flex: 2.5 }]}>Line item</Text>
            <Text style={[s.tableHdrCell, { color: '#A8C4E0', textAlign: 'right' }]}>OM method</Text>
            <Text style={[s.tableHdrCell, { color: '#F4C87A', textAlign: 'right' }]}>Physical occ.</Text>
            <Text style={[s.tableHdrCell, { textAlign: 'right' }]}>Delta</Text>
          </View>
          {[
            { label: 'Gross scheduled / potential rent', om: fmtDollar(dom.GSR), ph: fmtDollar(dph.GSR), d: dph.GSR - dom.GSR },
            { label: '  Less: vacancy deduction', om: `(${fmtDollar(dom.vac)})`, ph: `(${fmtDollar(dph.vac)})`, d: dom.vac - dph.vac },
            { label: '  Collected rental income', om: fmtDollar(dom.col), ph: fmtDollar(dph.col), d: dph.col - dom.col },
            { label: 'Effective gross income', om: fmtDollar(dom.EGI), ph: fmtDollar(dph.EGI), d: dph.EGI - dom.EGI, bold: true },
            { label: 'Total expenses', om: `(${fmtDollar(dom.exp)})`, ph: `(${fmtDollar(dph.exp)})`, d: dom.exp - dph.exp },
            { label: 'NOI', om: fmtDollar(dom.NOI), ph: fmtDollar(dph.NOI), d: dph.NOI - dom.NOI, bold: true },
            { label: 'Pre-tax cash flow', om: fmtNeg(dom.CF), ph: fmtNeg(dph.CF), d: dph.CF - dom.CF },
            { label: 'After-tax cash flow', om: fmtNeg(dom.at), ph: fmtNeg(dph.at), d: dph.at - dom.at },
            { label: 'Year 1 total ROE', om: fmtPct(dom.r1), ph: fmtPct(dph.r1), dStr: fmtDeltaPct(dph.r1 - dom.r1), d: dph.r1 - dom.r1 },
          ].map((row, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCell, { flex: 2.5,
                fontFamily: row.bold ? 'Helvetica-Bold' : 'Helvetica',
                paddingLeft: row.label.startsWith('  ') ? 16 : 6,
                color: row.label.startsWith('  ') ? '#5F5E5A' : '#111' }]}>
                {row.label.trim()}
              </Text>
              <Text style={[s.tableCellR, { color: '#185FA5' }]}>{row.om}</Text>
              <Text style={[s.tableCellR, { color: '#854F0B' }]}>{row.ph}</Text>
              <Text style={[s.tableCellR, {
                color: row.d > 50 ? '#1D6B3E' : row.d < -50 ? '#A32D2D' : '#888',
                fontFamily: 'Helvetica-Bold' }]}>
                {'dStr' in row ? row.dStr : fmtDelta(row.d)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={s.disclaimer}>
          For discussion purposes only. Tax savings assume REP status (IRC §469), 100% bonus depreciation (OBBBA P.L. 119-21,
          IRS Notice 2026-11), and 1031 exchange carryover basis at purchase price. Actual depreciation depends on cost
          segregation study and verified exchange basis. Consult a licensed CPA before making investment or tax decisions.
          Property tax estimate reflects post-sale Florida reassessment — verify with county Property Appraiser.
        </Text>
      </Page>

    </Document>
  )
}

// ── Export function ───────────────────────────────────────────────────────
export async function generatePDF(
  inputs: ModelInputs,
  method: Method,
  propertyName: string,
  address: string,
  units: number,
  yearBuilt: number,
  scenarioName: string
): Promise<void> {
  const blob = await pdf(
    <ReportDocument
      inputs={inputs}
      method={method}
      propertyName={propertyName}
      address={address}
      units={units}
      yearBuilt={yearBuilt}
      scenarioName={scenarioName}
    />
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeProp = (propertyName || 'Property').replace(/[^a-zA-Z0-9]/g, '_')
  const safeSc   = (scenarioName || 'Scenario').replace(/[^a-zA-Z0-9]/g, '_')
  a.download = `${safeProp}_${safeSc}_Analysis.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
