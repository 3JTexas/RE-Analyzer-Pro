import { useState, useCallback, useEffect, useMemo } from 'react'
import { Download, Save, RotateCcw, FileText } from 'lucide-react'
import { calculate, OM_DEFAULTS, fmtDollar, fmtNeg, fmtPct, fmtX, fmtDelta, fmtDeltaPct } from '../../lib/calc'
import type { ModelInputs, Method, Scenario } from '../../types'
import {
  InputField, SectionHeader, MetricCard, PLRow, Alert, Toggle, DCRBar, Badge
} from '../ui'
import { generatePDF } from '../pdf/PdfReport'
import { loadCompareState, saveCompareState } from '../../lib/uiState'
import { LOIModal } from '../loi/LOIModal'
import { TaxRecordImport } from '../TaxRecordImport'
import type { LOIData } from '../../types/loi'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

// ── Tax Benefit Bank — table + chart ─────────────────────────────────────
const LC = { bonus: '#0072B2', sl: '#E69F00', none: '#CC79A7', exhaust: '#D85A30' }
const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtCell(v: number): string {
  if (Math.abs(v) < 0.5) return '—'
  return v < 0 ? `($${Math.abs(v).toLocaleString('en-US',{maximumFractionDigits:0})})` : `$${v.toLocaleString('en-US',{maximumFractionDigits:0})}`
}
function ColTip({ text }: { text: string }) {
  return (
    <span className="relative group ml-0.5">
      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-gray-300 text-[7px] text-gray-600 cursor-help font-semibold leading-none">i</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 px-2 py-1.5 text-[9px] leading-snug text-white bg-gray-800 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 normal-case tracking-normal font-normal">{text}</span>
    </span>
  )
}

const bankPlugin = {
  id: 'bankCallouts',
  afterDraw(chart: any) {
    const ctx = chart.ctx
    const m0 = chart.getDatasetMeta(0)
    if (!m0?.data?.length) return
    const rm = chart.config._config.data._bankMeta
    if (!rm) return
    ctx.save()
    // Day 1 callout
    if (m0.data[0]) {
      const pt = m0.data[0]
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 13, 0, Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill()
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 10, 0, Math.PI*2); ctx.fillStyle=LC.bonus; ctx.fill()
      ctx.fillStyle='#fff'; ctx.font='bold 7px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(rm.day1Label, pt.x, pt.y)
      ctx.fillStyle=LC.bonus; ctx.font='bold 8px Inter,sans-serif'
      ctx.fillText('Day 1 balance', pt.x, pt.y - 17)
    }
    // Exhaustion callout
    if (rm.extIdx >= 0 && m0.data[rm.extIdx]) {
      const pt = m0.data[rm.extIdx]
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 13, 0, Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill()
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 10, 0, Math.PI*2); ctx.fillStyle=LC.exhaust; ctx.fill()
      ctx.fillStyle='#fff'; ctx.font='bold 7px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(`Mo ${rm.extIdx+1}`, pt.x, pt.y)
      ctx.fillStyle=LC.exhaust; ctx.font='bold 8px Inter,sans-serif'
      ctx.fillText('Shield exhausted', pt.x, pt.y - 17)
    }
    // SL peak
    const m1 = chart.getDatasetMeta(1)
    if (rm.slPeakIdx >= 0 && m1?.data?.[rm.slPeakIdx]) {
      const pt = m1.data[rm.slPeakIdx]
      ctx.fillStyle=LC.sl; ctx.font='600 7px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='bottom'
      ctx.fillText(`SL peak $${Math.round(rm.slPeakVal/1000)}k`, pt.x, pt.y - 5)
      ctx.beginPath(); ctx.moveTo(pt.x,pt.y-4); ctx.lineTo(pt.x+4,pt.y); ctx.lineTo(pt.x,pt.y+4); ctx.lineTo(pt.x-4,pt.y)
      ctx.closePath(); ctx.fillStyle=LC.sl; ctx.fill()
    }
    ctx.restore()
  },
}

interface BankRow { period: string; pretax: number; slAdded: number; drawn: number; balance: number; note: string; isSub?: boolean; isTotal?: boolean }

