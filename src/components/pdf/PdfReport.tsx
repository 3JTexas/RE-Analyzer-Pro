import { Document, Page, Text, View, Image, StyleSheet, pdf, Svg, Path, Line as SvgLine, Circle } from '@react-pdf/renderer'
import type { ModelInputs, Method } from '../../types'
import { calculate, fmtDollar, fmtNeg, fmtPct, fmtX, fmtDelta, fmtDeltaPct } from '../../lib/calc'

// ── Colors ───────────────────────────────────────────────────────────────
const C = {
  text: '#1a1a2e',
  textLight: '#5F5E5A',
  textMuted: '#888',
  accent: '#E07820',
  navy: '#0D2340',
  blue: '#185FA5',
  green: '#1D6B3E',
  red: '#A32D2D',
  amber: '#854F0B',
  bgLight: '#F8F8F8',
  bgCard: '#F5F4F0',
  border: '#E5E3DC',
  borderLight: '#EDEDEB',
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: C.text, padding: '0.5in' },
  coverPage: { fontFamily: 'Helvetica', fontSize: 9, backgroundColor: '#FFFFFF', padding: '0.6in' },

  coverLogo: { width: 180, marginBottom: 16 },
  coverPhoto: { width: '100%', height: 220, objectFit: 'cover', borderRadius: 6, marginBottom: 16 },
  coverPhotoPlaceholder: { width: '100%', height: 120, backgroundColor: C.bgLight, borderRadius: 6,
    marginBottom: 16, borderWidth: 0.5, borderColor: C.borderLight, justifyContent: 'center', alignItems: 'center' },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 4 },
  coverAddress: { fontSize: 11, color: C.textLight, marginBottom: 12 },
  orangeLine: { height: 3, backgroundColor: C.accent, marginBottom: 16, marginTop: 4 },
  coverMetricsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  coverMetricBox: { flex: 1, backgroundColor: C.bgCard, borderRadius: 4, padding: '8 10', borderWidth: 0.5, borderColor: C.borderLight },
  coverMetricLabel: { fontSize: 7.5, color: C.textMuted, marginBottom: 2 },
  coverMetricValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.navy },
  coverMetricSub: { fontSize: 7, color: C.textMuted, marginTop: 1 },
  coverFooter: { fontSize: 8.5, color: C.textLight, marginTop: 12 },
  coverConfidential: { fontSize: 7.5, color: C.textMuted, marginTop: 6 },

  pageHeader: { borderBottomWidth: 1.5, borderBottomColor: C.accent, marginBottom: 14, paddingBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pageHeaderLeft:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.navy },
  pageHeaderRight: { fontSize: 7.5, color: C.textLight },

  sectionHdr: { backgroundColor: C.bgLight, color: C.navy, fontFamily: 'Helvetica-Bold',
    fontSize: 8, padding: '5 8', marginTop: 12, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: C.border },

  metricsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  metricCard: { flex: 1, backgroundColor: C.bgCard, borderRadius: 4, padding: '6 8' },
  metricLabel: { fontSize: 7.5, color: C.textLight, marginBottom: 2 },
  metricValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  metricSub:   { fontSize: 7, color: C.textMuted },

  plRow:     { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.3,
    borderBottomColor: C.border, paddingVertical: 2.5 },
  plTotal:   { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E8EFF8',
    borderTopWidth: 0.6, borderBottomWidth: 0.6, borderColor: C.blue, paddingVertical: 3.5, marginTop: 2 },
  plNOI:     { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#EAF3DE',
    borderTopWidth: 0.6, borderBottomWidth: 0.6, borderColor: C.blue, paddingVertical: 3.5, marginTop: 2 },
  plLabel:   { flex: 1, fontSize: 8.5 },
  plIndent:  { flex: 1, fontSize: 8.5, paddingLeft: 10, color: C.textLight },
  plVal:     { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  plTotLabel:{ flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  plTotVal:  { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  table:       { borderWidth: 0.5, borderColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  tableHdrRow: { flexDirection: 'row', backgroundColor: C.bgLight, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableHdrCell:{ flex: 1, padding: '4 6', fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.navy },
  tableRow:    { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: C.border },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.3, borderBottomColor: C.border, backgroundColor: C.bgCard },
  tableCell:   { flex: 1, padding: '3 6', fontSize: 8.5 },
  tableCellR:  { flex: 1, padding: '3 6', fontSize: 8.5, textAlign: 'right' },

  alertGreen: { backgroundColor: '#EAF3DE', borderWidth: 0.5, borderColor: '#97c459', borderRadius: 3,
    padding: '5 8', marginBottom: 6 },
  alertAmber: { backgroundColor: '#FAEEDA', borderWidth: 0.5, borderColor: '#fac775', borderRadius: 3,
    padding: '5 8', marginBottom: 6 },
  alertRed:   { backgroundColor: '#FCEBEB', borderWidth: 0.5, borderColor: '#f09595', borderRadius: 3,
    padding: '5 8', marginBottom: 6 },
  alertText:  { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  disclaimer: { marginTop: 14, fontSize: 7.5, color: C.textMuted, borderTopWidth: 0.5, borderTopColor: C.border,
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
  const valColor = variant === 'neg' ? C.red : variant === 'pos' ? C.green : isNOI ? C.blue : C.text
  return (
    <View style={rowStyle}>
      <Text style={lblStyle}>{label}</Text>
      <Text style={[valStyle, { color: valColor }]}>{value}</Text>
    </View>
  )
}

// ── PDF Document ──────────────────────────────────────────────────────────
interface ScenarioCol {
  label: string
  inputs: ModelInputs
  method: Method
}

interface ReportProps {
  inputs: ModelInputs
  method: Method
  propertyName: string
  address: string
  units: number
  yearBuilt: number
  scenarioName: string
  scenarioCols?: ScenarioCol[]
  propertyImageUrl?: string
}

function deriveMethodLabel(inputs: ModelInputs, method: Method, label?: string): string {
  // If scenario name indicates OM As-Presented, use that
  if (label && /om\s*as[- ]?presented/i.test(label)) return 'OM As-Presented'
  // Auto-derive from occupancy
  if (inputs.ou > 0 && inputs.ou < inputs.tu) return 'Physical Occupancy'
  return method === 'om' ? 'OM Method' : 'Physical Occupancy'
}

function ReportDocument({ inputs, method, propertyName, address, units, yearBuilt, scenarioName, scenarioCols = [], propertyImageUrl }: ReportProps) {
  const isOM = method === 'om'
  const d    = calculate(inputs, isOM)
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const methodLabel = deriveMethodLabel(inputs, method, scenarioName)
  const dcrColor = d.dcr < 1 ? C.red : d.dcr < 1.2 ? C.amber : C.green
  const safeName = (propertyName || 'Investment Property').trim()

  // Build scenario columns for side-by-side — current scenario + siblings
  const allCols: ScenarioCol[] = scenarioCols.length > 0 ? scenarioCols : [{ label: scenarioName, inputs, method }]

  // Resolve logo path — works for both dev and production builds
  const logoSrc = `${import.meta.env.BASE_URL}Chai_Logo.jpeg`

  return (
    <Document title={`${propertyName} — ${scenarioName} — Investment Analysis`}>

      {/* ── Cover ──────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.coverPage}>
        {/* Logo */}
        <Image src={logoSrc} style={s.coverLogo} />

        {/* Property photo or placeholder */}
        {propertyImageUrl ? (
          <Image src={propertyImageUrl} style={s.coverPhoto} />
        ) : (
          <View style={s.coverPhotoPlaceholder}>
            <Text style={{ fontSize: 10, color: C.textMuted }}>No property photo</Text>
          </View>
        )}

        {/* Property name + address */}
        <Text style={s.coverTitle}>{safeName}</Text>
        {!!address && <Text style={s.coverAddress}>{address}</Text>}
        <View style={s.orangeLine} />

        {/* Key metrics grid */}
        <View style={s.coverMetricsRow}>
          <View style={s.coverMetricBox}>
            <Text style={s.coverMetricLabel}>Purchase Price</Text>
            <Text style={s.coverMetricValue}>{fmtDollar(inputs.price)}</Text>
            {units > 0 && <Text style={s.coverMetricSub}>{fmtDollar(inputs.price / units)}/unit</Text>}
          </View>
          <View style={s.coverMetricBox}>
            <Text style={s.coverMetricLabel}>Units</Text>
            <Text style={s.coverMetricValue}>{units}</Text>
            {yearBuilt ? <Text style={s.coverMetricSub}>Built {yearBuilt}</Text> : null}
          </View>
          <View style={s.coverMetricBox}>
            <Text style={s.coverMetricLabel}>Cap Rate</Text>
            <Text style={s.coverMetricValue}>{fmtPct(d.cap)}</Text>
            <Text style={s.coverMetricSub}>on purchase price</Text>
          </View>
          <View style={s.coverMetricBox}>
            <Text style={s.coverMetricLabel}>NOI</Text>
            <Text style={[s.coverMetricValue, { color: C.blue }]}>{fmtDollar(d.NOI)}</Text>
            <Text style={s.coverMetricSub}>{methodLabel.toLowerCase()}</Text>
          </View>
        </View>
        <View style={s.coverMetricsRow}>
          <View style={s.coverMetricBox}>
            <Text style={s.coverMetricLabel}>DCR</Text>
            <Text style={[s.coverMetricValue, { fontSize: 13, color: dcrColor }]}>{fmtX(d.dcr)}</Text>
            <Text style={s.coverMetricSub}>lender min 1.20×</Text>
          </View>
          <View style={s.coverMetricBox}>
            <Text style={s.coverMetricLabel}>Y1 Total ROE</Text>
            <Text style={[s.coverMetricValue, { fontSize: 13, color: C.green }]}>{fmtPct(d.r1)}</Text>
            <Text style={s.coverMetricSub}>REP + bonus dep</Text>
          </View>
          <View style={s.coverMetricBox}>
            <Text style={s.coverMetricLabel}>Pre-tax Cash Flow</Text>
            <Text style={[s.coverMetricValue, { fontSize: 13, color: d.CF < 0 ? C.red : C.green }]}>{fmtNeg(d.CF)}</Text>
            <Text style={s.coverMetricSub}>after debt service</Text>
          </View>
          <View style={s.coverMetricBox}>
            <Text style={s.coverMetricLabel}>Equity Required</Text>
            <Text style={[s.coverMetricValue, { fontSize: 13 }]}>{fmtDollar(d.eq)}</Text>
            <Text style={s.coverMetricSub}>down + lender fee</Text>
          </View>
        </View>

        <Text style={s.coverFooter}>Scenario: {scenarioName}  ·  {methodLabel}  ·  Prepared {date}</Text>
        <Text style={s.coverConfidential}>CONFIDENTIAL — For Discussion Purposes Only</Text>
      </Page>

      {/* ── P&L + Tax ──────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} />

        <SectionHdr title="Key metrics" />
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>NOI</Text>
            <Text style={[s.metricValue, { color: C.blue }]}>{fmtDollar(d.NOI)}</Text>
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
            <Text style={[s.metricValue, { color: d.CF < 0 ? C.red : C.green }]}>{fmtNeg(d.CF)}</Text>
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
            <Text style={[s.metricValue, { color: C.green }]}>{fmtPct(d.r1)}</Text>
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
                <Text style={[s.metricValue, { fontSize: 12, color: d.coc < 0 ? C.red : C.green }]}>{fmtPct(d.coc)}</Text>
              </View>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>After-tax CoC</Text>
                <Text style={[s.metricValue, { fontSize: 12, color: C.green }]}>{fmtPct(d.atc)}</Text>
              </View>
            </View>
            <View style={s.metricsRow}>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>Y1 total ROE</Text>
                <Text style={[s.metricValue, { fontSize: 12, color: C.green }]}>{fmtPct(d.r1)}</Text>
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

        {/* ── Tax Benefit Bank ─────────────────────────────────────── */}
        {d.brk > 0 && (inputs.costSeg > 0 || inputs.land < 100) && (() => {
          const bracket = d.brk / 100
          const bonusSav = d.bd * bracket
          const slAnnual = d.sl * bracket
          const monthlyCF = d.CF / 12
          const fullSL = d.deprBase / 27.5
          const slMonthly = slAnnual / 12

          const fmtV = (v: number) => Math.abs(v) < 0.5 ? '—' : v < 0 ? `(${fmtDollar(Math.abs(v))})` : fmtDollar(v)
          const negColor = (v: number) => Math.abs(v) < 0.5 ? C.textMuted : v < 0 ? '#DC2626' : '#15803D'

          // Annual benefit bank rows
          type AR = { period: string; pretax: number; slAdded: number; drawn: number; balance: number; note: string; negBal?: boolean; exhaustRow?: boolean }
          const aRows: AR[] = []
          let bal = bonusSav
          let exhausted = false
          // Y1
          for (let m = 0; m < 12; m++) { bal += slMonthly + monthlyCF }
          const y1Drawn = d.CF < 0 ? Math.abs(d.CF) : 0
          let note1 = ''
          if (bal < 0 && !exhausted) { note1 = 'Shield exhausted'; exhausted = true }
          aRows.push({ period: 'Year 1', pretax: d.CF, slAdded: slAnnual, drawn: y1Drawn, balance: bal, note: note1, negBal: bal < -0.5, exhaustRow: note1 !== '' })
          // Y2-5
          for (let y = 2; y <= 5; y++) {
            bal += slAnnual + d.CF
            let note = ''
            if (bal < 0 && !exhausted) { note = 'Shield exhausted'; exhausted = true }
            aRows.push({ period: `Year ${y}`, pretax: d.CF, slAdded: slAnnual, drawn: d.CF < 0 ? Math.abs(d.CF) : 0, balance: bal, note, negBal: bal < -0.5, exhaustRow: note !== '' })
          }
          const totDrawn = aRows.reduce((s, r) => s + r.drawn, 0)
          const totRow = { period: '5-Year Total', pretax: d.CF * 5, slAdded: slAnnual * 5, drawn: totDrawn, balance: bal }

          // Chart lines — benefit bank model, 60 months
          const line1: number[] = [], line2: number[] = []
          let b1 = bonusSav, b2 = 0
          const slOnlyMo = (fullSL * bracket) / 12
          for (let m = 0; m < 60; m++) {
            b1 += slMonthly + monthlyCF
            b2 += slOnlyMo + monthlyCF
            line1.push(Math.round(b1)); line2.push(Math.round(b2))
          }
          const ext1 = line1.findIndex(v => v < 0)
          const allVals = [...line1, ...line2]
          const yMax = Math.max(...allVals, 1000), yMin = Math.min(...allVals, -1000)
          const yRange = yMax - yMin || 1
          const PC = { bonus: '#0072B2', sl: '#E69F00', exhaust: '#D85A30' }
          const W = 480, H = 110, PX = 30, PY = 8
          const toX = (i: number) => PX + (i / 59) * (W - PX * 2)
          const toY = (v: number) => PY + (1 - (v - yMin) / yRange) * (H - PY * 2)
          const zeroY = toY(0)
          const toPath = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

          return (
            <>
              {/* Opening balance banner */}
              <View style={{ backgroundColor: '#EFF6FF', borderWidth: 0.5, borderColor: '#93C5FD', borderRadius: 4, padding: '6 10', marginTop: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E40AF' }}>Day 1 Tax Benefit Bank: {fmtDollar(bonusSav)}</Text>
                <Text style={{ fontSize: 7.5, color: '#3B82F6', marginTop: 1 }}>Funded by bonus depreciation on {fmtDollar(d.bd)} of cost-segregated assets at {d.brk}% bracket</Text>
              </View>

              {/* Annual table */}
              <SectionHdr title="5-Year Benefit Bank" />
              <View style={[s.table, { marginBottom: 6 }]}>
                <View style={[s.tableHdrRow, { backgroundColor: '#1a1a2e' }]}>
                  <Text style={[s.tableHdrCell, { flex: 1, color: 'white' }]}>Period</Text>
                  <Text style={[s.tableHdrCell, { flex: 1.2, textAlign: 'right', color: 'white' }]}>Pre-Tax CF</Text>
                  <Text style={[s.tableHdrCell, { flex: 1.2, textAlign: 'right', color: 'white' }]}>SL Dep Added</Text>
                  <Text style={[s.tableHdrCell, { flex: 1.2, textAlign: 'right', color: 'white' }]}>Drawn</Text>
                  <Text style={[s.tableHdrCell, { flex: 1.3, textAlign: 'right', color: 'white' }]}>Balance</Text>
                  <Text style={[s.tableHdrCell, { flex: 1.2, color: 'white' }]}>Notes</Text>
                </View>
                {aRows.map((r, i) => (
                  <View key={i} style={[s.tableRow, { backgroundColor: r.exhaustRow ? '#FFFBEB' : r.negBal ? '#FEF2F2' : i === 0 ? '#EFF6FF' : i % 2 === 0 ? '#fff' : '#f8f8f8' }]}>
                    <Text style={[s.tableCell, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>{r.period}</Text>
                    <Text style={[s.tableCellR, { flex: 1.2, color: negColor(r.pretax) }]}>{fmtV(r.pretax)}</Text>
                    <Text style={[s.tableCellR, { flex: 1.2, color: negColor(r.slAdded) }]}>{fmtV(r.slAdded)}</Text>
                    <Text style={[s.tableCellR, { flex: 1.2, color: r.drawn > 0.5 ? '#DC2626' : C.textMuted }]}>{r.drawn > 0.5 ? `(${fmtDollar(r.drawn)})` : '—'}</Text>
                    <Text style={[s.tableCellR, { flex: 1.3, fontFamily: 'Helvetica-Bold', color: negColor(r.balance) }]}>{fmtV(r.balance)}</Text>
                    <Text style={[s.tableCell, { flex: 1.2, fontSize: 7, color: r.note ? '#DC2626' : C.textMuted }]}>{r.note}</Text>
                  </View>
                ))}
                <View style={[s.tableRow, { backgroundColor: '#1a1a2e' }]}>
                  <Text style={[s.tableCell, { flex: 1, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{totRow.period}</Text>
                  <Text style={[s.tableCellR, { flex: 1.2, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{fmtV(totRow.pretax)}</Text>
                  <Text style={[s.tableCellR, { flex: 1.2, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{fmtV(totRow.slAdded)}</Text>
                  <Text style={[s.tableCellR, { flex: 1.2, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{totRow.drawn > 0.5 ? `(${fmtDollar(totRow.drawn)})` : '—'}</Text>
                  <Text style={[s.tableCellR, { flex: 1.3, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{fmtV(totRow.balance)}</Text>
                  <Text style={[s.tableCell, { flex: 1.2, color: 'white' }]}></Text>
                </View>
              </View>

              {/* SVG chart — Lines 1 & 2 only */}
              <SectionHdr title="Tax Benefit Bank — 5 Year Projection" />
              <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                {Array.from({ length: 60 }, (_, i) => (
                  <SvgLine key={i} x1={toX(i)} y1={PY} x2={toX(i)} y2={H - PY}
                    strokeWidth={(i + 1) % 12 === 0 ? 1 : 0.3} stroke={(i + 1) % 12 === 0 ? '#999' : '#ddd'} />
                ))}
                <SvgLine x1={PX} y1={zeroY} x2={W - PX} y2={zeroY} strokeWidth={1.5} stroke="#333" />
                <Path d={toPath(line2)} fill="none" stroke={PC.sl} strokeWidth={1.5} strokeDasharray="6,3" />
                <Path d={toPath(line1)} fill="none" stroke={PC.bonus} strokeWidth={2.5} />
                {/* Day 1 dot */}
                <Circle cx={toX(0)} cy={toY(line1[0])} r={5} fill={PC.bonus} />
                {/* Exhaustion dot */}
                {ext1 >= 0 && <Circle cx={toX(ext1)} cy={toY(line1[ext1])} r={5} fill={PC.exhaust} />}
              </Svg>
              {/* Inline end labels + legend */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 8, height: 8, backgroundColor: PC.bonus, borderRadius: 1 }} />
                    <Text style={{ fontSize: 6.5, color: C.text }}>Bonus Dep + Cost Seg — benefit loaded Day 1</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={{ width: 8, height: 8, backgroundColor: PC.sl, borderRadius: 1 }} />
                    <Text style={{ fontSize: 6.5, color: C.text }}>SL Only — accrues monthly over 27.5yr</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {ext1 >= 0 && <Text style={{ fontSize: 6.5, color: PC.exhaust }}>Shield exhausted Mo {ext1 + 1}</Text>}
                </View>
              </View>
            </>
          )
        })()}
      </Page>

      {/* ── Side by side: actual scenarios ──────────────────────────────── */}
      {allCols.length > 1 && (
      <Page size="LETTER" style={s.page}>
        <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} />
        <SectionHdr title="Side-by-side: scenario comparison" />
        <View style={s.table}>
          <View style={s.tableHdrRow}>
            <Text style={[s.tableHdrCell, { flex: 2.5 }]}>Line item</Text>
            {allCols.map((col, i) => (
              <Text key={i} style={[s.tableHdrCell, {
                color: i === 0 ? C.blue : i === 1 ? C.amber : i === 2 ? C.green : '#6B21A8',
                textAlign: 'right', flex: 1 }]}>
                {col.label}
              </Text>
            ))}
            {allCols.length > 1 && <Text style={[s.tableHdrCell, { textAlign: 'right', flex: 0.8 }]}>vs A</Text>}
          </View>
          {(() => {
            const calcs = allCols.map(col => calculate(col.inputs, col.method === 'om'))
            const base = calcs[0]
            // Purchase Price row (uses inputs, not calcs)
            const priceRow = (
              <View style={[s.tableRow, { backgroundColor: '#EDF2F7' }]}>
                <Text style={[s.tableCell, { flex: 2.5, fontFamily: 'Helvetica-Bold', paddingLeft: 6, color: C.text }]}>
                  Purchase Price
                </Text>
                {allCols.map((col, ci) => (
                  <Text key={ci} style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold',
                    color: ci === 0 ? C.blue : ci === 1 ? C.amber : ci === 2 ? C.green : '#6B21A8' }]}>
                    {fmtDollar(col.inputs.price)}
                  </Text>
                ))}
                {allCols.length > 1 && (
                  <Text style={[s.tableCellR, { flex: 0.8, fontFamily: 'Helvetica-Bold',
                    color: allCols[allCols.length-1].inputs.price - allCols[0].inputs.price > 0 ? C.red
                      : allCols[allCols.length-1].inputs.price - allCols[0].inputs.price < 0 ? C.green : C.textMuted }]}>
                    {fmtDelta(allCols[allCols.length-1].inputs.price - allCols[0].inputs.price)}
                  </Text>
                )}
              </View>
            )
            const rows = [
              { label: 'Gross potential rent', get: (d: typeof base) => fmtDollar(d.GSR), delta: (d: typeof base) => d.GSR - base.GSR },
              { label: '  Less: vacancy', get: (d: typeof base) => `(${fmtDollar(d.vac)})`, delta: (d: typeof base) => base.vac - d.vac },
              { label: '  Collected rental income', get: (d: typeof base) => fmtDollar(d.col), delta: (d: typeof base) => d.col - base.col },
              { label: 'Effective gross income', get: (d: typeof base) => fmtDollar(d.EGI), delta: (d: typeof base) => d.EGI - base.EGI, bold: true },
              { label: 'Total expenses', get: (d: typeof base) => `(${fmtDollar(d.exp)})`, delta: (d: typeof base) => base.exp - d.exp },
              { label: 'NOI', get: (d: typeof base) => fmtDollar(d.NOI), delta: (d: typeof base) => d.NOI - base.NOI, bold: true },
              { label: 'Annual debt service', get: (d: typeof base) => `(${fmtDollar(d.ds)})`, delta: () => 0, noD: true },
              { label: 'Pre-tax cash flow', get: (d: typeof base) => fmtNeg(d.CF), delta: (d: typeof base) => d.CF - base.CF },
              { label: 'After-tax cash flow', get: (d: typeof base) => fmtNeg(d.at), delta: (d: typeof base) => d.at - base.at },
              { label: 'Cap rate', get: (d: typeof base) => fmtPct(d.cap), delta: (d: typeof base) => d.cap - base.cap, pct: true },
              { label: 'DCR', get: (d: typeof base) => fmtX(d.dcr), delta: (d: typeof base) => d.dcr - base.dcr, x: true },
              { label: 'Y1 total ROE', get: (d: typeof base) => fmtPct(d.r1), delta: (d: typeof base) => d.r1 - base.r1, pct: true, bold: true },
            ]
            return <>{priceRow}{rows.map((row, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { flex: 2.5,
                  fontFamily: row.bold ? 'Helvetica-Bold' : 'Helvetica',
                  paddingLeft: row.label.startsWith('  ') ? 16 : 6,
                  color: row.label.startsWith('  ') ? C.textLight : C.text }]}>
                  {row.label.trim()}
                </Text>
                {calcs.map((calc, ci) => (
                  <Text key={ci} style={[s.tableCellR, { flex: 1,
                    color: ci === 0 ? C.blue : ci === 1 ? C.amber : ci === 2 ? C.green : '#6B21A8' }]}>
                    {row.get(calc)}
                  </Text>
                ))}
                {allCols.length > 1 && (
                  <Text style={[s.tableCellR, { flex: 0.8,
                    color: row.noD ? C.textMuted : row.delta(calcs[calcs.length-1]) > 50 ? C.green : row.delta(calcs[calcs.length-1]) < -50 ? C.red : C.textMuted,
                    fontFamily: 'Helvetica-Bold' }]}>
                    {row.noD ? '—' : row.pct ? fmtDeltaPct(row.delta(calcs[calcs.length-1])) : row.x ? ((row.delta(calcs[calcs.length-1]) >= 0 ? '+' : '') + row.delta(calcs[calcs.length-1]).toFixed(2) + '×') : fmtDelta(row.delta(calcs[calcs.length-1]))}
                  </Text>
                )}
              </View>
            ))}</>
          })()}
        </View>

        <Text style={s.disclaimer}>
          For discussion purposes only. Tax savings assume REP status (IRC §469), 100% bonus depreciation (OBBBA P.L. 119-21,
          IRS Notice 2026-11), and 1031 exchange carryover basis at purchase price. Actual depreciation depends on cost
          segregation study and verified exchange basis. Consult a licensed CPA before making investment or tax decisions.
          Property tax estimate reflects post-sale Florida reassessment — verify with county Property Appraiser.
        </Text>
      </Page>
      )}

    </Document>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ── Export function ───────────────────────────────────────────────────────
export async function generatePDF(
  inputs: ModelInputs,
  method: Method,
  propertyName: string,
  address: string,
  units: number,
  yearBuilt: number,
  scenarioName: string,
  scenarioCols?: ScenarioCol[],
  propertyImageUrl?: string
): Promise<void> {
  // Pre-fetch property image as base64 to avoid CORS issues in @react-pdf/renderer
  let imageData: string | undefined
  if (propertyImageUrl) {
    const b64 = await fetchImageAsBase64(propertyImageUrl)
    if (b64) imageData = b64
  }

  const blob = await pdf(
    <ReportDocument
      inputs={inputs}
      method={method}
      propertyName={propertyName}
      address={address}
      units={units}
      yearBuilt={yearBuilt}
      scenarioName={scenarioName}
      scenarioCols={scenarioCols}
      propertyImageUrl={imageData}
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
