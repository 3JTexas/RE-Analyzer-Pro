import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import type { ModelInputs, Method } from '../../types'
import { calculate, calc1031, fmtDollar, fmtNeg, fmtPct, fmtX, fmtDelta, fmtDeltaPct } from '../../lib/calc'

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
  page: { fontFamily: 'Helvetica', fontSize: 9, color: C.text, paddingTop: '0.6in', paddingBottom: '0.5in', paddingHorizontal: '0.5in' },
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

  pageHeader: { borderBottomWidth: 1.5, borderBottomColor: C.accent, paddingBottom: 6,
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
  logoSrc?: string
  tabLabel?: string
}

function PageHdr({ propertyName, address, scenarioName, method, date, logoSrc, tabLabel }: HdrProps) {
  return (
    <View style={{ marginBottom: 14 }} fixed>
      {logoSrc && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Image src={logoSrc} style={{ width: 100 }} />
          {tabLabel && <Text style={{ fontSize: 10, color: C.accent, fontFamily: 'Helvetica-Bold' }}>{tabLabel}</Text>}
        </View>
      )}
      <View style={s.pageHeader}>
        <Text style={s.pageHeaderLeft}>{propertyName.toUpperCase()}  ·  {address}</Text>
        <Text style={s.pageHeaderRight}>{scenarioName} · {method} · {date}</Text>
      </View>
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
export interface ScenarioCol {
  label: string
  inputs: ModelInputs
  method: Method
}

export type ExportTab = 'full' | 'pl' | 'tax' | 'flags' | 'om' | 'inputs'

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
  exportTab?: ExportTab
}

function deriveMethodLabel(inputs: ModelInputs, method: Method, label?: string): string {
  // If scenario name indicates OM As-Presented, use that
  if (label && /om\s*as[- ]?presented/i.test(label)) return 'OM As-Presented'
  // Auto-derive from occupancy
  if (inputs.ou > 0 && inputs.ou < inputs.tu) return 'Physical Occupancy'
  return method === 'om' ? 'OM Method' : 'Physical Occupancy'
}

export { type ReportProps }