function TaxBenefitSection({ d, inputs }: { d: ReturnType<typeof calculate>; inputs: ModelInputs }) {
  const bracket = d.brk / 100
  const bonusSav = d.bd * bracket
  const slMonthly = (d.sl * bracket) / 12
  const slAnnual = d.sl * bracket
  const monthlyCF = d.CF / 12
  const fullSL = d.deprBase / 27.5

  const { rows, chartLines } = useMemo(() => {
    const rows: BankRow[] = []
    let bal = bonusSav // Day 1: bonus loaded
    let exhausted = false

    // Y1 — 12 monthly rows
    for (let m = 0; m < 12; m++) {
      const sl = slMonthly
      bal += sl
      const drawn = monthlyCF < 0 ? Math.abs(monthlyCF) : 0
      const added = monthlyCF >= 0 ? monthlyCF : 0
      bal = bal - drawn + added
      let note = ''
      if (m === 0) note = `Bonus dep loaded — ${fmtCell(bonusSav)} tax shield`
      if (!exhausted && bal < 0) { note = 'Shield exhausted — cash losses begin'; exhausted = true }
      rows.push({ period: `${MO[m]} Y1`, pretax: monthlyCF, slAdded: sl, drawn, balance: bal, note })
    }
    // Y1 subtotal
    const y1Pretax = d.CF, y1Sl = slAnnual, y1Drawn = monthlyCF < 0 ? Math.abs(monthlyCF) * 12 : 0
    rows.push({ period: 'Year 1 Total', pretax: y1Pretax, slAdded: y1Sl, drawn: y1Drawn, balance: bal, note: '', isSub: true })

    // Y2-5 annual
    for (let y = 2; y <= 5; y++) {
      const sl = slAnnual
      bal += sl
      const drawn = d.CF < 0 ? Math.abs(d.CF) : 0
      const added = d.CF >= 0 ? d.CF : 0
      bal = bal - drawn + added
      let note = y === 2 ? 'Bonus dep fully utilized' : ''
      if (!exhausted && bal < 0) { note = 'Shield exhausted — cash losses begin'; exhausted = true }
      rows.push({ period: `Year ${y}`, pretax: d.CF, slAdded: sl, drawn, balance: bal, note })
    }
    // 5yr total
    const totPretax = d.CF * 5, totSl = slAnnual * 5, totDrawn = rows.filter(r => !r.isSub && !r.isTotal).reduce((s, r) => s + r.drawn, 0)
    rows.push({ period: '5-Year Total', pretax: totPretax, slAdded: totSl, drawn: totDrawn, balance: bal, note: '', isTotal: true })

    // Chart lines — 60 months, benefit bank model
    const line1: number[] = [], line2: number[] = [], line3: number[] = []
    let b1 = bonusSav, b2 = 0, b3 = 0
    const slOnlyMonthly = (fullSL * bracket) / 12
    for (let m = 0; m < 60; m++) {
      // Line 1: bonus bank
      b1 += slMonthly + monthlyCF
      // Line 2: SL only bank (no bonus)
      b2 += slOnlyMonthly + monthlyCF
      // Line 3: no tax benefit, pure cumulative pretax
      b3 += monthlyCF
      line1.push(Math.round(b1)); line2.push(Math.round(b2)); line3.push(Math.round(b3))
    }
    const ext1 = line1.findIndex(v => v < 0)
    const slPeakVal = Math.max(...line2), slPeakIdx = line2.indexOf(slPeakVal)
    return { rows, chartLines: { line1, line2, line3, ext1, slPeakIdx, slPeakVal } }
  }, [d.CF, d.bd, d.sl, d.brk, d.deprBase, bonusSav, slMonthly, slAnnual, monthlyCF, fullSL, bracket])

  const fmtK = (n: number) => n >= 0 ? `$${Math.round(n/1000)}k` : `($${Math.round(Math.abs(n)/1000)}k)`
  const cellColor = (v: number) => Math.abs(v) < 0.5 ? 'text-gray-400' : v < 0 ? 'text-red-600' : 'text-green-700'

  const labels = Array.from({ length: 60 }, () => '')
  const chartData = {
    labels,
    _bankMeta: { day1Label: fmtK(bonusSav), extIdx: chartLines.ext1, slPeakIdx: chartLines.slPeakIdx, slPeakVal: chartLines.slPeakVal },
    datasets: [
      { label: 'Bonus Dep + Cost Seg', data: chartLines.line1, borderColor: LC.bonus, borderWidth: 3, tension: 0.3, pointRadius: 0, fill: false },
      { label: 'SL Only', data: chartLines.line2, borderColor: LC.sl, borderWidth: 1.5, borderDash: [6, 3], tension: 0.3, pointRadius: 0, fill: false },
      { label: 'No Tax Benefit', data: chartLines.line3, borderColor: LC.none, borderWidth: 1, borderDash: [2, 4], tension: 0.3, pointRadius: 0, fill: false },
    ],
  }

  return (
    <div className="mt-3">
      {/* Opening balance card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 mb-3">
        <p className="text-sm font-bold text-blue-800">Day 1 Tax Benefit Bank: {fmtCell(bonusSav)}</p>
        <p className="text-[10px] text-blue-600 mt-0.5">Funded by bonus depreciation on {fmtCell(d.bd)} of cost-segregated assets at {d.brk}% tax bracket</p>
      </div>

      {/* ── PART 1: Benefit Bank Table ──────────────────── */}
      <SectionHeader title="5-Year Benefit Bank" tooltip="Tracks your tax benefit balance like a bank account — loaded Day 1 with bonus depreciation, replenished monthly by SL dep, drained by operating losses." />
      <div className="border border-gray-100 rounded-lg overflow-hidden bg-white mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[9px]" style={{ minWidth: 620 }}>
            <thead className="sticky top-0 bg-white border-b border-gray-200">
              <tr>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Period</th>
                <th className="text-right px-2 py-1.5 font-semibold text-gray-600">Pre-Tax CF<ColTip text="Net Operating Income minus debt service. Negative means the property loses money before tax benefits are applied." /></th>
                <th className="text-right px-2 py-1.5 font-semibold text-gray-600">SL Dep Added<ColTip text="Straight-line depreciation tax savings added to the benefit bank each period. Equals remaining building basis / 27.5 years x tax bracket / 12 for monthly." /></th>
                <th className="text-right px-2 py-1.5 font-semibold text-gray-600">Drawn<ColTip text="Amount the operating loss draws from your tax benefit bank each period. Only applies when pre-tax cash flow is negative." /></th>
                <th className="text-right px-2 py-1.5 font-semibold text-gray-600">Balance<ColTip text="Your running depreciation tax shield balance. Starts at full bonus dep value on Day 1, grows with SL savings, drains from operating losses. Goes negative when shield is exhausted." /></th>
                <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Notes<ColTip text="Key milestone events in the benefit timeline." /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const exhaustRow = !r.isSub && !r.isTotal && r.note.includes('exhausted')
                const negBal = !r.isSub && !r.isTotal && r.balance < -0.5 && !exhaustRow
                const bg = r.isTotal ? 'bg-gray-800 text-white'
                  : r.isSub ? 'bg-blue-50 font-semibold border-t-2 border-blue-200'
                  : exhaustRow ? 'bg-amber-50'
                  : negBal ? 'bg-red-50'
                  : r.period.startsWith('Year') ? 'bg-gray-50'
                  : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                const vc = r.isTotal ? 'text-white' : ''
                return (
                  <tr key={i} className={bg}>
                    <td className={`px-2 py-1 ${r.isTotal || r.isSub ? 'font-bold' : ''}`}>{r.period}</td>
                    <td className={`px-2 py-1 text-right ${vc || cellColor(r.pretax)}`}>{fmtCell(r.pretax)}</td>
                    <td className={`px-2 py-1 text-right ${vc || cellColor(r.slAdded)}`}>{fmtCell(r.slAdded)}</td>
                    <td className={`px-2 py-1 text-right ${vc || (r.drawn > 0.5 ? 'text-red-600' : 'text-gray-400')}`}>{r.drawn > 0.5 ? fmtCell(-r.drawn) : '—'}</td>
                    <td className={`px-2 py-1 text-right font-medium ${vc || cellColor(r.balance)}`}>{fmtCell(r.balance)}</td>
                    <td className={`px-2 py-1 text-[8px] ${r.note.includes('exhausted') ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{r.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PART 2: Chart ──────────────────────────────── */}
      <SectionHeader title="Tax Benefit Bank — Running Balance Over 5 Years" tooltip="Compares benefit bank balance under three depreciation strategies. Line 1 starts loaded with bonus dep; Line 2 accrues SL only; Line 3 has no tax offset." />
      <div className="border border-gray-100 rounded-lg p-3 bg-white">
        <div className="flex flex-wrap gap-3 mb-2 text-[9px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: LC.bonus }} />
            <span className="text-gray-600">Bonus Dep + Cost Seg — full benefit loaded Day 1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-dashed" style={{ borderColor: LC.sl, backgroundColor: `${LC.sl}30` }} />
            <span className="text-gray-600">SL Only — benefit accrues monthly over 27.5 years</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-dashed" style={{ borderColor: LC.none, backgroundColor: `${LC.none}20` }} />
            <span className="text-gray-600">No Tax Benefit — pre-tax cash flow only</span>
          </div>
        </div>
        <div style={{ height: 220 }}>
          <Line data={chartData as any} plugins={[bankPlugin]} options={{
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: { callbacks: { title: (items) => `Month ${items[0].dataIndex + 1}`, label: (item) => `${item.dataset.label}: ${fmtDollar(item.raw as number)}` } }, legend: { display: false } },
            scales: {
              x: {
                ticks: {
                  callback: (_v, idx) => { if (idx % 12 === 0) return `Year ${idx/12+1}`; if (idx % 6 === 0) return `Mo ${idx}`; return '' },
                  font: (ctx) => { const l = ctx.tick?.label?.toString() ?? ''; return { size: l.startsWith('Year') ? 11 : 9, weight: l.startsWith('Year') ? 'bold' as const : 'normal' as const } },
                  color: (ctx) => (ctx.tick?.label?.toString() ?? '').startsWith('Year') ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)',
                  maxRotation: 0,
                },
                grid: { color: (ctx) => ctx.index % 12 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)', lineWidth: (ctx) => ctx.index % 12 === 0 ? 1.5 : 0.5 },
              },
              y: {
                title: { display: true, text: 'Benefit Bank Balance ($)', font: { size: 9 }, color: '#888' },
                ticks: { font: { size: 9 }, color: '#888', maxTicksLimit: 10,
                  callback: (v) => { const n = v as number; if (n === 0) return '$0'; return n < 0 ? `($${Math.abs(n)>=1000?(Math.abs(n)/1000).toFixed(0)+'k':Math.abs(n)})` : `$${n>=1000?(n/1000).toFixed(0)+'k':n}` } },
                grid: { color: (ctx) => ctx.tick.value === 0 ? '#333333' : ctx.tick.value > 0 ? 'rgba(0,150,0,0.03)' : 'rgba(200,0,0,0.03)', lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 0.5 },
              },
            },
          }} />
        </div>
      </div>
    </div>
  )
}

// ── Column color palettes ────────────────────────────────────────────────
const COL_STYLES = [
  { hdrBg: 'bg-blue-900',   hdrText: 'text-blue-200',   border: 'border-blue-700',   val: 'text-blue-700'   },
  { hdrBg: 'bg-amber-900',  hdrText: 'text-amber-200',  border: 'border-amber-700',  val: 'text-amber-700'  },
  { hdrBg: 'bg-green-900',  hdrText: 'text-green-200',  border: 'border-green-700',  val: 'text-green-700'  },
  { hdrBg: 'bg-purple-900', hdrText: 'text-purple-200', border: 'border-purple-700', val: 'text-purple-700' },
]
const COL_LABELS = ['A','B','C','D']

// Row spec: label, how to extract value from ModelOutputs, is it paren, is it pct, noD
type RowSpec = {
  label: string
  get: (d: ReturnType<typeof calculate>) => number
  paren?: boolean
  pct?: boolean
  x?: boolean
  noD?: boolean
  bold?: boolean
  indent?: boolean
}

const ROW_SPECS: RowSpec[] = [
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

function fmtVal(v: number, spec: RowSpec): string {
  if (spec.pct) return fmtPct(v)
  if (spec.x)   return fmtX(v)
  if (spec.paren) return `(${fmtDollar(Math.abs(v))})`
  return fmtNeg(v)
}

function fmtDeltaVal(d: number, spec: RowSpec): string {
  if (spec.noD) return '—'
  if (spec.pct) return fmtDeltaPct(d)
  if (spec.x)   return (d >= 0 ? '+' : '') + d.toFixed(2) + '×'
  return fmtDelta(d)
}

interface CompareTabProps {
  compareA: string; setCompareA: (v: string) => void
  compareB: string; setCompareB: (v: string) => void
  compareCols: string[]; setCompareCols: (v: string[]) => void
  scenarioOptions: { id: string; name: string }[]
  resolveInputs: (sid: string) => { inputs: ModelInputs; method: Method; label: string }
  deltaRows: (a: any, b: any) => any[]
  onSaveCompare?: () => Promise<void>
  compareSaving?: boolean
}

function CompareTab({ compareA, setCompareA, compareB, setCompareB,
  compareCols, setCompareCols, scenarioOptions, resolveInputs,
  onSaveCompare, compareSaving }: CompareTabProps) {

  const allIds = [compareA, compareB, ...compareCols]

  const allCols = allIds.map((id, i) => {
    const r = resolveInputs(id)
    return { id, label: r.label, style: COL_STYLES[i] ?? COL_STYLES[3], inputs: r.inputs, data: calculate(r.inputs, r.method === 'om') }
  })

  const setCol = (i: number, val: string) => {
    if (i === 0) setCompareA(val)
    else if (i === 1) setCompareB(val)
    else setCompareCols(compareCols.map((c, ci) => ci === i - 2 ? val : c))
  }

  const addCol = () => {
    if (allIds.length >= 4) return
    const next = scenarioOptions.find(o => !allIds.includes(o.id))?.id ?? scenarioOptions[0].id
    setCompareCols([...compareCols, next])
  }

  const removeCol = (i: number) => {
    if (i < 2) return
    setCompareCols(compareCols.filter((_, ci) => ci !== i - 2))
  }

  const baseData = allCols[0].data

  return (
    <div className="mt-3">
      {onSaveCompare && (
        <div className="flex justify-end mb-2">
          <button
            onClick={onSaveCompare}
            disabled={compareSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={12} />
            {compareSaving ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      )}
      <div className="rounded-lg border border-gray-100 overflow-hidden mb-3">
        <div className="overflow-x-auto">
          <table className="text-xs" style={{ minWidth: `${180 + allCols.length * 110}px`, width: '100%' }}>
            <thead className="bg-navy">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-white">Line item</th>
                {allCols.map((col, i) => (
                  <th key={i} className="px-2 py-1.5 min-w-[100px]">
                    <div className="flex items-center gap-0.5">
                      <select value={col.id} onChange={e => setCol(i, e.target.value)}
                        className={`flex-1 text-[10px] font-semibold rounded px-1 py-1
                          ${col.style.hdrBg} ${col.style.hdrText} ${col.style.border}
                          border focus:outline-none cursor-pointer`}>
                        {scenarioOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      {i >= 2 && (
                        <button onClick={() => removeCol(i)}
                          className="text-gray-400 hover:text-red-300 ml-0.5 text-sm leading-none flex-shrink-0">×</button>
                      )}
                    </div>
                    <div className={`text-[9px] text-center mt-0.5 ${col.style.hdrText} opacity-60`}>
                      {COL_LABELS[i]}{i > 0 ? ' — vs A' : ' (baseline)'}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 text-right">
                  {allCols.length < 4 && (
                    <button onClick={addCol}
                      className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded font-medium whitespace-nowrap">
                      + Add
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Purchase Price headline row — always inputs.price */}
              {(() => {
                const prices = allCols.map(c => c.inputs.price)
                const basePrice = prices[0]
                return (
                  <tr className="border-b-2 border-blue-200 bg-blue-50">
                    <td className="px-3 py-2 font-semibold text-gray-900">
                      Purchase Price
                    </td>
                    {allCols.map((col, ci) => (
                      <td key={ci} className={`px-3 py-2 text-right font-bold text-sm ${col.style.val}`}>
                        {fmtDollar(prices[ci])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      {allCols.slice(1).map((_, ci) => {
                        const delta = prices[ci + 1] - basePrice
                        return (
                          <div key={ci} className={`font-medium text-[10px] ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-700' : 'text-gray-400'}`}>
                            {allCols.length > 2 && <span className="opacity-50 mr-0.5">{COL_LABELS[ci+1]}:</span>}
                            {fmtDelta(delta)}
                          </div>
                        )
                      })}
                    </td>
                  </tr>
                )
              })()}
              {ROW_SPECS.map((spec, ri) => {
                const vals = allCols.map(c => spec.get(c.data))
                const baseVal = vals[0]
                return (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className={`px-3 py-1.5
                      ${spec.indent ? 'pl-6 text-gray-400' : spec.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                      {spec.label.trim()}
                    </td>
                    {allCols.map((col, ci) => (
                      <td key={ci} className={`px-3 py-1.5 text-right font-medium ${col.style.val}`}>
                        {fmtVal(vals[ci], spec)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right">
                      {allCols.slice(1).map((col, ci) => {
                        const delta = spec.noD ? 0 : vals[ci + 1] - baseVal
                        const dStr = fmtDeltaVal(delta, spec)
                        const dColor = spec.noD ? 'text-gray-300'
                          : delta > 0.005 ? 'text-green-700'
                          : delta < -0.005 ? 'text-red-600'
                          : 'text-gray-400'
                        return (
                          <div key={ci} className={`font-medium text-[10px] ${dColor}`}>
                            {allCols.length > 2 && <span className="opacity-50 mr-0.5">{COL_LABELS[ci+1]}:</span>}
                            {dStr}
                          </div>
                        )
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


// ── Flags helpers ────────────────────────────────────────────────────────
interface Flag {
  severity: 'red' | 'amber' | 'info'
  title: string
  detail: string
  omVal: string
  benchmark: string
  noImpact?: string
}

function computeFlags(inputs: ModelInputs, d: ReturnType<typeof calculate>, yearBuilt?: number | null): Flag[] {
  const flags: Flag[] = []
  const age = yearBuilt ? new Date().getFullYear() - yearBuilt : null

  // 1. Property tax reassessment risk
  if (inputs.price > 0 && inputs.tax > 0) {
    const effectiveRate = (inputs.tax / inputs.price) * 100
    if (effectiveRate < 1.8) {
      const projectedTax = inputs.price * 0.020
      const delta = projectedTax - inputs.tax
      flags.push({
        severity: effectiveRate < 1.2 ? 'red' : 'amber',
        title: 'Property taxes likely understated (pre-sale assessment)',
        detail: `Effective tax rate is ${effectiveRate.toFixed(2)}% of purchase price. Florida reassesses to market value upon sale with no cap for investment properties. At ~2.0% millage, post-purchase taxes will be ~$${Math.round(projectedTax).toLocaleString()}/yr.`,
        omVal: `$${inputs.tax.toLocaleString()} (${effectiveRate.toFixed(2)}% of price)`,
        benchmark: `~$${Math.round(projectedTax).toLocaleString()} (~2.0% of purchase price)`,
        noImpact: `($${Math.round(delta).toLocaleString()}) NOI`,
      })
    }
  }

  // 2. Physical vacancy vs stated vacancy
  if (inputs.tu > 0 && inputs.ou > 0 && inputs.ou < inputs.tu) {
    const physicalVacPct = ((inputs.tu - inputs.ou) / inputs.tu) * 100
    if (physicalVacPct > inputs.vp) {
      const gsr = inputs.rent * inputs.tu * 12
      const understatedVacancy = gsr * (physicalVacPct - inputs.vp) / 100
      flags.push({
        severity: 'red',
        title: 'Physical vacancy exceeds stated vacancy rate',
        detail: `Rent roll shows ${inputs.tu - inputs.ou} of ${inputs.tu} units vacant (${physicalVacPct.toFixed(1)}% physical vacancy). OM applies only ${inputs.vp}% vacancy to a full ${inputs.tu}-unit GSR, overstating effective income.`,
        omVal: `${inputs.vp}% vacancy on ${inputs.tu}-unit GSR`,
        benchmark: `${physicalVacPct.toFixed(1)}% physical vacancy (${inputs.tu - inputs.ou} unit${inputs.tu - inputs.ou > 1 ? 's' : ''} vacant)`,
        noImpact: `($${Math.round(understatedVacancy).toLocaleString()}) EGI vs. in-place`,
      })
    }
  }

  // 3. Insurance benchmark (South FL)
  if (inputs.tu > 0 && inputs.ins > 0) {
    const benchmarkPerDoor = age && age > 60 ? 3000 : age && age > 40 ? 2500 : 2000
    if (inputs.ins < benchmarkPerDoor) {
      const delta = (benchmarkPerDoor - inputs.ins) * inputs.tu
      flags.push({
        severity: inputs.ins < 2000 ? 'red' : 'amber',
        title: 'Insurance may be understated for South FL market',
        detail: `At $${inputs.ins.toLocaleString()}/door, this is below current market rates for${age && age > 60 ? ' a pre-1965 wood-frame flat-roof' : ''} South Florida multifamily. New owner policies are repriced from scratch at sale — seller's grandfathered rate does not transfer.`,
        omVal: `$${inputs.ins.toLocaleString()}/door ($${(inputs.ins * inputs.tu).toLocaleString()} total)`,
        benchmark: `$${benchmarkPerDoor.toLocaleString()}+/door for this asset type`,
        noImpact: `($${delta.toLocaleString()}+) NOI at benchmark`,
      })
    }
  }

  // 4. R&M benchmark (age-adjusted)
  if (inputs.tu > 0 && inputs.rm >= 0) {
    const rmBenchmark = age && age > 60 ? 900 : age && age > 40 ? 700 : 500
    if (inputs.rm < rmBenchmark) {
      const delta = (rmBenchmark - inputs.rm) * inputs.tu
      flags.push({
        severity: inputs.rm < rmBenchmark * 0.6 ? 'red' : 'amber',
        title: `R&M understated for ${age ? age + '-year-old' : 'older'} building`,
        detail: `$${inputs.rm}/unit/yr is below the age-adjusted benchmark for this vintage. Older construction with plaster walls, hardwood floors, and flat roofs typically runs higher.`,
        omVal: `$${inputs.rm}/unit/yr ($${(inputs.rm * inputs.tu).toLocaleString()} total)`,
        benchmark: `$${rmBenchmark}+/unit/yr for this building age`,
        noImpact: `($${delta.toLocaleString()}+) NOI at benchmark`,
      })
    }
  }

  // 5. Reserves benchmark (age-adjusted)
  if (inputs.tu > 0 && inputs.res >= 0) {
    const resBenchmark = age && age > 60 ? 700 : age && age > 40 ? 500 : 350
    if (inputs.res < resBenchmark) {
      const delta = (resBenchmark - inputs.res) * inputs.tu
      flags.push({
        severity: inputs.res < resBenchmark * 0.5 ? 'red' : 'amber',
        title: `Reserves understated for ${age ? age + '-year-old' : 'older'} building`,
        detail: `$${inputs.res}/unit/yr in reserves is below recommended levels for a building of this age. Flat roof replacement, exterior remediation, and system replacements are capital-intensive on pre-war construction.`,
        omVal: `$${inputs.res}/unit/yr ($${(inputs.res * inputs.tu).toLocaleString()} total)`,
        benchmark: `$${resBenchmark}+/unit/yr for this building age`,
        noImpact: `($${delta.toLocaleString()}+) NOI at benchmark`,
      })
    }
  }

  return flags
}

function FlagsTab({ inputs, d, propertyYearBuilt, onUpdateInputs }: {
  inputs: ModelInputs
  d: ReturnType<typeof calculate>
  propertyYearBuilt?: number | null
  onUpdateInputs?: (updates: Partial<ModelInputs>) => void
}) {
  const flags = computeFlags(inputs, d, propertyYearBuilt)

  // Stressed scenario: apply projected tax + insurance benchmarks
  const age = propertyYearBuilt ? new Date().getFullYear() - propertyYearBuilt : null
  const projectedTax = inputs.price > 0 ? inputs.price * 0.020 : inputs.tax
  const insBenchmark = age && age > 60 ? 3000 : age && age > 40 ? 2500 : 2000
  const rmBenchmark = age && age > 60 ? 900 : age && age > 40 ? 700 : 500
  const resBenchmark = age && age > 60 ? 700 : age && age > 40 ? 500 : 350
  const stressedInputs: ModelInputs = {
    ...inputs,
    tax: Math.max(inputs.tax, projectedTax),
    ins: Math.max(inputs.ins, insBenchmark),
    rm: Math.max(inputs.rm, rmBenchmark),
    res: Math.max(inputs.res, resBenchmark),
  }
  const ds = calculate(stressedInputs, true)

  const sevColor = (s: Flag['severity']) =>
    s === 'red' ? 'border-red-200 bg-red-50' : s === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
  const sevBadge = (s: Flag['severity']) =>
    s === 'red' ? 'bg-red-100 text-red-700' : s === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
  const sevLabel = (s: Flag['severity']) =>
    s === 'red' ? '⚠ High' : s === 'amber' ? '△ Watch' : 'ℹ Info'

  return (
    <div className="mt-3">
      {onUpdateInputs && (
        <div className="flex justify-end mb-3">
          <TaxRecordImport
            currentTax={inputs.tax}
            currentLand={inputs.land}
            units={inputs.tu}
            purchasePrice={inputs.price}
            onApply={(tax, land) => onUpdateInputs({ tax, land })}
          />
        </div>
      )}
      {flags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm font-semibold text-green-700">No flags detected</p>
          <p className="text-xs text-gray-400 mt-1">All inputs are within expected benchmarks</p>
        </div>
      ) : (
        <>
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-semibold text-red-800">{flags.filter(f => f.severity === 'red').length} high-risk · {flags.filter(f => f.severity === 'amber').length} watch items</p>
            <p className="text-[10px] text-red-600 mt-0.5">Figures below are based on OM inputs — verify each before proceeding</p>
          </div>

          <div className="space-y-3 mb-4">
            {flags.map((flag, i) => (
              <div key={i} className={`border rounded-lg p-3 ${sevColor(flag.severity)}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-900 leading-snug flex-1">{flag.title}</p>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${sevBadge(flag.severity)}`}>
                    {sevLabel(flag.severity)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-600 leading-relaxed mb-2">{flag.detail}</p>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="bg-white/70 rounded px-2 py-1">
                    <div className="text-gray-400 mb-0.5">OM figure</div>
                    <div className="font-semibold text-gray-700">{flag.omVal}</div>
                  </div>
                  <div className="bg-white/70 rounded px-2 py-1">
                    <div className="text-gray-400 mb-0.5">Benchmark</div>
                    <div className="font-semibold text-gray-700">{flag.benchmark}</div>
                  </div>
                </div>
                {flag.noImpact && (
                  <div className="mt-1.5 text-[10px] font-semibold text-red-700">
                    NOI impact: {flag.noImpact}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
            <div className="bg-gray-800 px-3 py-2">
              <p className="text-xs font-semibold text-white">Stressed scenario — benchmarks applied</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Tax, insurance, R&M, reserves floored to age-adjusted benchmarks</p>
            </div>
            <div className="bg-gray-50 p-3 grid grid-cols-2 gap-2">
              <div className="bg-white rounded p-2 text-center">
                <div className="text-[10px] text-gray-500">Stressed NOI</div>
                <div className="text-base font-semibold text-gray-900">{fmtDollar(ds.NOI)}</div>
                <div className="text-[9px] text-red-600">{fmtDelta(ds.NOI - d.NOI)} vs OM</div>
              </div>
              <div className="bg-white rounded p-2 text-center">
                <div className="text-[10px] text-gray-500">Stressed Cap Rate</div>
                <div className="text-base font-semibold text-gray-900">{fmtPct(ds.cap)}</div>
                <div className="text-[9px] text-red-600">{fmtDeltaPct(ds.cap - d.cap)} vs OM</div>
              </div>
              <div className="bg-white rounded p-2 text-center">
                <div className="text-[10px] text-gray-500">Stressed DCR</div>
                <div className={`text-base font-semibold ${ds.dcr < 1.2 ? 'text-red-600' : 'text-green-700'}`}>{fmtX(ds.dcr)}</div>
                <div className="text-[9px] text-red-600">{((ds.dcr - d.dcr) >= 0 ? '+' : '') + (ds.dcr - d.dcr).toFixed(2)}× vs OM</div>
              </div>
              <div className="bg-white rounded p-2 text-center">
                <div className="text-[10px] text-gray-500">Stressed CoC</div>
                <div className="text-base font-semibold text-gray-900">{fmtPct(ds.coc)}</div>
                <div className="text-[9px] text-red-600">{fmtDeltaPct(ds.coc - d.coc)} vs OM</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface ModelProps {
  initialInputs?: Partial<ModelInputs>
  initialMethod?: Method
  scenarioName?: string
  onSave?: (name: string, method: Method, inputs: ModelInputs) => Promise<void>
  saving?: boolean
  siblings?: Scenario[]
  currentScenarioId?: string
  omScenario?: Scenario | null
  propertyName?: string
  propertyAddress?: string
  propertyUnits?: number
  propertyYearBuilt?: number | null
  propertyId?: string
  propertyImageUrl?: string
}

export function ModelCalculator({
  initialInputs, initialMethod = 'om', scenarioName = 'New Scenario',
  onSave, saving, siblings = [], currentScenarioId, omScenario,
  propertyName = 'Investment Property', propertyAddress = '',
  propertyUnits, propertyYearBuilt, propertyId, propertyImageUrl,
}: ModelProps) {
  const [inputs, setInputs] = useState<ModelInputs>({
    ...OM_DEFAULTS,
    ...initialInputs,
    cc: (initialInputs as any)?.cc ?? 0,
    expCollapse: (initialInputs as any)?.expCollapse ?? false,
    expPct: (initialInputs as any)?.expPct ?? 0,
    land: (initialInputs as any)?.land ?? 20,
    costSeg: (initialInputs as any)?.costSeg ?? 23,
    is1031: (initialInputs as any)?.is1031 ?? false,
    basis1031: (initialInputs as any)?.basis1031 ?? 0,
    equity1031: (initialInputs as any)?.equity1031 ?? 0,
    otherIncome: (initialInputs as any)?.otherIncome ?? [],
    otherExpenses: (initialInputs as any)?.otherExpenses ?? [],
  })
  const [method, setMethod] = useState<Method>(initialMethod)
  const [name, setName] = useState(scenarioName)
  const [activeTab, setActiveTab] = useState<'inputs'|'pl'|'tax'|'om'|'flags'|'compare'>('inputs')
  const [omLocked, setOmLocked] = useState(true)
  const [omSnapshot, setOmSnapshot] = useState<ModelInputs | null>(null)
  const targetCap = inputs.targetCapRate ?? 0
  const setTargetCap = (v: number) => setInputs(prev => ({ ...prev, targetCapRate: v }))
  const [applyConfirm, setApplyConfirm] = useState(false)
  const [showLOI, setShowLOI] = useState(false)
  const [loiData, setLoiData] = useState<LOIData | null>(null)

  // Compare tab: which two scenarios to diff
  const [compareA, setCompareA] = useState<string>(currentScenarioId ?? 'current')
  const [compareB, setCompareB] = useState<string>(
    siblings.find(s => s.id !== currentScenarioId)?.id ?? 'current'
  )
  const [compareCols, setCompareCols] = useState<string[]>([])  // extra cols C, D
  const [compareSaving, setCompareSaving] = useState(false)

  // Load compare state from DB on mount
  useEffect(() => {
    if (!propertyId) return
    loadCompareState(propertyId).then(cs => {
      if (cs.a) setCompareA(cs.a)
      if (cs.b) setCompareB(cs.b)
      const extra: string[] = []
      if (cs.c) extra.push(cs.c)
      if (cs.d) extra.push(cs.d)
      if (extra.length) setCompareCols(extra)
    })
  }, [propertyId])

  const set = useCallback((key: keyof ModelInputs, val: number | boolean) => {
    setInputs(prev => ({ ...prev, [key]: val }))
  }, [])

  // Array field helpers
  const addOtherIncome = () => setInputs(prev => ({
    ...prev, otherIncome: [...(prev.otherIncome ?? []), { label: 'New income', amount: 0 }]
  }))
  const updateOtherIncome = (i: number, key: 'label'|'amount', val: string|number) =>
    setInputs(prev => { const arr = [...(prev.otherIncome ?? [])]; arr[i] = { ...arr[i], [key]: val }; return { ...prev, otherIncome: arr } })
  const removeOtherIncome = (i: number) =>
    setInputs(prev => ({ ...prev, otherIncome: (prev.otherIncome ?? []).filter((_, idx) => idx !== i) }))

  const addOtherExpense = () => setInputs(prev => ({
    ...prev, otherExpenses: [...(prev.otherExpenses ?? []), { label: 'New expense', amount: 0 }]
  }))
  const updateOtherExpense = (i: number, key: 'label'|'amount', val: string|number) =>
    setInputs(prev => { const arr = [...(prev.otherExpenses ?? [])]; arr[i] = { ...arr[i], [key]: val }; return { ...prev, otherExpenses: arr } })
  const removeOtherExpense = (i: number) =>
    setInputs(prev => ({ ...prev, otherExpenses: (prev.otherExpenses ?? []).filter((_, idx) => idx !== i) }))

  // Returns 'changed' badge label if value differs from OM scenario, else undefined
  const omBadge = (key: keyof ModelInputs): { badge: string; badgeColor: 'amber' } | {} => {
    if (!omScenario || omScenario.id === currentScenarioId) return {}
    const omVal = (omScenario.inputs as any)[key]
    const curVal = (inputs as any)[key]
    if (omVal === undefined || omVal === curVal) return {}
    return { badge: 'changed', badgeColor: 'amber' as const }
  }

  // Auto-derive method from inputs — ou < tu means physical occupancy
  // OM As-Presented (is_default) always forced to 'om' regardless of ou/tu
  const isDefaultOM = omScenario?.id === currentScenarioId
  const effectiveMethod = isDefaultOM ? 'om' : (inputs.ou > 0 && inputs.ou < inputs.tu) ? 'physical' : 'om'
  // Current scenario outputs
  const d   = calculate(inputs, effectiveMethod === 'om')

  // OM tab always uses the is_default scenario inputs, forced to OM method
  const omInputs = omScenario ? omScenario.inputs : inputs
  const omTabD = calculate(omInputs, true)

  // Resolve scenario inputs for compare
  const resolveInputs = (sid: string): { inputs: ModelInputs; method: Method; label: string } => {
    if (sid === 'current') return { inputs, method: effectiveMethod, label: name }
    const s = siblings.find(x => x.id === sid)
    if (!s) return { inputs, method: effectiveMethod, label: name }
    const sIsOM = s.is_default === true
    const sEffective = sIsOM ? 'om' : (s.inputs.ou > 0 && s.inputs.ou < s.inputs.tu) ? 'physical' : 'om'
    return { inputs: s.inputs, method: sEffective as Method, label: s.name }
  }

  const compA = resolveInputs(compareA)
  const compB = resolveInputs(compareB)
  const dA = calculate(compA.inputs, compA.method === 'om')
  const dB = calculate(compB.inputs, compB.method === 'om')

  const resetSection = (section: 'income'|'financing'|'expenses') => {
    const keys: Record<string, (keyof ModelInputs)[]> = {
      income:    ['tu','ou','rent','vp'],
      financing: ['price','ir','lev','am','lf','cc'],
      expenses:  ['tax','ins','util','rm','cs','ga','res','pm','expPct'],
    }
    setInputs(prev => {
      const next = { ...prev }
      keys[section].forEach(k => { (next as any)[k] = (OM_DEFAULTS as any)[k] })
      return next
    })
  }

  const dcrAlert = d.dcr < 1
    ? { type: 'red' as const, msg: `DCR FAIL: ${fmtX(d.dcr)} — NOI ${fmtDollar(d.NOI)} cannot cover debt service ${fmtDollar(d.ds)}. Needs ${fmtDollar(d.ds * 1.2)} for 1.20×.` }
    : d.dcr < 1.2
    ? { type: 'yellow' as const, msg: `DCR CAUTION: ${fmtX(d.dcr)} — Below 1.20× lender minimum. NOI must reach ${fmtDollar(d.ds * 1.2)}.` }
    : { type: 'green' as const, msg: `DCR OK: ${fmtX(d.dcr)} — Clears 1.20× minimum. Cushion: ${fmtDollar(d.NOI - d.ds)}/yr.` }

  const handleSave = async () => { if (onSave) await onSave(name, method, inputs) }
  const handlePDF = () => {
    // Build cols in Compare tab order: A, B, then any extra C/D cols
    const compareOrder = [compareA, compareB, ...compareCols]
    const cols = compareOrder
      .map(sid => {
        const r = resolveInputs(sid)
        return { label: r.label, inputs: r.inputs, method: r.method as Method }
      })
      .filter((col, i, arr) => arr.findIndex(c => c.label === col.label) === i) // dedupe
    generatePDF(
      inputs,
      effectiveMethod,
      propertyName,
      propertyAddress,
      propertyUnits ?? inputs.tu,
      propertyYearBuilt ?? 0,
      name,
      cols,
      propertyImageUrl,
    )
  }
  const handleScenarioSwitch = (sid: string) => {
    const s = siblings.find(x => x.id === sid)
    if (s) window.location.href = `/scenario/${s.id}`
  }

  const openLOI = () => {
    const fmtPrice = (n: number) => `$${n.toLocaleString('en-US')}`
    const price = inputs.price ?? 0
    const loanMin = Math.round(price * (inputs.lev / 100))
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const initial: LOIData = {
      propertyName,
      propertyAddress,
      units: String(propertyUnits ?? inputs.tu ?? ''),
      purchasePrice: price > 0 ? fmtPrice(price) : '',
      purchaserName: 'Andrew Schildcrout and/or assigns',
      purchaserCounsel: "Purchaser's Counsel",
      loanAmountMin: loanMin > 0 ? fmtPrice(loanMin) : '',
      loanApprovalDays: '45',
      closingDays: '60',
      loiExpirationDays: '3',
      date: today,
      recipientNames: '',
      sellerName: '',
      earnestDeposit: '',
      ddPeriodDays: '30',
      ddDeliveryDays: '5',
      template: 'original',
    }
    setLoiData(initial)
    setShowLOI(true)
  }

  // Scenario options for dropdowns
  const scenarioOptions = [
    { id: 'current', name: `${name} (this)` },
    ...siblings.filter(s => s.id !== currentScenarioId).map(s => ({ id: s.id, name: s.name })),
  ]

  // Compare delta rows
  function deltaRows(a: ReturnType<typeof calculate>, b: ReturnType<typeof calculate>) {
    return [
      { label: 'Gross scheduled / potential rent', va: a.GSR, vb: b.GSR, d: b.GSR - a.GSR },
      { label: '  Vacancy deduction', va: -a.vac, vb: -b.vac, d: a.vac - b.vac, paren: true },
      { label: '  Collected rental income', va: a.col, vb: b.col, d: b.col - a.col },
      { label: 'Effective gross income', va: a.EGI, vb: b.EGI, d: b.EGI - a.EGI, bold: true },
      { label: 'Total expenses', va: -a.exp, vb: -b.exp, d: a.exp - b.exp, paren: true },
      { label: 'NOI', va: a.NOI, vb: b.NOI, d: b.NOI - a.NOI, bold: true },
      { label: 'Annual debt service', va: -a.ds, vb: -b.ds, d: 0, paren: true, noD: true },
      { label: 'Pre-tax cash flow', va: a.CF, vb: b.CF, d: b.CF - a.CF },
      { label: 'After-tax cash flow', va: a.at, vb: b.at, d: b.at - a.at },
      { label: 'Y1 total ROE', vaStr: fmtPct(a.r1), vbStr: fmtPct(b.r1), dStr: fmtDeltaPct(b.r1 - a.r1), d: b.r1 - a.r1, bold: true },
      { label: 'Cap rate', vaStr: fmtPct(a.cap), vbStr: fmtPct(b.cap), dStr: fmtDeltaPct(b.cap - a.cap), d: b.cap - a.cap },
      { label: 'DCR', vaStr: fmtX(a.dcr), vbStr: fmtX(b.dcr), dStr: ((b.dcr - a.dcr) >= 0 ? '+' : '') + (b.dcr - a.dcr).toFixed(2) + '×', d: b.dcr - a.dcr },
    ]
  }

  const tabs: { id: typeof activeTab; label: string; dot?: boolean }[] = [
    { id: 'om',      label: 'OM'       },
    { id: 'flags',   label: 'Flags',   dot: computeFlags(inputs, d, propertyYearBuilt).some(f => f.severity === 'red') },
    { id: 'inputs',  label: 'Inputs'   },
    { id: 'pl',      label: 'P&L'      },
    { id: 'tax',     label: 'Tax'      },
    { id: 'compare', label: 'Compare'  },
  ]

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Scenario name + actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <select
          value={currentScenarioId ?? 'current'}
          onChange={e => handleScenarioSwitch(e.target.value)}
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent focus:border-navy focus:outline-none pb-0.5 cursor-pointer">
          <option value={currentScenarioId ?? 'current'}>{name}</option>
          {siblings.filter(s => s.id !== currentScenarioId).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {onSave && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-navy text-white
              rounded-lg hover:bg-navy-light disabled:opacity-50 transition-colors">
            <Save size={12} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        <button onClick={handlePDF}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200
            text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          <Download size={12} />
          PDF
        </button>
        {!isDefaultOM && (
          <button onClick={openLOI}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-500 whitespace-nowrap">
            <FileText size={12} /> LOI
          </button>
        )}
      </div>

      

      {/* Tab bar */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative
              ${activeTab === tab.id
                ? tab.id === 'om'
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
                  : tab.id === 'flags'
                  ? 'text-red-700 border-b-2 border-red-500 bg-red-50'
                  : 'text-navy border-b-2 border-navy bg-white'
                : 'text-gray-400 hover:text-gray-600'}`}>
            {tab.label}
            {tab.dot && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">

        {/* ── INPUTS TAB ────────────────────────────────────────────────── */}
        {activeTab === 'inputs' && (
          <div>
            <SectionHeader title="Income">
              <button onClick={() => { if (window.confirm('Reset income to defaults?')) resetSection('income') }}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600">
                <RotateCcw size={10} /> Reset
              </button>
            </SectionHeader>
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Effective occupancy</span>
                <span className="font-medium">{d.GSR > 0 ? ((1 - d.vac / d.GSR) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, d.GSR > 0 ? (1 - d.vac / d.GSR) * 100 : 0)}%`,
                    background: d.dcr < 0.8 ? '#A32D2D' : d.dcr < 0.93 ? '#854F0B' : '#1D6B3E'
                  }} />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>0%</span>
                <span>GSR: {fmtDollar(d.GSR)} · Vacancy: ({fmtDollar(d.vac)})</span>
                <span>100%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-1">
              <InputField label="Total units" type="number" value={inputs.tu} min={1} max={100} step={1}
                tooltip="Total number of rentable units in the property"
                badge="OM" onChange={e => set('tu', +e.target.value)} />
              <InputField label="Units occupied" type="number" value={inputs.ou} min={0} max={inputs.tu} step={1}
                tooltip="Units currently occupied. If less than total units, physical vacancy method is used instead of OM method"
                badge="OM" onChange={e => set('ou', +e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <InputField label="Avg rent / unit / mo ($)" type="number" dollar value={inputs.rent} min={500} step={25}
                tooltip="Blended average monthly rent across all units"
                badge="OM" onChange={e => set('rent', +e.target.value)} />
              <InputField
                label={method === 'om' ? 'Vacancy % (of GSR)' : 'Turnover buffer %'}
                type="number" value={inputs.vp} min={0} max={50} step={0.5}
                tooltip="Economic vacancy allowance - used in OM method only. Typically 4-5% for stabilized properties"
                badge="OM" onChange={e => set('vp', +e.target.value)} />
            </div>
            <div className="mt-2 space-y-1">
              {(inputs.otherIncome ?? []).map((item, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <input value={item.label} onChange={e => updateOtherIncome(i, 'label', e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
                  <input value={item.amount} type="number" onChange={e => updateOtherIncome(i, 'amount', +e.target.value)}
                    className="w-24 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400 text-right" />
                  <button onClick={() => removeOtherIncome(i)} className="text-gray-300 hover:text-red-400 px-1 text-sm font-bold">×</button>
                </div>
              ))}
              <button onClick={addOtherIncome}
                className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium mt-1">
                <span className="text-base leading-none">+</span> Add income line
              </button>
            </div>

            <SectionHeader title="Financing">
              <button onClick={() => { if (window.confirm('Reset financing to defaults?')) resetSection('financing') }}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600">
                <RotateCcw size={10} /> Reset
              </button>
            </SectionHeader>
            <div className="grid grid-cols-2 gap-2">
              <InputField {...omBadge('price')} label="Purchase price ($)" type="number" dollar value={inputs.price} step={10000}
                tooltip="Total acquisition price. Drives loan amount, depreciation basis, and all return metrics"
                badge="OM" onChange={e => set('price', +e.target.value)} />
              <InputField {...omBadge('ir')} label="Interest rate (%)" type="number" value={inputs.ir} step={0.125}
                tooltip="Annual mortgage interest rate"
                badge="OM" onChange={e => set('ir', +e.target.value)} />
              <InputField {...omBadge('lev')} label="Leverage / LTV (%)" type="number" value={inputs.lev} min={0} max={100} step={1}
                tooltip="Loan-to-value ratio. e.g. 70 = 70% LTV, 30% down"
                badge="OM" onChange={e => set('lev', +e.target.value)} />
              <InputField {...omBadge('am')} label="Amortization (years)" type="number" value={inputs.am} step={5}
                tooltip="Loan term in years for payment calculation"
                badge="OM" onChange={e => set('am', +e.target.value)} />
              <InputField {...omBadge('lf')} label="Lender fee (%)" type="number" value={inputs.lf} step={0.125}
                tooltip="Origination fee as % of loan amount - added to cash to close"
                onChange={e => set('lf', +e.target.value)} />
              <InputField {...omBadge('cc')} label="Closing costs (% of price)" type="number" value={inputs.cc} step={0.25}
                tooltip="Additional closing costs as % of purchase price"
                onChange={e => set('cc', +e.target.value)} />
            </div>

            <SectionHeader title="Expenses">
              <div className="flex items-center gap-2">
                {!inputs.expCollapse && (
                  <button onClick={() => { if (window.confirm('Reset expenses to defaults?')) resetSection('expenses') }}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600">
                    <RotateCcw size={10} /> Reset
                  </button>
                )}
                {d.EGI > 0 && (
                  <span className="text-[10px] font-medium text-gray-500">
                    {((d.exp / d.EGI) * 100).toFixed(1)}% of EGI
                  </span>
                )}
                <button
                  onClick={() => set('expCollapse', !inputs.expCollapse)}
                  className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-700">
                  <span>{inputs.expCollapse ? 'Itemize' : 'Collapse'}</span>
                  <div className={`w-7 h-3.5 rounded-full transition-colors flex items-center px-0.5
                    ${inputs.expCollapse ? 'bg-amber-400' : 'bg-gray-300'}`}>
                    <div className={`w-2.5 h-2.5 bg-white rounded-full shadow transition-transform
                      ${inputs.expCollapse ? 'translate-x-3' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            </SectionHeader>
            {inputs.expCollapse ? (
              <InputField label="Expense ratio (% of EGI)" type="number" value={inputs.expPct} step={0.5}
                badgeColor="amber" badge="blended" onChange={e => set('expPct', +e.target.value)} />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <InputField {...omBadge('tax')} label="Real Estate Taxes (annual $)" type="number" dollar value={inputs.tax} step={500}
                    tooltip="Annual property tax bill. Should reflect post-sale reassessment - Florida reassesses at purchase price on sale"
                    badge="OM" onChange={e => set('tax', +e.target.value)} />
                  <div className="text-[10px] text-gray-400 mt-0.5 h-3">{inputs.tax > 0 && <>${Math.round(inputs.tax / 12).toLocaleString()}/mo{inputs.tu > 0 ? ` · $${Math.round(inputs.tax / inputs.tu).toLocaleString()}/unit` : ''}</>}</div>
                </div>
                <div>
                  <InputField {...omBadge('ins')} label="Insurance ($/unit/yr)" type="number" dollar value={inputs.ins} step={100}
                    tooltip="Insurance cost per unit per year. Calc multiplies by total units for annual total. Benchmark: $2,000-$3,000+/unit depending on building age"
                    badge="OM" onChange={e => set('ins', +e.target.value)} />
                  <div className="text-[10px] text-gray-400 mt-0.5 h-3">{inputs.ins > 0 && inputs.tu > 0 && <>${Math.round(inputs.ins * inputs.tu / 12).toLocaleString()}/mo total · ${(inputs.ins * inputs.tu).toLocaleString()}/yr</>}</div>
                </div>
                <div className="col-span-2 border-l-2 border-gray-200 pl-2 space-y-1.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <InputField label="Electric ($)" type="number" dollar value={inputs.utilElec ?? 0} step={100}
                        tooltip="Landlord-paid electric - common areas, exterior lighting"
                        onChange={e => { const v = +e.target.value; setInputs(prev => ({ ...prev, utilElec: v, util: v + (prev.utilWater ?? 0) + (prev.utilTrash ?? 0) })) }} />
                      <div className="text-[10px] text-gray-400 mt-0.5 h-3">{(inputs.utilElec ?? 0) > 0 && <>${Math.round((inputs.utilElec ?? 0) / 12).toLocaleString()}/mo</>}</div>
                    </div>
                    <div>
                      <InputField label="Water & Sewer ($)" type="number" dollar value={inputs.utilWater ?? 0} step={100}
                        tooltip="Water and sewer - typically landlord-paid in multifamily"
                        onChange={e => { const v = +e.target.value; setInputs(prev => ({ ...prev, utilWater: v, util: (prev.utilElec ?? 0) + v + (prev.utilTrash ?? 0) })) }} />
                      <div className="text-[10px] text-gray-400 mt-0.5 h-3">{(inputs.utilWater ?? 0) > 0 && <>${Math.round((inputs.utilWater ?? 0) / 12).toLocaleString()}/mo</>}</div>
                    </div>
                    <div>
                      <InputField label="Trash ($)" type="number" dollar value={inputs.utilTrash ?? 0} step={100}
                        tooltip="Trash removal and waste hauling"
                        onChange={e => { const v = +e.target.value; setInputs(prev => ({ ...prev, utilTrash: v, util: (prev.utilElec ?? 0) + (prev.utilWater ?? 0) + v })) }} />
                      <div className="text-[10px] text-gray-400 mt-0.5 h-3">{(inputs.utilTrash ?? 0) > 0 && <>${Math.round((inputs.utilTrash ?? 0) / 12).toLocaleString()}/mo</>}</div>
                    </div>
                  </div>
                  <div>
                    <InputField {...omBadge('util')} label="Total Utilities (annual $)" type="number" dollar value={inputs.util} step={500}
                      tooltip="Landlord-paid utilities - water, trash, common area electric"
                      badge={inputs.util === ((inputs.utilElec ?? 0) + (inputs.utilWater ?? 0) + (inputs.utilTrash ?? 0)) ? 'auto' : undefined}
                      badgeColor="blue"
                      onChange={e => set('util', +e.target.value)} />
                    <div className="text-[10px] text-gray-400 mt-0.5 h-3">{inputs.util > 0 && <>${Math.round(inputs.util / 12).toLocaleString()}/mo{inputs.tu > 0 ? ` · $${Math.round(inputs.util / inputs.tu).toLocaleString()}/unit` : ''}</>}</div>
                  </div>
                </div>
                <div>
                  <InputField {...omBadge('rm')} label="R&M ($/unit/yr)" type="number" dollar value={inputs.rm} step={50}
                    tooltip="Repairs and maintenance per unit per year. Calc multiplies by total units. Benchmark: $400-$900/unit/yr depending on building age"
                    badge="OM" onChange={e => set('rm', +e.target.value)} />
                  <div className="text-[10px] text-gray-400 mt-0.5 h-3">{inputs.rm > 0 && inputs.tu > 0 && <>${Math.round(inputs.rm * inputs.tu / 12).toLocaleString()}/mo total · ${(inputs.rm * inputs.tu).toLocaleString()}/yr</>}</div>
                </div>
                <div>
                  <InputField {...omBadge('cs')} label="Contract Services (annual)" type="number" dollar value={inputs.cs} step={100}
                    tooltip="Annual contract services total — landscaping, pest control, elevator, pool service etc."
                    badge="OM" onChange={e => set('cs', +e.target.value)} />
                  <div className="text-[10px] text-gray-400 mt-0.5 h-3">{inputs.cs > 0 && <>${Math.round(inputs.cs / 12).toLocaleString()}/mo{inputs.tu > 0 ? ` · $${Math.round(inputs.cs / inputs.tu).toLocaleString()}/unit` : ''}</>}</div>
                </div>
                <div>
                  <InputField {...omBadge('ga')} label="General & Admin (annual)" type="number" dollar value={inputs.ga} step={100}
                    tooltip="Annual G&A total — office, phone, misc. Typically $75-100/unit/yr"
                    badge="OM" onChange={e => set('ga', +e.target.value)} />
                  <div className="text-[10px] text-gray-400 mt-0.5 h-3">{inputs.ga > 0 && <>${Math.round(inputs.ga / 12).toLocaleString()}/mo{inputs.tu > 0 ? ` · $${Math.round(inputs.ga / inputs.tu).toLocaleString()}/unit` : ''}</>}</div>
                </div>
                <div>
                  <InputField {...omBadge('res')} label="Reserves ($/unit/yr)" type="number" dollar value={inputs.res} step={50}
                    tooltip="Capital reserve per unit per year. Calc multiplies by total units. Benchmark: $250-$700/unit/yr depending on building age"
                    badge="OM" onChange={e => set('res', +e.target.value)} />
                  <div className="text-[10px] text-gray-400 mt-0.5 h-3">{inputs.res > 0 && inputs.tu > 0 && <>${Math.round(inputs.res * inputs.tu / 12).toLocaleString()}/mo total · ${(inputs.res * inputs.tu).toLocaleString()}/yr</>}</div>
                </div>
                <InputField {...omBadge('pm')} label="Prop. mgmt (%)" type="number" value={inputs.pm} step={0.5}
                  tooltip="Property management fee as % of effective gross income. Typically 8-10% for small multifamily"
                  badge="OM" onChange={e => set('pm', +e.target.value)} />
              </div>
            )}

            <div className="mt-2 space-y-1">
              {(inputs.otherExpenses ?? []).map((item, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <input value={item.label} onChange={e => updateOtherExpense(i, 'label', e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
                  <input value={item.amount} type="number" onChange={e => updateOtherExpense(i, 'amount', +e.target.value)}
                    className="w-24 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400 text-right" />
                  <button onClick={() => removeOtherExpense(i)} className="text-gray-300 hover:text-red-400 px-1 text-sm font-bold">×</button>
                </div>
              ))}
              <button onClick={addOtherExpense}
                className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium mt-1">
                <span className="text-base leading-none">+</span> Add expense line
              </button>
            </div>

            <SectionHeader title="Tax" />
            <div className="grid grid-cols-2 gap-2">
              <InputField label="Tax bracket (%)" type="number" value={inputs.brk} step={1}
                tooltip="Your marginal federal income tax rate. Used to calculate tax savings from depreciation deductions"
                badgeColor="amber" badge="yours" onChange={e => set('brk', +e.target.value)} />
              <InputField label="Land % (non-depreciable)" type="number" value={inputs.land} step={1}
                tooltip="Estimated % of purchase price allocated to land. Land is not depreciable. Typically 15-25% in Florida."
                badgeColor="amber" badge="estimated" onChange={e => set('land', +e.target.value)} />
              <InputField label="Cost seg % (5/7/15yr)" type="number" value={inputs.costSeg} step={1}
                tooltip="% of depreciable building value reclassified to 5/7/15-year property via cost segregation study. Qualifies for 100% bonus depreciation. Typically 20-30% of building value."
                badgeColor="amber" badge="estimated" onChange={e => set('costSeg', +e.target.value)} />
            </div>
            {omScenario?.id !== currentScenarioId && (
            <div className="mt-3 flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <p className="text-xs font-medium text-gray-700">1031 Exchange — buyer tax structuring</p>
                <p className="text-[10px] text-gray-400">Use carryover basis for depreciation</p>
              </div>
              <button
                onClick={() => set('is1031', !inputs.is1031)}
                className="flex items-center gap-1">
                <div className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5
                  ${inputs.is1031 ? 'bg-amber-400' : 'bg-gray-300'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform
                    ${inputs.is1031 ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>
            )}
            {omScenario?.id !== currentScenarioId && inputs.is1031 && (
              <div className="mt-2 space-y-2">
                <InputField label="1031 equity rolling in ($)" type="number" dollar value={inputs.equity1031} step={10000}
                  tooltip="Net proceeds from your relinquished property rolling into this purchase. Reduces cash required at closing"
                  badgeColor="amber" badge="from relinquished sale" onChange={e => set('equity1031', +e.target.value)} />
                <InputField label="Est. carryover adjusted basis ($)" type="number" dollar value={inputs.basis1031} step={10000} min={0}
                  tooltip="In a 1031 exchange, your depreciation basis carries over from the relinquished property. Enter the remaining adjusted basis of the property you sold"
                  badgeColor="amber" badge="verify w/ CPA" onChange={e => set('basis1031', Math.max(0, +e.target.value))} />
                <p className="text-[10px] text-amber-700 px-1">
                  ⚠ Carryover basis determines bonus dep — NOT purchase price. Equity rolling in reduces cash to close. Verify both with CPA.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── P&L TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'pl' && (
          <div>
            <SectionHeader title={`Key metrics — ${method === 'om' ? 'OM method' : 'Physical occupancy'}`} />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <MetricCard label="NOI" value={fmtDollar(d.NOI)}
                sub={omScenario && omScenario.id !== currentScenarioId ? `OM: ${fmtDollar(calculate(omScenario.inputs, true).NOI)}` : undefined}
                valueColor={d.NOI < 80000 ? 'text-amber-600' : 'text-blue-700'} />
              <MetricCard label="Cap rate" value={fmtPct(d.cap)}
                sub={omScenario && omScenario.id !== currentScenarioId ? `OM: ${fmtPct(calculate(omScenario.inputs, true).cap)}` : undefined}
                valueColor={d.cap < 5 ? 'text-red-600' : d.cap < 6 ? 'text-amber-600' : ''} />
              <MetricCard label="DCR" value={fmtX(d.dcr)} sub="lender min 1.20×"
                valueColor={d.dcr < 1 ? 'text-red-600' : d.dcr < 1.2 ? 'text-amber-600' : 'text-green-700'} />
              <MetricCard label="Pre-tax cash flow" value={fmtNeg(d.CF)}
                sub={omScenario && omScenario.id !== currentScenarioId ? `OM: ${fmtNeg(calculate(omScenario.inputs, true).CF)}` : undefined}
                valueColor={d.CF < 0 ? 'text-red-600' : d.CF < 1000 ? 'text-amber-600' : 'text-green-700'} />
            </div>
            <DCRBar dcr={d.dcr} />
            <div className="mt-2 mb-3"><Alert type={dcrAlert.type}>{dcrAlert.msg}</Alert></div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetricCard label="Loan amount" value={fmtDollar(d.loan)} sub={`${d.lev.toFixed(0)}% LTV`} />
              <MetricCard label="Annual debt service" value={fmtDollar(d.ds)} sub={`${fmtDollar(d.mp)}/mo`} />
              <MetricCard label="Equity required" value={fmtDollar(d.eq)} sub="down + lender fee" />
              <MetricCard label="Cash to close" value={fmtDollar(Math.max(0, d.eq + d.ccAmt - (inputs.equity1031 ?? 0)))} sub={inputs.is1031 && inputs.equity1031 > 0 ? `after $${Math.round(inputs.equity1031).toLocaleString()} 1031 equity` : inputs.cc > 0 ? `incl. ${inputs.cc}% closing costs` : "closing costs not set"} valueColor={inputs.equity1031 > d.eq + d.ccAmt ? "text-amber-600" : undefined} />
            </div>
            <SectionHeader title="Income & expense statement" />
            <div className="border border-gray-100 rounded-lg p-3 mb-3">
              <PLRow label={method === 'om' ? 'Gross scheduled rent (GSR)' : 'Gross potential rent (GPR)'}
                value={fmtDollar(d.GSR)} variant="pos" />
              <PLRow label={method === 'om' ? `Less: vacancy (${d.vp}% of GSR)` : `Less: physical vacancy (${d.tu - d.ou} unit${d.tu - d.ou !== 1 ? 's' : ''} empty)`}
                value={`(${fmtDollar(d.pv)})`} variant="neg" indent />
              {method === 'physical' && d.av > 0 && (
                <PLRow label={`Less: turnover buffer (${d.vp}%)`} value={`(${fmtDollar(d.av)})`} variant="neg" indent />
              )}
              <PLRow label="Collected rental income" value={fmtDollar(d.col)} indent />
              {(inputs.otherIncome ?? []).map((item, i) => (
                <PLRow key={i} label={item.label} value={`$${item.amount.toLocaleString()}`} variant="pos" indent />
              ))}
              <PLRow label="Effective gross income" value={fmtDollar(d.EGI)} variant="total" />
              {[
                { label: 'Real estate taxes', v: d.taxTotal },
                { label: 'Insurance', v: d.ins },
                { label: 'Utilities', v: d.util },
                { label: 'Repairs & maintenance', v: d.rm },
                { label: 'Contract services', v: d.cs },
                { label: 'G&A', v: d.ga },
                { label: 'Reserves', v: d.res },
              ].map((row, i) => (
                <PLRow key={i} label={row.label} variant="neg" indent value={
                  <div className="text-right">
                    <span className="text-xs font-medium">${Math.round(row.v / 12).toLocaleString()}/mo</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">
                      (${row.v.toLocaleString()}/yr{d.tu > 0 ? ` · $${Math.round(row.v / d.tu).toLocaleString()}/unit` : ''})
                    </span>
                  </div>
                } />
              ))}
              <PLRow label={`Prop. mgmt (${d.pmPct.toFixed(1)}% EGI)`} value={`(${fmtDollar(d.pm)})`} variant="neg" indent />
              {(inputs.otherExpenses ?? []).map((item, i) => (
                <PLRow key={i} label={item.label} value={`(${fmtDollar(item.amount)})`} variant="neg" indent />
              ))}
              <PLRow label="Total expenses" variant="total" value={
                <div className="text-right">
                  <span className="text-xs font-semibold">${Math.round(d.exp / 12).toLocaleString()}/mo</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">
                    (${d.exp.toLocaleString()}/yr{d.tu > 0 ? ` · $${Math.round(d.exp / d.tu).toLocaleString()}/unit` : ''})
                  </span>
                </div>
              } />
              <PLRow label="Net operating income" value={fmtDollar(d.NOI)} variant="noi" />
              <PLRow label="Annual debt service" value={`(${fmtDollar(d.ds)})`} variant="neg" indent />
              <PLRow label="Pre-tax cash flow" value={fmtNeg(d.CF)} variant="cf" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
              <strong>Prepayment penalty (3/2/1)</strong><br />
              Yr 1: {fmtDollar(d.loan * 0.03)} · Yr 2: {fmtDollar(d.loan * 0.02)} · Yr 3: {fmtDollar(d.loan * 0.01)}
            </div>

            {/* Offer calculator */}
            {omScenario?.id !== currentScenarioId && d.NOI > 0 && (() => {
              const mode = inputs.offerCalcMode ?? 'cap'
              const setMode = (m: 'cap' | 'price') => setInputs(prev => ({ ...prev, offerCalcMode: m }))
              const targetPrice = inputs.targetOfferPrice ?? 0
              const setTargetPrice = (v: number) => setInputs(prev => ({ ...prev, targetOfferPrice: v }))

              // Compute offer price and implied cap based on mode
              const offerPrice = mode === 'cap'
                ? (targetCap > 0 ? d.NOI / (targetCap / 100) : 0)
                : targetPrice
              const impliedCap = mode === 'price' && targetPrice > 0
                ? (d.NOI / targetPrice) * 100 : 0
              const hasResult = offerPrice > 0

              // Financing at offer price
              const offerLoan = offerPrice * inputs.lev / 100
              const offerDown = offerPrice - offerLoan
              const offerDS = (() => {
                const r = inputs.ir / 100 / 12
                const n = inputs.am * 12
                if (r === 0 || n === 0) return 0
                const mp = (offerLoan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
                return mp * 12
              })()
              const offerDCR = offerDS > 0 ? d.NOI / offerDS : 0
              const delta = offerPrice - inputs.price
              const deltaPct = inputs.price > 0 ? (delta / inputs.price) * 100 : 0

              return (
                <div className="mt-3 border border-green-200 rounded-lg overflow-hidden">
                  <div className="bg-green-800 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-white">Offer calculator</p>
                      <span className="relative group">
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-700 text-[9px] text-green-300 cursor-help font-semibold leading-none">i</span>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 px-2.5 py-2 text-[10px] leading-snug text-white bg-gray-800 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                          Back-solve an offer price from your target cap rate, or check the implied cap at a specific price.
                        </span>
                      </span>
                    </div>
                    <div className="flex bg-green-900/50 rounded-md overflow-hidden">
                      <button onClick={() => setMode('cap')}
                        className={`text-[9px] font-medium px-2.5 py-1 transition-colors ${mode === 'cap' ? 'bg-white/20 text-white' : 'text-green-400 hover:text-white'}`}>
                        Target cap rate
                      </button>
                      <button onClick={() => setMode('price')}
                        className={`text-[9px] font-medium px-2.5 py-1 transition-colors ${mode === 'price' ? 'bg-white/20 text-white' : 'text-green-400 hover:text-white'}`}>
                        Target price
                      </button>
                    </div>
                  </div>
                  <div className="bg-green-50 px-3 pt-3 pb-2">
                    {mode === 'cap' ? (
                      <div className="flex items-center gap-2 mb-3">
                        <label className="text-xs text-gray-600 whitespace-nowrap">Target cap rate</label>
                        <div className="relative flex-1">
                          <input type="number" step={0.01} min={0} max={20}
                            value={targetCap || ''} placeholder="e.g. 6.5"
                            onChange={e => setTargetCap(+e.target.value)}
                            className="w-full text-sm font-semibold border border-green-300 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-green-500 bg-white" />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-3">
                        <label className="text-xs text-gray-600 whitespace-nowrap">Target price</label>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                          <input type="text" inputMode="decimal"
                            value={targetPrice ? targetPrice.toLocaleString('en-US') : ''} placeholder="e.g. 1,800,000"
                            onFocus={e => { e.target.value = targetPrice ? String(targetPrice) : ''; e.target.select() }}
                            onBlur={e => { const v = parseFloat(e.target.value.replace(/,/g, '')) || 0; setTargetPrice(v) }}
                            onChange={e => { const v = parseFloat(e.target.value.replace(/,/g, '')) || 0; setTargetPrice(v) }}
                            className="w-full text-sm font-semibold border border-green-300 rounded-lg pl-6 pr-3 py-1.5 focus:outline-none focus:border-green-500 bg-white" />
                        </div>
                      </div>
                    )}
                    {hasResult ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="text-[10px] text-gray-500 mb-0.5">{mode === 'cap' ? 'Implied offer price' : 'Offer price'}</div>
                            <div className="text-lg font-bold text-green-800">{fmtDollar(offerPrice)}</div>
                            <div className={`text-[10px] font-semibold mt-0.5 ${delta < 0 ? 'text-green-700' : 'text-red-600'}`}>
                              {delta < 0 ? '▼' : '▲'} {fmtDollar(Math.abs(delta))} ({Math.abs(deltaPct).toFixed(1)}%) vs. asking
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="text-[10px] text-gray-500 mb-0.5">{mode === 'cap' ? 'Target cap rate' : 'Implied cap rate'}</div>
                            <div className="text-lg font-bold text-gray-800">{mode === 'cap' ? `${targetCap.toFixed(2)}%` : `${impliedCap.toFixed(2)}%`}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">asking cap: {fmtPct(d.cap)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="text-[10px] text-gray-500 mb-0.5">Price / unit</div>
                            <div className="text-base font-bold text-gray-800">{inputs.tu > 0 ? fmtDollar(offerPrice / inputs.tu) : '—'}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">asking: {inputs.tu > 0 ? fmtDollar(inputs.price / inputs.tu) : '—'}/unit</div>
                          </div>
                          <div className={`bg-white rounded-lg p-2.5 border border-green-200`}>
                            <div className="text-[9px] text-gray-500">DCR at offer</div>
                            <div className={`text-base font-bold ${offerDCR < 1 ? 'text-red-600' : offerDCR < 1.2 ? 'text-amber-600' : 'text-green-700'}`}>{fmtX(offerDCR)}</div>
                            <div className="text-[9px] text-gray-400">min 1.20×</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="bg-white rounded-lg p-2 text-center border border-green-200">
                            <div className="text-[9px] text-gray-500">Down payment</div>
                            <div className="text-xs font-semibold text-gray-800">{fmtDollar(offerDown)}</div>
                            <div className="text-[9px] text-gray-400">{(100 - inputs.lev).toFixed(0)}% equity</div>
                          </div>
                          <div className="bg-white rounded-lg p-2 text-center border border-green-200">
                            <div className="text-[9px] text-gray-500">Loan amount</div>
                            <div className="text-xs font-semibold text-gray-800">{fmtDollar(offerLoan)}</div>
                            <div className="text-[9px] text-gray-400">{inputs.ir}% / {inputs.am}yr</div>
                          </div>
                        </div>
                        <div className="mt-2.5">
                          {applyConfirm ? (
                            <p className="text-[10px] text-green-700 font-medium text-center py-1.5">Applied ✓ — loan, depreciation & tax recalculated</p>
                          ) : (
                            <button
                              onClick={() => {
                                setInputs(prev => ({ ...prev, price: Math.round(offerPrice), targetCapRate: 0, targetOfferPrice: 0 }))
                                setApplyConfirm(true)
                                setTimeout(() => setApplyConfirm(false), 2000)
                              }}
                              className="w-full text-[10px] font-semibold py-1.5 rounded-lg border border-green-400 text-green-700 bg-white hover:bg-green-100 transition-colors">
                              Apply {fmtDollar(offerPrice)} as purchase price
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-gray-400 text-center py-2">
                        {mode === 'cap' ? 'Enter a target cap rate to see implied offer price' : 'Enter a target price to see implied cap rate'}
                      </p>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── TAX TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'tax' && (
          <div>
            <SectionHeader title="Tax analysis — REP · 100% bonus dep · 1031" tooltip="Year 1 tax impact assuming Real Estate Professional status, 100% bonus depreciation on cost-segregated components, and straight-line on the remainder." />
            <div className="border border-gray-100 rounded-lg p-3 mb-3">
              <PLRow label="NOI" value={fmtDollar(d.NOI)} variant="noi" />
              <PLRow label="Less: Y1 mortgage interest" value={`(${fmtDollar(d.int1)})`} variant="neg" indent />
              <PLRow label="Income before depreciation" value={fmtNeg(d.ti)} variant="total" />
              <PLRow label="Bonus dep — 5/7/15-yr (100%)" value={`(${fmtDollar(d.bd)})`} variant="pos" indent />
              <PLRow label="27.5-yr straight-line dep" value={`(${fmtDollar(d.sl)})`} variant="pos" indent />
              <PLRow label="Year 1 paper loss (REP offset)" value={`(${fmtDollar(Math.abs(d.loss))})`} variant="total" />
              <PLRow label={`Tax savings @ ${d.brk}%`} value={fmtDollar(d.ts)} variant="pos" />
              <PLRow label="After-tax cash flow" value={fmtNeg(d.at)} />
              <PLRow label="Principal reduction (Y1)" value={fmtDollar(d.prin1)} variant="pos" indent />
              <PLRow label="Total Y1 economic return" value={fmtDollar(d.y1)} variant="total" />
            </div>
            <SectionHeader title="Return on equity" tooltip="Cash-on-cash and total return metrics measured against your equity invested (down payment + lender fee)." />
            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetricCard label="Pre-tax CoC" value={fmtPct(d.coc)} sub="CF / equity"
                valueColor={d.coc < 0 ? 'text-red-600' : d.coc < 2 ? 'text-amber-600' : 'text-green-700'} />
              <MetricCard label="After-tax CoC" value={fmtPct(d.atc)} sub="incl. tax savings"
                valueColor={d.atc < 0 ? 'text-red-600' : d.atc < 2 ? 'text-amber-600' : 'text-green-700'} />
              <MetricCard label="Y1 total ROE" value={fmtPct(d.r1)} sub="incl. principal"
                valueColor={d.r1 < 10 ? 'text-amber-600' : 'text-green-700'} />
              <MetricCard label="Yr 2+ stabilized ROE" value={fmtPct(d.r2)} sub="dep shield + princ." />
            </div>
            {d.brk > 0 && (inputs.costSeg > 0 || inputs.land < 100)
              ? <TaxBenefitSection d={d} inputs={inputs} />
              : <p className="text-[10px] text-gray-400 mt-3">Enter your tax bracket and depreciation inputs on the Inputs tab to see the tax benefit analysis.</p>
            }
            <p className="text-[10px] text-gray-400 leading-relaxed mt-3">
              ⚠️ 1031 carryover basis — depreciable basis = relinquished property's remaining adjusted basis,
              NOT purchase price. Verify with CPA before projecting Year 1 tax savings.
            </p>
          </div>
        )}

        {/* ── OM TAB ───────────────────────────────────────────────────────── */}
        {activeTab === 'om' && (
          <div>
            <div className="mt-3 mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-800">OM as-presented</p>
                <p className="text-[10px] text-blue-500">{omLocked ? 'Read-only — broker figures' : 'Unlocked for editing'}</p>
              </div>
              <button
                onClick={() => {
                  if (omLocked) { setOmSnapshot({ ...inputs }); setOmLocked(false) }
                  else { setOmLocked(true); setOmSnapshot(null) }
                }}
                className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${omLocked ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                {omLocked ? '✏️ Edit' : '🔒 Lock'}
              </button>
            </div>
            {!omLocked && (
              <div className="mb-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 text-[10px] text-amber-700">
                  ⚠️ Editing OM figures. Press 🔒 Lock when done, then Save.
                  {omSnapshot && (
                    <button onClick={() => { setInputs({ ...OM_DEFAULTS }); setOmLocked(true); setOmSnapshot(null) }}
                      className="ml-2 underline font-semibold">
                      Revert changes
                    </button>
                  )}
                </div>
                <SectionHeader title="Income" />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <InputField label="Total units" type="number" value={inputs.tu} step={1} onChange={e => set('tu', +e.target.value)} />
                  <InputField label="Avg rent / unit / mo ($)" type="number" dollar value={inputs.rent} step={25} onChange={e => set('rent', +e.target.value)} />
                  <InputField label="Vacancy % (of GSR)" type="number" value={inputs.vp} step={0.5} onChange={e => set('vp', +e.target.value)} />
                </div>
                <SectionHeader title="Financing" />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <InputField label="Purchase price ($)" type="number" dollar value={inputs.price} step={10000} onChange={e => set('price', +e.target.value)} />
                  <InputField label="LTV (%)" type="number" value={inputs.lev} step={1} onChange={e => set('lev', +e.target.value)} />
                  <InputField label="Interest rate (%)" type="number" value={inputs.ir} step={0.125} onChange={e => set('ir', +e.target.value)} />
                  <InputField label="Amortization (yrs)" type="number" value={inputs.am} step={5} onChange={e => set('am', +e.target.value)} />
                </div>
                <SectionHeader title="Expenses" />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <InputField label="Real estate taxes ($)" type="number" dollar value={inputs.tax} step={500} onChange={e => set('tax', +e.target.value)} />
                  <InputField label="Insurance ($/unit/yr)" type="number" dollar value={inputs.ins} step={100} onChange={e => set('ins', +e.target.value)} />
                  <InputField label="Total Utilities ($)" type="number" dollar value={inputs.util} step={500} onChange={e => set('util', +e.target.value)} />
                  <InputField label="R&M ($/unit/yr)" type="number" dollar value={inputs.rm} step={50} onChange={e => set('rm', +e.target.value)} />
                  <InputField label="Contract services ($)" type="number" dollar value={inputs.cs} step={100} onChange={e => set('cs', +e.target.value)} />
                  <InputField label="G&A ($)" type="number" dollar value={inputs.ga} step={100} onChange={e => set('ga', +e.target.value)} />
                  <InputField label="Reserves ($/unit/yr)" type="number" dollar value={inputs.res} step={50} onChange={e => set('res', +e.target.value)} />
                  <InputField label="Prop. mgmt (%)" type="number" value={inputs.pm} step={0.5} onChange={e => set('pm', +e.target.value)} />
                </div>
              </div>
            )}
            <SectionHeader title="Key metrics — OM method" />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <MetricCard label="NOI" value={fmtDollar(omTabD.NOI)} valueColor="text-blue-700" />
              <MetricCard label="Cap rate" value={fmtPct(omTabD.cap)} />
              <MetricCard label="DCR" value={fmtX(omTabD.dcr)} sub="lender min 1.20×" valueColor={omTabD.dcr < 1.2 ? 'text-amber-600' : 'text-green-700'} />
              <MetricCard label="Pre-tax cash flow" value={fmtNeg(omTabD.CF)} valueColor={omTabD.CF < 0 ? 'text-red-600' : 'text-green-700'} />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetricCard label="Loan amount" value={fmtDollar(omTabD.loan)} sub={`${omTabD.lev.toFixed(0)}% LTV`} />
              <MetricCard label="Annual debt service" value={fmtDollar(omTabD.ds)} sub={`${fmtDollar(omTabD.mp)}/mo`} />
              <MetricCard label="Equity required" value={fmtDollar(omTabD.eq)} sub="down + lender fee" />
              <MetricCard label="Cash to close" value={fmtDollar(Math.max(0, omTabD.eq + omTabD.ccAmt - (omInputs.equity1031 ?? 0)))} sub={omInputs.is1031 && (omInputs.equity1031 ?? 0) > 0 ? `after $${Math.round(omInputs.equity1031).toLocaleString()} 1031 equity` : omInputs.cc > 0 ? `incl. ${omInputs.cc}% closing costs` : "closing costs not set"} />
            </div>
            <SectionHeader title="OM income & expense statement" />
            <div className="border border-blue-100 rounded-lg p-3 mb-3 bg-blue-50/30">
              <PLRow label="Gross scheduled rent (GSR)" value={fmtDollar(d.GSR)} variant="pos" />
              <PLRow label={`Less: vacancy (${d.vp}% of GSR)`} value={`(${fmtDollar(d.pv)})`} variant="neg" indent />
              <PLRow label="Collected rental income" value={fmtDollar(d.col)} indent />
              {(inputs.otherIncome ?? []).map((item, i) => (
                <PLRow key={i} label={item.label} value={`$${item.amount.toLocaleString()}`} variant="pos" indent />
              ))}
              <PLRow label="Effective gross income" value={fmtDollar(d.EGI)} variant="total" />
              <PLRow label="Real estate taxes" value={`(${fmtDollar(d.taxTotal)})`} variant="neg" indent />
              <PLRow label={`Insurance (${d.tu} doors)`} value={`(${fmtDollar(d.ins)})`} variant="neg" indent />
              <PLRow label="Utilities" value={`(${fmtDollar(d.util)})`} variant="neg" indent />
              <PLRow label="Repairs & maintenance" value={`(${fmtDollar(d.rm)})`} variant="neg" indent />
              <PLRow label="Contract services" value={`(${fmtDollar(d.cs)})`} variant="neg" indent />
              <PLRow label="G&A" value={`(${fmtDollar(d.ga)})`} variant="neg" indent />
              <PLRow label="Reserves" value={`(${fmtDollar(d.res)})`} variant="neg" indent />
              <PLRow label={`Prop. mgmt (${d.pmPct.toFixed(1)}% EGI)`} value={`(${fmtDollar(d.pm)})`} variant="neg" indent />
              <PLRow label="Total expenses" value={`(${fmtDollar(d.exp)})`} variant="total" />
              <PLRow label="Net operating income" value={fmtDollar(d.NOI)} variant="noi" />
              <PLRow label={`Annual debt service (${d.lev.toFixed(0)}% LTV)`} value={`(${fmtDollar(d.ds)})`} variant="neg" indent />
              <PLRow label="Pre-tax cash flow" value={fmtNeg(d.CF)} variant="cf" />
            </div>
            <SectionHeader title="OM inputs reference" />
            <div className="rounded-lg border border-gray-100 overflow-hidden mb-3">
              {[
                ['Purchase price', `$${inputs.price.toLocaleString()}`],
                ['Units', `${inputs.tu} units`],
                ['Avg rent / unit', `$${Math.round(inputs.rent).toLocaleString()}/mo`],
                ['Vacancy', `${inputs.vp}% of GSR`],
                ['LTV', `${inputs.lev}% ($${Math.round(d.loan).toLocaleString()} loan)`],
                ['Interest rate', `${inputs.ir}% / ${inputs.am}yr amort`],
                ['Real estate taxes', `$${inputs.tax.toLocaleString()}`],
                ['Insurance', `$${inputs.ins.toLocaleString()}/door ($${(inputs.ins * inputs.tu).toLocaleString()})`],
                ['Prop. mgmt', `${inputs.pm}% of EGI`],
                ['Cap rate', fmtPct(d.cap)],
                ['Cash-on-cash', fmtPct(d.coc)],
              ].map(([k, v], i) => (
                <div key={i} className={`flex justify-between px-3 py-2 text-xs border-b border-gray-50 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-900">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FLAGS TAB ────────────────────────────────────────────── */}
        {activeTab === 'flags' && (
          <FlagsTab inputs={inputs} d={d} propertyYearBuilt={propertyYearBuilt}
            onUpdateInputs={updates => setInputs(prev => ({ ...prev, ...updates }))} />
        )}

        {/* ── COMPARE TAB ───────────────────────────────────────────────── */}
        {activeTab === 'compare' && (
          <CompareTab
            compareA={compareA} setCompareA={setCompareA}
            compareB={compareB} setCompareB={setCompareB}
            compareCols={compareCols} setCompareCols={setCompareCols}
            scenarioOptions={scenarioOptions}
            resolveInputs={resolveInputs}
            deltaRows={deltaRows}
            onSaveCompare={propertyId ? async () => {
              setCompareSaving(true)
              await saveCompareState(propertyId, {
                a: compareA, b: compareB,
                c: compareCols[0] ?? null, d: compareCols[1] ?? null,
              })
              setCompareSaving(false)
            } : undefined}
            compareSaving={compareSaving}
          />
        )}

      </div>
      {showLOI && loiData && (
        <LOIModal initial={loiData} onClose={() => setShowLOI(false)} />
      )}
    </div>
  )
}