export function ReportDocument({ inputs, method, propertyName, address, units, yearBuilt, scenarioName, scenarioCols = [], propertyImageUrl, exportTab = 'full' }: ReportProps) {
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

  const showCover = exportTab === 'full'
  const showPL    = exportTab === 'full' || exportTab === 'pl'
  const showTax   = exportTab === 'full' || exportTab === 'tax'
  const showFlags = exportTab === 'full' || exportTab === 'flags'
  const showOM    = exportTab === 'full' || exportTab === 'om'
  const showInputs = exportTab === 'full' || exportTab === 'inputs'
  const showRentRoll = exportTab === 'full'
  const showCompare  = exportTab === 'full'

  // Watermark component — property photo centered at 30% opacity on every non-cover page
  const Watermark = () => propertyImageUrl ? (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} fixed>
      <Image src={propertyImageUrl} style={{ width: 350, height: 350, objectFit: 'contain', opacity: 0.08 }} />
    </View>
  ) : null

  // Tax benefit table renderer — used by both standalone tax page and full report
  const renderTaxBenefitTable = () => {
    if (!(d.brk > 0 && (inputs.costSeg > 0 || inputs.land < 100))) return null
    const bracket = d.brk / 100
    const bonusDeprBase = d.deprBase * (inputs.costSeg / 100)
    const slDeprBase = d.deprBase - bonusDeprBase
    const bonusDeprSavings = bonusDeprBase * bracket
    const slAnnualDepr = slDeprBase / 27.5
    const slAnnualSavings = slAnnualDepr * bracket
    const preTaxCF = d.NOI - d.ds
    const preTaxTaxSavings = Math.abs(Math.min(preTaxCF, 0)) * bracket
    const afterTaxY1 = preTaxCF + bonusDeprSavings + slAnnualSavings + preTaxTaxSavings
    const afterTaxY2 = preTaxCF + slAnnualSavings + preTaxTaxSavings

    type TR = { yr: number; ptCF: number; bonus: number; sl: number; opLoss: number; total: number; cum: number; isExhaust: boolean }
    const rows: TR[] = []
    let cum = 0
    let exhaustYear = 0
    for (let yr = 1; yr <= 30; yr++) {
      const bonus = yr === 1 ? bonusDeprSavings : 0
      const total = yr === 1 ? afterTaxY1 : afterTaxY2
      cum += total
      const isExhaust = exhaustYear === 0 && cum <= 0 && yr > 1
      if (isExhaust) exhaustYear = yr
      rows.push({ yr, ptCF: preTaxCF, bonus, sl: slAnnualSavings, opLoss: preTaxTaxSavings, total, cum, isExhaust })
      if (exhaustYear > 0 && yr >= Math.max(exhaustYear, 3)) break
      if (yr >= 30) break
    }
    const showRows = exhaustYear > 0 ? rows : rows.slice(0, 10)
    const neverExhausted = exhaustYear === 0
    const fmtV = (v: number) => Math.abs(v) < 0.5 ? '\u2014' : v < 0 ? `(${fmtDollar(Math.abs(v))})` : fmtDollar(v)
    const vc = (v: number) => Math.abs(v) < 0.5 ? '#9CA3AF' : v < 0 ? '#DC2626' : '#15803D'
    const totPt = showRows.reduce((a, r) => a + r.ptCF, 0)
    const totBonus = bonusDeprSavings
    const totSl = showRows.reduce((a, r) => a + r.sl, 0)
    const totOp = showRows.reduce((a, r) => a + r.opLoss, 0)
    const totTotal = showRows.reduce((a, r) => a + r.total, 0)
    const y1Total = bonusDeprSavings + slAnnualSavings + preTaxTaxSavings
    const y2Total = slAnnualSavings + preTaxTaxSavings
    const exLabel = neverExhausted ? '30+ Years' : `Year ${exhaustYear}`

    return (
      <>
        <Text style={{ fontSize: 9, color: '#444444', marginBottom: 4, marginTop: 8, lineHeight: 1.5 }}>
          Year 1 delivers a one-time tax benefit of {fmtDollar(y1Total)} through bonus depreciation on {fmtDollar(bonusDeprBase)} of cost-segregated assets at a {d.brk}% bracket — a real cash return from reduced tax liability on other income.
        </Text>
        <Text style={{ fontSize: 9, color: '#444444', marginBottom: 10, lineHeight: 1.5 }}>
          Ongoing straight-line depreciation generates {fmtDollar(slAnnualSavings)}/year through Year {Math.floor(27.5)} before the depreciable basis is fully recovered.{' '}
          {neverExhausted
            ? 'The after-tax benefit is not exhausted within 30 years.'
            : `The after-tax benefit exhausts in Year ${exhaustYear} when the cumulative balance reaches zero.`}
        </Text>
        <View style={s.metricsRow}>
          <View style={[s.metricCard, { backgroundColor: '#f8f8f8', borderWidth: 0.5, borderColor: '#e0e0e0' }]}>
            <Text style={{ fontSize: 7, color: '#888', marginBottom: 3 }}>Year 1 Tax Benefit</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#1a1a2e' }}>{fmtDollar(y1Total)}</Text>
            <Text style={{ fontSize: 7, color: '#888', marginTop: 3 }}>Bonus dep + SL dep + op loss savings</Text>
          </View>
          <View style={[s.metricCard, { backgroundColor: '#f8f8f8', borderWidth: 0.5, borderColor: '#e0e0e0' }]}>
            <Text style={{ fontSize: 7, color: '#888', marginBottom: 3 }}>Annual Ongoing (Yr 2+)</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#1a1a2e' }}>{fmtDollar(y2Total)}</Text>
            <Text style={{ fontSize: 7, color: '#888', marginTop: 3 }}>SL dep savings each year after Year 1</Text>
          </View>
          <View style={[s.metricCard, { backgroundColor: '#f8f8f8', borderWidth: 0.5, borderColor: '#e0e0e0' }]}>
            <Text style={{ fontSize: 7, color: '#888', marginBottom: 3 }}>Benefit Exhausted</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#1a1a2e' }}>{exLabel}</Text>
            <Text style={{ fontSize: 7, color: '#888', marginTop: 3 }}>When cumulative after-tax returns to zero</Text>
          </View>
        </View>
        <SectionHdr title="After-Tax Cash Flow — Year-by-Year" />
        <View style={[s.table, { marginBottom: 4 }]}>
          <View style={[s.tableHdrRow, { backgroundColor: '#1a1a2e' }]}>
            <Text style={[s.tableHdrCell, { width: 28, color: 'white' }]}>Yr</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Pre-Tax CF</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Bonus Dep</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>SL Dep</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Op. Loss</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>After-Tax</Text>
            <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Cumulative</Text>
          </View>
          {showRows.map((r, i) => (
            <View key={i} style={[s.tableRow, { backgroundColor: r.isExhaust ? '#FEF2F2' : r.yr === 1 ? '#EFF6FF' : i % 2 === 0 ? '#fff' : '#f9f9f9' }]}>
              <Text style={[s.tableCell, { width: 28, fontFamily: 'Helvetica-Bold' }]}>{r.yr}</Text>
              <Text style={[s.tableCellR, { flex: 1, color: vc(r.ptCF) }]}>{fmtV(r.ptCF)}</Text>
              <Text style={[s.tableCellR, { flex: 1, color: r.bonus > 0.5 ? '#15803D' : '#9CA3AF' }]}>{r.bonus > 0.5 ? fmtDollar(r.bonus) : '\u2014'}</Text>
              <Text style={[s.tableCellR, { flex: 1, color: '#15803D' }]}>{fmtV(r.sl)}</Text>
              <Text style={[s.tableCellR, { flex: 1, color: r.opLoss > 0.5 ? '#15803D' : '#9CA3AF' }]}>{r.opLoss > 0.5 ? fmtDollar(r.opLoss) : '\u2014'}</Text>
              <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: vc(r.total) }]}>{fmtV(r.total)}</Text>
              <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: vc(r.cum) }]}>{fmtV(r.cum)}{r.isExhaust ? ' *' : ''}</Text>
            </View>
          ))}
          <View style={[s.tableRow, { backgroundColor: '#1a1a2e' }]}>
            <Text style={[s.tableCell, { width: 28, fontFamily: 'Helvetica-Bold', color: 'white' }]}>Tot</Text>
            <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{fmtV(totPt)}</Text>
            <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{fmtDollar(totBonus)}</Text>
            <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{fmtV(totSl)}</Text>
            <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{totOp > 0.5 ? fmtDollar(totOp) : '\u2014'}</Text>
            <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{fmtV(totTotal)}</Text>
            <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: 'white' }]}>{fmtV(showRows[showRows.length - 1].cum)}</Text>
          </View>
        </View>
        {neverExhausted && (
          <Text style={{ fontSize: 7, color: '#888', fontFamily: 'Helvetica-Oblique', marginBottom: 4 }}>
            * Benefit not exhausted within {showRows.length} years shown. Cumulative after-tax balance remains positive.
          </Text>
        )}
        <Text style={{ fontSize: 7, color: '#888', fontFamily: 'Helvetica-Oblique', marginTop: 4, lineHeight: 1.5 }}>
          Bonus depreciation reflects 100% first-year deduction on cost-segregated assets at stated bracket. Straight-line depreciation continues over 27.5 years. Operating loss savings apply only when pre-tax cash flow is negative. Tax benefit &quot;exhaustion&quot; represents the point at which cumulative after-tax returns equal zero — the property then relies solely on pre-tax cash flow. Consult a licensed CPA before making tax or investment decisions.
        </Text>
      </>
    )
  }

  // Flags computation (for flags page)
  const computeFlagsForPdf = () => {
    interface PdfFlag { severity: 'red' | 'amber' | 'info'; title: string; detail: string; omVal: string; benchmark: string; noImpact?: string }
    const flags: PdfFlag[] = []
    const age = yearBuilt ? new Date().getFullYear() - yearBuilt : null
    if (inputs.price > 0 && inputs.tax > 0) {
      const effectiveRate = (inputs.tax / inputs.price) * 100
      if (effectiveRate < 1.8) {
        const projectedTax = inputs.price * 0.020
        const delta = projectedTax - inputs.tax
        flags.push({ severity: effectiveRate < 1.2 ? 'red' : 'amber', title: 'Property taxes likely understated (pre-sale assessment)',
          detail: `Effective tax rate is ${effectiveRate.toFixed(2)}% of purchase price. Post-purchase taxes will be ~$${Math.round(projectedTax).toLocaleString()}/yr.`,
          omVal: `$${inputs.tax.toLocaleString()} (${effectiveRate.toFixed(2)}% of price)`, benchmark: `~$${Math.round(projectedTax).toLocaleString()} (~2.0%)`, noImpact: `($${Math.round(delta).toLocaleString()}) NOI` })
      }
    }
    if (inputs.tu > 0 && inputs.ou > 0 && inputs.ou < inputs.tu) {
      const physVac = ((inputs.tu - inputs.ou) / inputs.tu) * 100
      if (physVac > inputs.vp) {
        const gsr = inputs.rent * inputs.tu * 12
        flags.push({ severity: 'red', title: 'Physical vacancy exceeds stated vacancy rate',
          detail: `${inputs.tu - inputs.ou} of ${inputs.tu} units vacant (${physVac.toFixed(1)}%).`,
          omVal: `${inputs.vp}% vacancy`, benchmark: `${physVac.toFixed(1)}% physical`, noImpact: `($${Math.round(gsr * (physVac - inputs.vp) / 100).toLocaleString()}) EGI` })
      }
    }
    if (inputs.tu > 0 && inputs.ins > 0) {
      const bm = age && age > 60 ? 3000 : age && age > 40 ? 2500 : 2000
      if (inputs.ins < bm) flags.push({ severity: inputs.ins < 2000 ? 'red' : 'amber', title: 'Insurance may be understated',
        detail: `$${inputs.ins.toLocaleString()}/door vs $${bm.toLocaleString()}+ benchmark.`,
        omVal: `$${inputs.ins.toLocaleString()}/door`, benchmark: `$${bm.toLocaleString()}+/door`, noImpact: `($${((bm - inputs.ins) * inputs.tu).toLocaleString()}) NOI` })
    }
    if (inputs.tu > 0 && inputs.rm >= 0) {
      const bm = age && age > 60 ? 900 : age && age > 40 ? 700 : 500
      if (inputs.rm < bm) flags.push({ severity: inputs.rm < bm * 0.6 ? 'red' : 'amber', title: `R&M understated for ${age ? age + '-year-old' : 'older'} building`,
        detail: `$${inputs.rm}/unit/yr vs $${bm}+ benchmark.`,
        omVal: `$${inputs.rm}/unit/yr`, benchmark: `$${bm}+/unit/yr`, noImpact: `($${((bm - inputs.rm) * inputs.tu).toLocaleString()}) NOI` })
    }
    if (inputs.tu > 0 && inputs.res >= 0) {
      const bm = age && age > 60 ? 700 : age && age > 40 ? 500 : 350
      if (inputs.res < bm) flags.push({ severity: inputs.res < bm * 0.5 ? 'red' : 'amber', title: `Reserves understated for ${age ? age + '-year-old' : 'older'} building`,
        detail: `$${inputs.res}/unit/yr vs $${bm}+ benchmark.`,
        omVal: `$${inputs.res}/unit/yr`, benchmark: `$${bm}+/unit/yr`, noImpact: `($${((bm - inputs.res) * inputs.tu).toLocaleString()}) NOI` })
    }
    // Stressed scenario
    const projTax = inputs.price > 0 ? inputs.price * 0.020 : inputs.tax
    const insB = age && age > 60 ? 3000 : age && age > 40 ? 2500 : 2000
    const rmB = age && age > 60 ? 900 : age && age > 40 ? 700 : 500
    const resB = age && age > 60 ? 700 : age && age > 40 ? 500 : 350
    const stressedInputs = { ...inputs, tax: Math.max(inputs.tax, projTax), ins: Math.max(inputs.ins, insB), rm: Math.max(inputs.rm, rmB), res: Math.max(inputs.res, resB) }
    const ds = calculate(stressedInputs, true)
    return { flags, stressed: ds }
  }

  return (
    <Document title={`${propertyName} — ${scenarioName} — Investment Analysis`}>

      {/* ── Cover ──────────────────────────────────────────────────────── */}
      {showCover && <Page size="LETTER" style={s.coverPage}>
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
      </Page>}

      {/* ── P&L + Tax ──────────────────────────────────────────────────── */}
      {/* ── P&L standalone page (tab-specific export) ─────────────────── */}
      {exportTab === 'pl' && <Page size="LETTER" style={s.page}>
        <Watermark />
        <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} logoSrc={logoSrc} tabLabel="P&L" />

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

        <SectionHdr title="Cash to close" />
        <PLRowComp label="Down payment" value={fmtDollar(d.down)} />
        <PLRowComp label="Lender origination fee" value={d.lfee > 0 ? `(${fmtDollar(d.lfee)})` : '$0'} variant="neg" indent />
        {d.ccAmt > 0 && <PLRowComp label={`Closing costs (${inputs.cc}%)`} value={`(${fmtDollar(d.ccAmt)})`} variant="neg" indent />}
        <PLRowComp label="Est. total cash to close" value={fmtDollar(d.eq + d.ccAmt)} variant="total" />
      </Page>}

      {/* ── Tax standalone page (tab-specific export) ─────────────────── */}
      {exportTab === 'tax' && <Page size="LETTER" style={s.page}>
        <Watermark />
        <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} logoSrc={logoSrc} tabLabel="Tax" />

        {/* Tax Strategy Summary */}
        <SectionHdr title="Tax strategy inputs" />
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Tax Bracket</Text>
            <Text style={s.metricValue}>{inputs.brk}%</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Land %</Text>
            <Text style={s.metricValue}>{inputs.land}%</Text>
            <Text style={s.metricSub}>non-depreciable</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Cost Seg %</Text>
            <Text style={s.metricValue}>{inputs.costSeg}%</Text>
            <Text style={s.metricSub}>5/7/15-yr assets</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>1031 Exchange</Text>
            <Text style={s.metricValue}>{inputs.is1031 ? 'Yes' : 'No'}</Text>
            {inputs.is1031 && <Text style={s.metricSub}>carryover basis</Text>}
          </View>
        </View>

        {/* 1031 Exchange Analysis */}
        {inputs.is1031 && (inputs.priorSalePrice ?? 0) > 0 && (() => {
          const ex = calc1031(inputs)
          if (!ex) return null
          const cgRate = inputs.cgRate ?? 20
          const reclaimRate = inputs.reclaimRate ?? 25
          return (
            <>
              <SectionHdr title="1031 Exchange analysis" />
              <PLRowComp label="Prior sale price" value={fmtDollar(inputs.priorSalePrice ?? 0)} />
              <PLRowComp label={`Selling costs (${inputs.priorSellingCostsPct ?? 5}%)`} value={`(${fmtDollar((inputs.priorSalePrice ?? 0) * (inputs.priorSellingCostsPct ?? 5) / 100)})`} variant="neg" indent />
              <PLRowComp label="Mortgage payoff" value={`(${fmtDollar(inputs.priorMortgagePayoff ?? 0)})`} variant="neg" indent />
              <PLRowComp label="Adjusted basis" value={fmtDollar(ex.adjustedBasis)} />
              <PLRowComp label="Capital gain" value={fmtDollar(ex.capitalGain)} variant="total" />
              <PLRowComp label={`Cap gains tax deferred @ ${cgRate}%`} value={fmtDollar(ex.capGainsTax)} variant="pos" indent />
              <PLRowComp label={`Recapture tax deferred @ ${reclaimRate}%`} value={fmtDollar(ex.recaptureTax)} variant="pos" indent />
              <PLRowComp label="Total tax deferred" value={fmtDollar(ex.totalTaxDeferred)} variant="total" />
              <PLRowComp label="Net 1031 proceeds" value={fmtDollar(ex.netProceeds)} variant="noi" />
              <PLRowComp label={`Required down (${inputs.lev}% LTV)`} value={fmtDollar(ex.requiredDown)} indent />
              <PLRowComp label="Excess capital" value={ex.excessCapital > 0 ? fmtDollar(ex.excessCapital) : '$0'} variant={ex.excessCapital > 0 ? 'pos' : 'normal'} />

              {/* 1031 comparison — replaces bar chart */}
              <View style={[s.metricsRow, { marginTop: 8 }]}>
                <View style={[s.metricCard, { backgroundColor: '#FCEBEB', borderWidth: 0.5, borderColor: '#f09595' }]}>
                  <Text style={{ fontSize: 7, color: '#888', marginBottom: 3 }}>Sell &amp; Pay Tax</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.red }}>{fmtDollar(Math.max(0, ex.netProceeds - ex.totalTaxDeferred))}</Text>
                  <Text style={{ fontSize: 7, color: '#888', marginTop: 3 }}>Net after {fmtDollar(ex.totalTaxDeferred)} tax</Text>
                </View>
                <View style={[s.metricCard, { backgroundColor: '#EAF3DE', borderWidth: 0.5, borderColor: '#97c459' }]}>
                  <Text style={{ fontSize: 7, color: '#888', marginBottom: 3 }}>1031 Exchange</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.green }}>{fmtDollar(ex.netProceeds)}</Text>
                  <Text style={{ fontSize: 7, color: '#888', marginTop: 3 }}>Tax deferred — {fmtDollar(ex.totalTaxDeferred)} saved</Text>
                </View>
              </View>
            </>
          )
        })()}

        {/* Bonus Depreciation */}
        {inputs.price > 0 && d.brk > 0 && (() => {
          const bracket = d.brk / 100
          const depBasis = inputs.price * (1 - inputs.land / 100)
          const bonusDed = depBasis * (inputs.costSeg / 100)
          const slAnnual = (depBasis * (1 - inputs.costSeg / 100)) / 27.5
          const y1PaperLoss = d.NOI - bonusDed - slAnnual
          const y1TaxBenefit = Math.max(0, -y1PaperLoss) * bracket
          const slDepBasis = depBasis * (1 - inputs.costSeg / 100)
          const annualShield = (slDepBasis / 27.5) * bracket
          return (
            <>
              <SectionHdr title="Bonus depreciation — Year 1" />
              <PLRowComp label="Depreciable basis" value={fmtDollar(depBasis)} />
              <PLRowComp label={`Cost seg assets (${inputs.costSeg}%)`} value={fmtDollar(bonusDed)} variant="pos" indent />
              <PLRowComp label="Year 1 bonus deduction" value={fmtDollar(bonusDed)} variant="pos" />
              <PLRowComp label="Year 1 paper loss" value={y1PaperLoss < 0 ? `(${fmtDollar(Math.abs(y1PaperLoss))})` : fmtDollar(y1PaperLoss)} variant={y1PaperLoss < 0 ? 'pos' : 'normal'} indent />
              <PLRowComp label={`Year 1 tax benefit @ ${d.brk}%`} value={fmtDollar(y1TaxBenefit)} variant="total" />

              {/* 10-year NOI vs Taxable Income table — replaces bar chart */}
              <View style={[s.table, { marginTop: 6 }]}>
                <View style={[s.tableHdrRow, { backgroundColor: '#1a1a2e' }]}>
                  <Text style={[s.tableHdrCell, { width: 28, color: 'white' }]}>Yr</Text>
                  <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>NOI</Text>
                  <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Deductions</Text>
                  <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Taxable</Text>
                  <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Tax Shield</Text>
                </View>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(yr => {
                  const ded = yr === 1 ? bonusDed + slAnnual : slAnnual
                  const taxable = d.NOI - ded
                  const shield = Math.max(0, -taxable) * bracket
                  return (
                    <View key={yr} style={[s.tableRow, { backgroundColor: yr === 1 ? '#EFF6FF' : yr % 2 === 0 ? '#f9f9f9' : '#fff' }]}>
                      <Text style={[s.tableCell, { width: 28, fontFamily: 'Helvetica-Bold' }]}>{yr}</Text>
                      <Text style={[s.tableCellR, { flex: 1 }]}>{fmtDollar(d.NOI)}</Text>
                      <Text style={[s.tableCellR, { flex: 1, color: C.green }]}>({fmtDollar(ded)})</Text>
                      <Text style={[s.tableCellR, { flex: 1, color: taxable < 0 ? C.red : C.green }]}>{taxable < 0 ? `(${fmtDollar(Math.abs(taxable))})` : fmtDollar(taxable)}</Text>
                      <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: shield > 0 ? C.green : C.textMuted }]}>{shield > 0 ? fmtDollar(shield) : '\u2014'}</Text>
                    </View>
                  )
                })}
              </View>

              <SectionHdr title="27.5-Year straight-line depreciation" />
              <PLRowComp label="SL depreciable basis" value={fmtDollar(slDepBasis)} />
              <PLRowComp label="Annual SL deduction" value={fmtDollar(slDepBasis / 27.5)} variant="pos" indent />
              <PLRowComp label={`Annual tax shield @ ${d.brk}%`} value={fmtDollar(annualShield)} variant="total" />
              <PLRowComp label="Total shield over 27.5 yrs" value={fmtDollar(annualShield * 27.5)} variant="pos" indent />

              {/* Depreciation schedule — sampled years */}
              <View style={[s.table, { marginTop: 6 }]}>
                <View style={[s.tableHdrRow, { backgroundColor: '#1a1a2e' }]}>
                  <Text style={[s.tableHdrCell, { width: 28, color: 'white' }]}>Yr</Text>
                  <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Annual Deduction</Text>
                  <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Annual Shield</Text>
                  <Text style={[s.tableHdrCell, { flex: 1, textAlign: 'right', color: 'white' }]}>Cumulative Saved</Text>
                </View>
                {[1, 2, 5, 10, 15, 20, 25, 27, 28].map((yr, idx) => {
                  const annDed = yr <= 27 ? slDepBasis / 27.5 : yr === 28 ? (slDepBasis / 27.5) * 0.5 : slDepBasis / 27.5
                  const shield = yr <= 28 ? (yr <= 27 ? annualShield : annualShield * 0.5) : 0
                  const cum = yr <= 27 ? annualShield * yr : annualShield * 27 + annualShield * 0.5
                  return (
                    <View key={yr} style={[s.tableRow, { backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }]}>
                      <Text style={[s.tableCell, { width: 28, fontFamily: 'Helvetica-Bold' }]}>{yr}</Text>
                      <Text style={[s.tableCellR, { flex: 1, color: C.green }]}>{yr <= 28 ? fmtDollar(annDed) : '\u2014'}</Text>
                      <Text style={[s.tableCellR, { flex: 1, color: C.green }]}>{shield > 0 ? fmtDollar(shield) : '\u2014'}</Text>
                      <Text style={[s.tableCellR, { flex: 1, fontFamily: 'Helvetica-Bold', color: C.blue }]}>{fmtDollar(cum)}</Text>
                    </View>
                  )
                })}
              </View>
            </>
          )
        })()}

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
        {renderTaxBenefitTable()}
      </Page>}

      {/* ── P&L + Tax combined page (full report) ──────────────────────── */}
      {exportTab === 'full' && <Page size="LETTER" style={s.page}>
        <Watermark />
        <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} logoSrc={logoSrc} tabLabel="P&L + Tax" />

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

        {/* ── Tax Benefit — Dynamic Table ─────────────────────────── */}
        {renderTaxBenefitTable()}
      </Page>}

      {/* ── Rent roll page ──────────────────────────────────────────────── */}
      {showRentRoll && inputs.useRentRoll && (inputs.rentRoll ?? []).length > 0 && (
        <Page size="LETTER" style={s.page}>
          <Watermark />
          <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} logoSrc={logoSrc} tabLabel="Rent Roll" />
          <SectionHdr title="Rent roll" />
          <View style={s.table}>
            <View style={s.tableHdrRow}>
              <Text style={[s.tableHdrCell, { flex: 2 }]}>Unit</Text>
              <Text style={[s.tableHdrCell, { flex: 2 }]}>Type</Text>
              <Text style={[s.tableHdrCell, { flex: 1.2, textAlign: 'right' }]}>Sq Ft</Text>
              <Text style={[s.tableHdrCell, { flex: 1.5, textAlign: 'right' }]}>Rent/mo</Text>
              <Text style={[s.tableHdrCell, { flex: 2, textAlign: 'center' }]}>Lease End</Text>
            </View>
            {(inputs.rentRoll ?? []).map((u, i) => (
              <View key={u.id ?? i} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: C.bgLight } : {}, u.vacant ? { opacity: 0.4 } : {}]}>
                <Text style={[s.tableCell, { flex: 2 }]}>{u.label}{u.vacant ? ' (vacant)' : ''}</Text>
                <Text style={[s.tableCell, { flex: 2 }]}>{u.type}</Text>
                <Text style={[s.tableCell, { flex: 1.2, textAlign: 'right' }]}>{u.sqft ? u.sqft.toLocaleString() : '—'}</Text>
                <Text style={[s.tableCell, { flex: 1.5, textAlign: 'right', color: u.vacant ? C.textMuted : C.text }]}>
                  {u.rent ? `$${u.rent.toLocaleString()}` : '—'}
                </Text>
                <Text style={[s.tableCell, { flex: 2, textAlign: 'center' }]}>{u.leaseEnd ?? '—'}</Text>
              </View>
            ))}
            <View style={[s.tableRow, { backgroundColor: C.bgCard, borderTopWidth: 1, borderTopColor: C.border }]}>
              <Text style={[s.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>Total</Text>
              <Text style={[s.tableCell, { flex: 2 }]}></Text>
              <Text style={[s.tableCell, { flex: 1.2 }]}></Text>
              <Text style={[s.tableCell, { flex: 1.5, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                ${(inputs.rentRoll ?? []).filter(u => !u.vacant).reduce((sum, u) => sum + (u.rent || 0), 0).toLocaleString()}
              </Text>
              <Text style={[s.tableCell, { flex: 2 }]}></Text>
            </View>
          </View>
          <Text style={{ fontSize: 7.5, color: C.textMuted, marginTop: 6 }}>
            {(inputs.rentRoll ?? []).filter(u => !u.vacant).length} of {(inputs.rentRoll ?? []).length} units occupied · Annual gross: ${((inputs.rentRoll ?? []).filter(u => !u.vacant).reduce((sum, u) => sum + (u.rent || 0), 0) * 12).toLocaleString()}
          </Text>
        </Page>
      )}

      {/* ── Side by side: actual scenarios ──────────────────────────────── */}
      {showCompare && allCols.length > 1 && (
      <Page size="LETTER" style={s.page}>
        <Watermark />
        <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} logoSrc={logoSrc} tabLabel="Scenario Comparison" />
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

      {/* ── Flags page ─────────────────────────────────────────────────── */}
      {showFlags && (() => {
        const { flags, stressed } = computeFlagsForPdf()
        return (
          <Page size="LETTER" style={s.page}>
            <Watermark />
            <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} logoSrc={logoSrc} tabLabel="Flags" />
            <SectionHdr title="Underwriting flags" />
            {flags.length === 0 ? (
              <View style={[s.alertGreen, { marginTop: 8 }]}>
                <Text style={s.alertText}>No flags detected — all inputs within expected benchmarks</Text>
              </View>
            ) : (
              <>
                <View style={[s.alertRed, { marginBottom: 8 }]}>
                  <Text style={s.alertText}>{flags.filter(f => f.severity === 'red').length} high-risk · {flags.filter(f => f.severity === 'amber').length} watch items</Text>
                </View>
                {flags.map((flag, i) => (
                  <View key={i} style={[flag.severity === 'red' ? s.alertRed : flag.severity === 'amber' ? s.alertAmber : s.alertGreen, { marginBottom: 6 }]}>
                    <Text style={[s.alertText, { marginBottom: 3 }]}>{flag.title}</Text>
                    <Text style={{ fontSize: 8, color: C.textLight, marginBottom: 4 }}>{flag.detail}</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 7, color: C.textMuted }}>OM figure</Text>
                        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{flag.omVal}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 7, color: C.textMuted }}>Benchmark</Text>
                        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{flag.benchmark}</Text>
                      </View>
                    </View>
                    {flag.noImpact && <Text style={{ fontSize: 8, color: C.red, fontFamily: 'Helvetica-Bold', marginTop: 3 }}>NOI impact: {flag.noImpact}</Text>}
                  </View>
                ))}
                <SectionHdr title="Stressed scenario — benchmarks applied" />
                <View style={s.metricsRow}>
                  <View style={s.metricCard}>
                    <Text style={s.metricLabel}>Stressed NOI</Text>
                    <Text style={[s.metricValue, { color: C.red }]}>{fmtDollar(stressed.NOI)}</Text>
                    <Text style={s.metricSub}>{fmtDelta(stressed.NOI - d.NOI)} vs OM</Text>
                  </View>
                  <View style={s.metricCard}>
                    <Text style={s.metricLabel}>Stressed Cap</Text>
                    <Text style={s.metricValue}>{fmtPct(stressed.cap)}</Text>
                    <Text style={s.metricSub}>{fmtDeltaPct(stressed.cap - d.cap)} vs OM</Text>
                  </View>
                  <View style={s.metricCard}>
                    <Text style={s.metricLabel}>Stressed DCR</Text>
                    <Text style={[s.metricValue, { color: stressed.dcr < 1.2 ? C.red : C.green }]}>{fmtX(stressed.dcr)}</Text>
                    <Text style={s.metricSub}>{((stressed.dcr - d.dcr) >= 0 ? '+' : '') + (stressed.dcr - d.dcr).toFixed(2)}× vs OM</Text>
                  </View>
                  <View style={s.metricCard}>
                    <Text style={s.metricLabel}>Stressed CoC</Text>
                    <Text style={s.metricValue}>{fmtPct(stressed.coc)}</Text>
                    <Text style={s.metricSub}>{fmtDeltaPct(stressed.coc - d.coc)} vs OM</Text>
                  </View>
                </View>
              </>
            )}
          </Page>
        )
      })()}

      {/* ── OM As-Presented page ────────────────────────────────────── */}
      {showOM && (
        <Page size="LETTER" style={s.page}>
          <Watermark />
          <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} logoSrc={logoSrc} tabLabel="OM As-Presented" />
          <SectionHdr title="OM As-Presented — broker figures" />
          <View style={s.table}>
            <View style={s.tableHdrRow}>
              <Text style={[s.tableHdrCell, { flex: 3 }]}>Line Item</Text>
              <Text style={[s.tableHdrCell, { flex: 1.5, textAlign: 'right' }]}>OM Value</Text>
              <Text style={[s.tableHdrCell, { flex: 1.5, textAlign: 'right' }]}>Per Unit</Text>
            </View>
            {[
              { label: 'Purchase Price', val: fmtDollar(inputs.price), per: units > 0 ? fmtDollar(inputs.price / units) : '—' },
              { label: isOM ? 'Gross Scheduled Rent' : 'Gross Potential Rent', val: fmtDollar(d.GSR), per: units > 0 ? fmtDollar(d.GSR / units) : '—' },
              { label: `Vacancy (${inputs.vp}%)`, val: `(${fmtDollar(d.vac)})`, per: units > 0 ? `(${fmtDollar(d.vac / units)})` : '—' },
              { label: 'Effective Gross Income', val: fmtDollar(d.EGI), per: units > 0 ? fmtDollar(d.EGI / units) : '—', bold: true },
              { label: 'Real Estate Taxes', val: `(${fmtDollar(d.taxTotal)})`, per: units > 0 ? `(${fmtDollar(d.taxTotal / units)})` : '—' },
              { label: 'Insurance', val: `(${fmtDollar(d.ins)})`, per: `$${inputs.ins.toLocaleString()}/door` },
              { label: 'Utilities', val: `(${fmtDollar(d.util)})`, per: units > 0 ? `(${fmtDollar(d.util / units)})` : '—' },
              { label: 'R&M', val: `(${fmtDollar(d.rm)})`, per: `$${inputs.rm.toLocaleString()}/unit` },
              { label: 'Contract Services', val: `(${fmtDollar(d.cs)})`, per: units > 0 ? `(${fmtDollar(d.cs / units)})` : '—' },
              { label: 'G&A', val: `(${fmtDollar(d.ga)})`, per: units > 0 ? `(${fmtDollar(d.ga / units)})` : '—' },
              { label: 'Reserves', val: `(${fmtDollar(d.res)})`, per: `$${inputs.res.toLocaleString()}/unit` },
              { label: `Prop. Mgmt (${d.pmPct.toFixed(1)}%)`, val: `(${fmtDollar(d.pm)})`, per: units > 0 ? `(${fmtDollar(d.pm / units)})` : '—' },
              { label: 'Total Expenses', val: `(${fmtDollar(d.exp)})`, per: units > 0 ? `(${fmtDollar(d.exp / units)})` : '—', bold: true },
              { label: 'NOI', val: fmtDollar(d.NOI), per: units > 0 ? fmtDollar(d.NOI / units) : '—', bold: true },
            ].map((row, i) => (
              <View key={i} style={[row.bold ? s.plTotal : (i % 2 === 0 ? s.tableRow : s.tableRowAlt)]}>
                <Text style={[s.tableCell, { flex: 3, fontFamily: row.bold ? 'Helvetica-Bold' : 'Helvetica' }]}>{row.label}</Text>
                <Text style={[s.tableCellR, { flex: 1.5, fontFamily: row.bold ? 'Helvetica-Bold' : 'Helvetica' }]}>{row.val}</Text>
                <Text style={[s.tableCellR, { flex: 1.5, fontSize: 8, color: C.textLight }]}>{row.per}</Text>
              </View>
            ))}
          </View>
          <View style={s.metricsRow}>
            <View style={s.metricCard}>
              <Text style={s.metricLabel}>Cap Rate</Text>
              <Text style={s.metricValue}>{fmtPct(d.cap)}</Text>
            </View>
            <View style={s.metricCard}>
              <Text style={s.metricLabel}>Price / Unit</Text>
              <Text style={s.metricValue}>{units > 0 ? fmtDollar(inputs.price / units) : '—'}</Text>
            </View>
            <View style={s.metricCard}>
              <Text style={s.metricLabel}>Expense Ratio</Text>
              <Text style={s.metricValue}>{d.EGI > 0 ? fmtPct(d.exp / d.EGI) : '—'}</Text>
            </View>
          </View>
        </Page>
      )}

      {/* ── Inputs summary page ────────────────────────────────────── */}
      {showInputs && (
        <Page size="LETTER" style={s.page}>
          <Watermark />
          <PageHdr propertyName={propertyName} address={address} scenarioName={scenarioName} method={methodLabel} date={date} logoSrc={logoSrc} tabLabel="Inputs" />
          <View style={s.twoCol}>
            <View style={s.col}>
              <SectionHdr title="Income inputs" />
              <View style={s.table}>
                <View style={s.tableHdrRow}>
                  <Text style={[s.tableHdrCell, { flex: 2 }]}>Field</Text>
                  <Text style={[s.tableHdrCell, { flex: 1.5, textAlign: 'right' }]}>Value</Text>
                </View>
                {[
                  ['Total Units', `${inputs.tu}`],
                  ['Occupied Units', `${inputs.ou}`],
                  ['Avg Rent / Unit / Mo', fmtDollar(inputs.rent)],
                  ['Vacancy %', `${inputs.vp}%`],
                  ...(inputs.otherIncome ?? []).map(oi => [oi.label, fmtDollar(oi.amount)]),
                ].map(([label, val], i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.tableCell, { flex: 2 }]}>{label}</Text>
                    <Text style={[s.tableCellR, { flex: 1.5 }]}>{val}</Text>
                  </View>
                ))}
              </View>

              <SectionHdr title="Financing inputs" />
              <View style={s.table}>
                <View style={s.tableHdrRow}>
                  <Text style={[s.tableHdrCell, { flex: 2 }]}>Field</Text>
                  <Text style={[s.tableHdrCell, { flex: 1.5, textAlign: 'right' }]}>Value</Text>
                </View>
                {[
                  ['Purchase Price', fmtDollar(inputs.price)],
                  ['Interest Rate', `${inputs.ir}%`],
                  ['LTV', `${inputs.lev}%`],
                  ['Amortization', `${inputs.am} years`],
                  ['Lender Fee', `${inputs.lf}%`],
                  ['Closing Costs', `${inputs.cc}%`],
                ].map(([label, val], i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.tableCell, { flex: 2 }]}>{label}</Text>
                    <Text style={[s.tableCellR, { flex: 1.5 }]}>{val}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={s.col}>
              <SectionHdr title="Expense inputs" />
              <View style={s.table}>
                <View style={s.tableHdrRow}>
                  <Text style={[s.tableHdrCell, { flex: 2 }]}>Field</Text>
                  <Text style={[s.tableHdrCell, { flex: 1.5, textAlign: 'right' }]}>Value</Text>
                </View>
                {[
                  ['Real Estate Taxes', fmtDollar(inputs.tax)],
                  ['Insurance', `$${inputs.ins.toLocaleString()}/door`],
                  ['Electric', `${fmtDollar(inputs.utilElec ?? 0)}${inputs.utilElecSubmetered ? ' (sub-metered)' : ''}`],
                  ['Water & Sewer', `${fmtDollar(inputs.utilWater ?? 0)}${inputs.utilWaterSubmetered ? ' (sub-metered)' : ''}`],
                  ['Trash', fmtDollar(inputs.utilTrash ?? 0)],
                  ['R&M', `$${inputs.rm.toLocaleString()}/unit/yr`],
                  ['Contract Services', fmtDollar(inputs.cs)],
                  ['G&A', fmtDollar(inputs.ga)],
                  ['Reserves', `$${inputs.res.toLocaleString()}/unit/yr`],
                  ['Prop. Management', `${inputs.pm}%`],
                  ...(inputs.otherExpenses ?? []).map(oe => [oe.label, fmtDollar(oe.amount)]),
                ].map(([label, val], i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.tableCell, { flex: 2 }]}>{label}</Text>
                    <Text style={[s.tableCellR, { flex: 1.5 }]}>{val}</Text>
                  </View>
                ))}
              </View>

              <SectionHdr title="Tax inputs" />
              <View style={s.table}>
                <View style={s.tableHdrRow}>
                  <Text style={[s.tableHdrCell, { flex: 2 }]}>Field</Text>
                  <Text style={[s.tableHdrCell, { flex: 1.5, textAlign: 'right' }]}>Value</Text>
                </View>
                {[
                  ['Tax Bracket', `${inputs.brk}%`],
                  ['Land %', `${inputs.land}%`],
                  ['Cost Seg %', `${inputs.costSeg}%`],
                  ['1031 Exchange', inputs.is1031 ? 'Yes' : 'No'],
                  ...(inputs.is1031 ? [['1031 Basis', fmtDollar(inputs.basis1031 ?? 0)], ['1031 Equity', fmtDollar(inputs.equity1031 ?? 0)]] : []),
                ].map(([label, val], i) => (
                  <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                    <Text style={[s.tableCell, { flex: 2 }]}>{label}</Text>
                    <Text style={[s.tableCellR, { flex: 1.5 }]}>{val}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Page>
      )}

    </Document>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────
export async function fetchImageAsBase64(url: string): Promise<string | null> {
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
