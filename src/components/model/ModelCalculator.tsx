import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Download, Save, RotateCcw, FileText, X, Eye, Trash2, ChevronDown } from 'lucide-react'
import { calculate, calc1031, pmtCalcExport, OM_DEFAULTS, fmtDollar, fmtNeg, fmtPct, fmtX, fmtDelta, fmtDeltaPct } from '../../lib/calc'
import type { ModelInputs, Method, Scenario, RentRollUnit } from '../../types'
import {
  InputField, SectionHeader, MetricCard, PLRow, Alert, Toggle, DCRBar, Badge
} from '../ui'
import { generatePDF, ReportDocument, fetchImageAsBase64 } from '../pdf/PdfReport'
import type { ScenarioCol, ReportProps, ExportTab } from '../pdf/PdfReport'
import { PDFViewer, BlobProvider, pdf } from '@react-pdf/renderer'
import { loadCompareState, saveCompareState } from '../../lib/uiState'
import { LOIModal } from '../loi/LOIModal'
import { TaxRecordImport } from '../TaxRecordImport'
import type { LOIData } from '../../types/loi'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, BarElement, Legend } from 'chart.js'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, BarElement, Legend)

// ── Tax Benefit Bank — table + chart ─────────────────────────────────────
const LC = { bonus: '#0072B2', sl: '#E69F00', none: '#CC79A7', exhaust: '#D85A30' }
const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtCell(v: number): string {
  if (Math.abs(v) < 0.5) return '—'
  return v < 0 ? `($${Math.abs(v).toLocaleString('en-US',{maximumFractionDigits:0})})` : `$${v.toLocaleString('en-US',{maximumFractionDigits:0})}`
}
function ColTip({ text }: { text: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [show, setShow] = React.useState(false)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)
  const handleEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ top: r.top, left: r.left + r.width / 2 })
    }
    setShow(true)
  }
  return (
    <span
      ref={ref}
      className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-gray-300 text-[7px] text-gray-600 cursor-help font-semibold leading-none ml-0.5"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      i
      {show && pos && ReactDOM.createPortal(
        <span
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)', marginTop: -4 }}
          className="w-48 px-2 py-1.5 text-[9px] leading-snug text-white bg-gray-800 rounded-lg shadow-lg z-[9999] pointer-events-none normal-case tracking-normal font-normal"
        >
          {text}
        </span>,
        document.body,
      )}
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

  // Sub-metering flags
  if (inputs.utilElecSubmetered) {
    if ((inputs.utilElec ?? 0) > 500) {
      flags.push({ severity: 'amber', title: 'Electric flagged as sub-metered but cost seems high',
        detail: `Electric is marked sub-metered (tenants pay direct) but landlord cost is $${(inputs.utilElec ?? 0).toLocaleString()}/yr — verify this is common area only, not full building electric.`,
        omVal: `$${(inputs.utilElec ?? 0).toLocaleString()}/yr`, benchmark: 'Common area electric typically $200-500/yr for small multifamily' })
    } else {
      flags.push({ severity: 'info', title: 'Electric: sub-metered — tenants pay direct',
        detail: `Electric is individually metered. Landlord cost: $${(inputs.utilElec ?? 0).toLocaleString()}/yr (common areas only).`,
        omVal: `$${(inputs.utilElec ?? 0).toLocaleString()}/yr`, benchmark: 'Tenants responsible for unit electric' })
    }
  }
  if (inputs.utilWaterSubmetered) {
    if ((inputs.utilWater ?? 0) > 1000) {
      flags.push({ severity: 'amber', title: 'Water flagged as sub-metered but cost seems high',
        detail: `Water is marked sub-metered (tenants billed separately) but landlord cost is $${(inputs.utilWater ?? 0).toLocaleString()}/yr — verify tenants are actually billed via RUBS or individual meters.`,
        omVal: `$${(inputs.utilWater ?? 0).toLocaleString()}/yr`, benchmark: 'Common area water typically $500-1,000/yr' })
    } else {
      flags.push({ severity: 'info', title: 'Water: sub-metered — tenants billed separately',
        detail: `Water is sub-metered or RUBS billed. Landlord cost: $${(inputs.utilWater ?? 0).toLocaleString()}/yr (common areas only).`,
        omVal: `$${(inputs.utilWater ?? 0).toLocaleString()}/yr`, benchmark: 'Tenants responsible for unit water' })
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
  const navigate = useNavigate()
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
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [pdfPreviewProps, setPdfPreviewProps] = useState<ReportProps | null>(null)
  const [showPdfMenu, setShowPdfMenu] = useState(false)
  const [exportTab, setExportTab] = useState<ExportTab>('full')
  const pdfMenuRef = useRef<HTMLDivElement>(null)

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

  // Close PDF menu on outside click
  useEffect(() => {
    if (!showPdfMenu) return
    const handler = (e: MouseEvent) => {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target as Node)) setShowPdfMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPdfMenu])

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

  // Rent roll helpers
  const makeUnit = (i: number): RentRollUnit => ({
    id: crypto.randomUUID(), label: `Unit ${i + 1}`, type: '', sqft: 0, rent: 0,
  })
  const syncRentRoll = (tu: number) => {
    setInputs(prev => {
      const existing = prev.rentRoll ?? []
      if (existing.length >= tu) return { ...prev, rentRoll: existing.slice(0, tu) }
      const added = Array.from({ length: tu - existing.length }, (_, i) => makeUnit(existing.length + i))
      return { ...prev, rentRoll: [...existing, ...added] }
    })
  }
  const updateRentRollUnit = (id: string, key: keyof RentRollUnit, val: string | number | boolean) =>
    setInputs(prev => ({
      ...prev,
      rentRoll: (prev.rentRoll ?? []).map(u => u.id === id ? { ...u, [key]: val } : u),
    }))
  const removeRentRollUnit = (id: string) =>
    setInputs(prev => ({ ...prev, rentRoll: (prev.rentRoll ?? []).filter(u => u.id !== id) }))
  const addRentRollUnit = () =>
    setInputs(prev => ({
      ...prev,
      rentRoll: [...(prev.rentRoll ?? []), makeUnit((prev.rentRoll ?? []).length)],
    }))

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
      if (section === 'income') { next.rentRoll = []; next.useRentRoll = false }
      return next
    })
  }

  const dcrAlert = d.dcr < 1
    ? { type: 'red' as const, msg: `DCR FAIL: ${fmtX(d.dcr)} — NOI ${fmtDollar(d.NOI)} cannot cover debt service ${fmtDollar(d.ds)}. Needs ${fmtDollar(d.ds * 1.2)} for 1.20×.` }
    : d.dcr < 1.2
    ? { type: 'yellow' as const, msg: `DCR CAUTION: ${fmtX(d.dcr)} — Below 1.20× lender minimum. NOI must reach ${fmtDollar(d.ds * 1.2)}.` }
    : { type: 'green' as const, msg: `DCR OK: ${fmtX(d.dcr)} — Clears 1.20× minimum. Cushion: ${fmtDollar(d.NOI - d.ds)}/yr.` }

  const handleSave = async () => { if (onSave) await onSave(name, method, inputs) }
  const handlePDF = async (tab: ExportTab = 'full') => {
    // Build cols in Compare tab order: A, B, then any extra C/D cols
    const compareOrder = [compareA, compareB, ...compareCols]
    const cols: ScenarioCol[] = compareOrder
      .map(sid => {
        const r = resolveInputs(sid)
        return { label: r.label, inputs: r.inputs, method: r.method as Method }
      })
      .filter((col, i, arr) => arr.findIndex(c => c.label === col.label) === i) // dedupe
    // Pre-fetch image for preview
    let imageData: string | undefined
    if (propertyImageUrl) {
      const b64 = await fetchImageAsBase64(propertyImageUrl)
      if (b64) imageData = b64
    }
    setExportTab(tab)
    setPdfPreviewProps({
      inputs,
      method: effectiveMethod,
      propertyName,
      address: propertyAddress,
      units: propertyUnits ?? inputs.tu,
      yearBuilt: propertyYearBuilt ?? 0,
      scenarioName: name,
      scenarioCols: cols,
      propertyImageUrl: imageData,
      exportTab: tab,
    })
    setShowPdfPreview(true)
  }
  const handlePrintAll = async () => {
    const compareOrder = [compareA, compareB, ...compareCols]
    const cols: ScenarioCol[] = compareOrder
      .map(sid => { const r = resolveInputs(sid); return { label: r.label, inputs: r.inputs, method: r.method as Method } })
      .filter((col, i, arr) => arr.findIndex(c => c.label === col.label) === i)
    let imageData: string | undefined
    if (propertyImageUrl) { const b64 = await fetchImageAsBase64(propertyImageUrl); if (b64) imageData = b64 }
    const safeProp = (propertyName || 'Property').replace(/[^a-zA-Z0-9]/g, '_')
    const tabs: [ExportTab, string][] = [['full', 'Full_Report'], ['pl', 'PL'], ['tax', 'Tax'], ['flags', 'Flags'], ['om', 'OM'], ['inputs', 'Inputs']]
    for (const [tab, suffix] of tabs) {
      const blob = await pdf(
        <ReportDocument inputs={inputs} method={effectiveMethod} propertyName={propertyName}
          address={propertyAddress} units={propertyUnits ?? inputs.tu} yearBuilt={propertyYearBuilt ?? 0}
          scenarioName={name} scenarioCols={cols} propertyImageUrl={imageData} exportTab={tab} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${safeProp}_${suffix}.pdf`; a.click()
      URL.revokeObjectURL(url)
    }
  }
  const handleScenarioSwitch = (sid: string) => {
    const s = siblings.find(x => x.id === sid)
    if (s) navigate(`/scenario/${s.id}`)
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
        <span className="flex-1 text-sm font-semibold text-gray-900 truncate min-w-0">{name}</span>
        {siblings.filter(s => s.id !== currentScenarioId).length > 0 && (
          <select
            value=""
            onChange={e => handleScenarioSwitch(e.target.value)}
            className="text-xs text-gray-400 bg-transparent border border-gray-200 rounded px-1.5 py-1 cursor-pointer focus:outline-none hover:border-gray-300">
            <option value="" disabled>Scenarios</option>
            {siblings.filter(s => s.id !== currentScenarioId).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        {onSave && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-navy text-white
              rounded-lg hover:bg-navy-light disabled:opacity-50 transition-colors">
            <Save size={12} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        <div className="relative" ref={pdfMenuRef}>
          <button onClick={() => setShowPdfMenu(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200
              text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
            <Eye size={12} />
            PDF
            <ChevronDown size={10} />
          </button>
          {showPdfMenu && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 overflow-hidden">
              {([
                ['full', 'Full Report'],
                ['pl', 'P&L'],
                ['tax', 'Tax'],
                ['flags', 'Flags'],
                ['om', 'OM As-Presented'],
                ['inputs', 'Inputs'],
              ] as [ExportTab, string][]).map(([tab, label]) => (
                <button key={tab} onClick={() => { setShowPdfMenu(false); handlePDF(tab) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#1a1a2e] hover:bg-[#c9a84c]/15 hover:text-[#1a1a2e] transition-colors">
                  {label}
                </button>
              ))}
              <div className="border-t border-gray-200 my-1" />
              <button onClick={() => { setShowPdfMenu(false); handlePrintAll() }}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-[#1a1a2e] hover:bg-[#c9a84c]/15 transition-colors">
                Print All
              </button>
            </div>
          )}
        </div>
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
                badge="OM" onChange={e => { const v = +e.target.value; set('tu', v); if (inputs.useRentRoll) syncRentRoll(v) }} />
              {!inputs.useRentRoll && (
                <InputField label="Units occupied" type="number" value={inputs.ou} min={0} max={inputs.tu} step={1}
                  tooltip="Units currently occupied. If less than total units, physical vacancy method is used instead of OM method"
                  badge="OM" onChange={e => set('ou', +e.target.value)} />
              )}
            </div>
            {/* Rent roll toggle */}
            <div className="flex items-center gap-2 mb-2 mt-1">
              <button
                onClick={() => {
                  const next = !inputs.useRentRoll
                  setInputs(prev => ({ ...prev, useRentRoll: next }))
                  if (next && (inputs.rentRoll ?? []).length === 0 && inputs.tu > 0) syncRentRoll(inputs.tu)
                }}
                className={`relative w-8 h-4 rounded-full transition-colors ${inputs.useRentRoll ? 'bg-blue-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${inputs.useRentRoll ? 'translate-x-4' : ''}`} />
              </button>
              <span className="text-[10px] text-gray-500 font-medium">Use rent roll</span>
            </div>
            {!inputs.useRentRoll ? (
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
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <InputField
                    label={method === 'om' ? 'Vacancy % (of GSR)' : 'Turnover buffer %'}
                    type="number" value={inputs.vp} min={0} max={50} step={0.5}
                    tooltip="Economic vacancy allowance"
                    badge="OM" onChange={e => set('vp', +e.target.value)} />
                </div>
                {/* Rent roll table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-gray-100 text-gray-500 font-semibold">
                        <th className="py-1.5 px-1.5 text-left">Unit</th>
                        <th className="py-1.5 px-1 text-left">Type</th>
                        <th className="py-1.5 px-1 text-right w-14">Sq Ft</th>
                        <th className="py-1.5 px-1 text-right w-20">Rent/mo</th>
                        <th className="py-1.5 px-1 text-center w-20">Lease End</th>
                        <th className="py-1.5 px-0.5 text-center w-8">Vac</th>
                        <th className="py-1.5 px-0.5 w-5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inputs.rentRoll ?? []).map((u, i) => (
                        <tr key={u.id} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''} ${u.vacant ? 'opacity-40' : ''}`}>
                          <td className="py-0.5 px-1.5">
                            <input value={u.label} onChange={e => updateRentRollUnit(u.id, 'label', e.target.value)}
                              className="w-full bg-transparent text-[10px] focus:outline-none border-b border-transparent focus:border-blue-400" />
                          </td>
                          <td className="py-0.5 px-1">
                            <input value={u.type} onChange={e => updateRentRollUnit(u.id, 'type', e.target.value)}
                              placeholder="1bd/1ba"
                              className="w-full bg-transparent text-[10px] focus:outline-none border-b border-transparent focus:border-blue-400" />
                          </td>
                          <td className="py-0.5 px-1">
                            <input type="number" value={u.sqft || ''} onChange={e => updateRentRollUnit(u.id, 'sqft', +e.target.value)}
                              className="w-full bg-transparent text-[10px] text-right focus:outline-none border-b border-transparent focus:border-blue-400" />
                          </td>
                          <td className="py-0.5 px-1">
                            <div className="relative">
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">$</span>
                              <input type="number" value={u.rent || ''} step={25}
                                onChange={e => updateRentRollUnit(u.id, 'rent', +e.target.value)}
                                className="w-full bg-transparent text-[10px] text-right pl-2 focus:outline-none border-b border-transparent focus:border-blue-400" />
                            </div>
                          </td>
                          <td className="py-0.5 px-1">
                            <input value={u.leaseEnd ?? ''} placeholder="MM/DD/YYYY"
                              onChange={e => updateRentRollUnit(u.id, 'leaseEnd', e.target.value)}
                              className="w-full bg-transparent text-[10px] text-center focus:outline-none border-b border-transparent focus:border-blue-400" />
                          </td>
                          <td className="py-0.5 px-0.5 text-center">
                            <input type="checkbox" checked={!!u.vacant}
                              onChange={e => updateRentRollUnit(u.id, 'vacant', e.target.checked)}
                              className="w-3 h-3 rounded border-gray-300" />
                          </td>
                          <td className="py-0.5 px-0.5">
                            <button onClick={() => removeRentRollUnit(u.id)} className="text-gray-300 hover:text-red-400">
                              <Trash2 size={10} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-300 bg-gray-50 font-semibold text-gray-700">
                        <td className="py-1.5 px-1.5" colSpan={3}>Total</td>
                        <td className="py-1.5 px-1 text-right">
                          ${(inputs.rentRoll ?? []).filter(u => !u.vacant).reduce((s, u) => s + (u.rent || 0), 0).toLocaleString()}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <button onClick={addRentRollUnit}
                  className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-medium mb-2">
                  <span className="text-base leading-none">+</span> Add unit
                </button>
                {/* Rent roll summary */}
                {(() => {
                  const rr = inputs.rentRoll ?? []
                  const occ = rr.filter(u => !u.vacant)
                  const totalMo = occ.reduce((s, u) => s + (u.rent || 0), 0)
                  return (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-gray-500 bg-gray-50 rounded-lg p-2 mb-1">
                      <span>Occupied units</span><span className="text-right font-medium text-gray-700">{occ.length} of {rr.length}</span>
                      <span>Total monthly</span><span className="text-right font-medium text-gray-700">${totalMo.toLocaleString()}</span>
                      <span>Annual gross</span><span className="text-right font-medium text-gray-700">${(totalMo * 12).toLocaleString()}</span>
                      <span>Blended avg</span><span className="text-right font-medium text-gray-700">${inputs.tu > 0 ? Math.round(totalMo / inputs.tu).toLocaleString() : 0}/unit</span>
                    </div>
                  )
                })()}
              </>
            )}
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
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] text-gray-400">{inputs.utilElecSubmetered ? 'Electric — property only ($)' : 'Electric ($)'}</span>
                        <span onClick={() => set('utilElecSubmetered', !inputs.utilElecSubmetered)}
                          className={`text-[9px] px-1.5 py-0.5 rounded-full cursor-pointer transition-colors
                            ${inputs.utilElecSubmetered ? 'border border-blue-400 bg-blue-50 text-blue-600 font-medium' : 'border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500'}`}>
                          {inputs.utilElecSubmetered ? 'sub-metered' : 'sub-meter?'}
                        </span>
                      </div>
                      <InputField label="" type="number" dollar value={inputs.utilElec ?? 0} step={100}
                        badge={inputs.utilElecSubmetered ? 'sub-metered' : undefined} badgeColor="blue"
                        tooltip={inputs.utilElecSubmetered ? 'Property common area electric only — tenants pay their own' : 'Landlord-paid electric - common areas, exterior lighting'}
                        onChange={e => { const v = +e.target.value; setInputs(prev => ({ ...prev, utilElec: v, util: v + (prev.utilWater ?? 0) + (prev.utilTrash ?? 0) })) }} />
                      {inputs.utilElecSubmetered
                        ? <p className="text-[9px] text-blue-500 mt-0.5 leading-tight">Tenants pay direct. Common area only.</p>
                        : <div className="text-[10px] text-gray-400 mt-0.5 h-3">{(inputs.utilElec ?? 0) > 0 && <>${Math.round((inputs.utilElec ?? 0) / 12).toLocaleString()}/mo</>}</div>
                      }
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] text-gray-400">{inputs.utilWaterSubmetered ? 'Water — property only ($)' : 'Water & Sewer ($)'}</span>
                        <span onClick={() => set('utilWaterSubmetered', !inputs.utilWaterSubmetered)}
                          className={`text-[9px] px-1.5 py-0.5 rounded-full cursor-pointer transition-colors
                            ${inputs.utilWaterSubmetered ? 'border border-blue-400 bg-blue-50 text-blue-600 font-medium' : 'border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500'}`}>
                          {inputs.utilWaterSubmetered ? 'sub-metered' : 'sub-meter?'}
                        </span>
                      </div>
                      <InputField label="" type="number" dollar value={inputs.utilWater ?? 0} step={100}
                        badge={inputs.utilWaterSubmetered ? 'sub-metered' : undefined} badgeColor="blue"
                        tooltip={inputs.utilWaterSubmetered ? 'Property common area water only — tenants billed separately' : 'Water and sewer - typically landlord-paid in multifamily'}
                        onChange={e => { const v = +e.target.value; setInputs(prev => ({ ...prev, utilWater: v, util: (prev.utilElec ?? 0) + v + (prev.utilTrash ?? 0) })) }} />
                      {inputs.utilWaterSubmetered
                        ? <p className="text-[9px] text-blue-500 mt-0.5 leading-tight">Tenants billed separately. Common area only.</p>
                        : <div className="text-[10px] text-gray-400 mt-0.5 h-3">{(inputs.utilWater ?? 0) > 0 && <>${Math.round((inputs.utilWater ?? 0) / 12).toLocaleString()}/mo</>}</div>
                      }
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
            <div className="grid grid-cols-2 gap-2 mb-3">
              <MetricCard label="Loan amount" value={fmtDollar(d.loan)} sub={inputs.applyExcessToDown && inputs.is1031 ? 'reduced by 1031 equity' : `${d.lev.toFixed(0)}% LTV`} />
              <MetricCard label="Annual debt service" value={fmtDollar(d.ds)} sub={`${fmtDollar(d.mp)}/mo`} />
              <MetricCard label="Equity required" value={fmtDollar(d.eq)} sub={inputs.is1031 && inputs.equity1031 >= d.eq ? `covered by 1031 · ${fmtDollar(Math.max(0, inputs.equity1031 - d.eq - d.ccAmt))} excess` : 'down + lender fee'} valueColor={inputs.is1031 && inputs.equity1031 >= d.eq ? 'text-green-700' : undefined} />
              <MetricCard label="Cash to close" value={fmtDollar(Math.max(0, d.eq + d.ccAmt - (inputs.equity1031 ?? 0)))} sub={inputs.is1031 && inputs.equity1031 > 0 ? `after $${Math.round(inputs.equity1031).toLocaleString()} 1031 equity` : inputs.cc > 0 ? `incl. ${inputs.cc}% closing costs` : "closing costs not set"} valueColor={inputs.equity1031 > d.eq + d.ccAmt ? "text-amber-600" : undefined} />
            </div>
            {inputs.is1031 && inputs.equity1031 > 0 && (() => {
              const equity1031 = inputs.equity1031 ?? 0
              // Compute standard (non-reduced) down to determine excess regardless of toggle state
              const stdDown = inputs.price * (1 - inputs.lev / 100)
              const stdLfee = (inputs.price * inputs.lev / 100) * inputs.lf / 100
              const stdEq = stdDown + stdLfee
              const cashToClose = Math.max(0, d.eq + d.ccAmt - equity1031)
              const excessBeforeApply = Math.max(0, equity1031 - stdEq - d.ccAmt)
              return (
                <div className="mb-3 border border-amber-200 rounded-lg overflow-hidden">
                  <div className="bg-amber-50 px-3 py-2 flex justify-between items-center">
                    <span className="text-xs font-semibold text-amber-800">1031 Exchange — Cash Flow</span>
                    <span className="text-xs font-semibold text-amber-700">{fmtDollar(equity1031)}</span>
                  </div>
                  <div className="px-3 py-2 space-y-1 text-[11px]">
                    <div className="flex justify-between text-gray-600">
                      <span>Purchase price</span><span className="font-medium">{fmtDollar(inputs.price)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Loan ({inputs.applyExcessToDown ? 'after 1031' : `${d.lev.toFixed(0)}% LTV`})</span>
                      <span className="font-medium">({fmtDollar(d.loan)})</span>
                    </div>
                    <div className="flex justify-between text-gray-900 font-semibold border-t border-gray-200 pt-1">
                      <span>Down payment</span><span>{fmtDollar(d.down)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>+ Lender fee ({inputs.lf}%)</span><span>{fmtDollar(d.lfee)}</span>
                    </div>
                    {d.ccAmt > 0 && <div className="flex justify-between text-gray-600">
                      <span>+ Closing costs ({inputs.cc}%)</span><span>{fmtDollar(d.ccAmt)}</span>
                    </div>}
                    <div className="flex justify-between text-gray-900 font-semibold border-t border-gray-200 pt-1">
                      <span>Total needed</span><span>{fmtDollar(d.eq + d.ccAmt)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700">
                      <span>− 1031 equity</span><span>({fmtDollar(equity1031)})</span>
                    </div>
                    <div className="flex justify-between text-gray-900 font-bold border-t border-gray-200 pt-1">
                      <span>Cash to close</span>
                      <span className={cashToClose === 0 ? 'text-green-700' : ''}>{fmtDollar(cashToClose)}</span>
                    </div>
                    {(excessBeforeApply > 0 || inputs.applyExcessToDown) && (
                      <div className="bg-amber-50 border-t border-amber-200 rounded-b -mx-3 -mb-2 mt-2 px-3 py-2">
                        <div className="flex justify-between items-center text-[11px] text-amber-700 font-semibold">
                          <span>{inputs.applyExcessToDown ? 'Excess applied to reduce loan' : 'Excess 1031 capital'}</span>
                          <span>{fmtDollar(excessBeforeApply)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[9px] text-amber-600">{inputs.applyExcessToDown ? 'Loan reduced — lower debt service & better DCR' : 'Apply to reduce loan?'}</p>
                          <button
                            onClick={() => set('applyExcessToDown', !inputs.applyExcessToDown)}
                            className="flex items-center ml-2 flex-shrink-0">
                            <div className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5
                              ${inputs.applyExcessToDown ? 'bg-amber-400' : 'bg-gray-300'}`}>
                              <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform
                                ${inputs.applyExcessToDown ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
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
            {/* ── Tax Strategy Inputs ── */}
            <SectionHeader title="Tax Strategy" />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="space-y-2">
                <InputField label="Tax bracket (%)" type="number" value={inputs.brk} step={1}
                  tooltip="Your marginal federal income tax rate. Used to calculate the value of depreciation deductions and paper losses against your ordinary income."
                  badgeColor="amber" badge="yours" onChange={e => set('brk', +e.target.value)} />
                <InputField label="Land % (non-depreciable)" type="number" value={inputs.land} step={1}
                  tooltip="Estimated percentage of purchase price allocated to land, which is not depreciable. Typically 15-30% for urban multifamily. Higher land % = smaller depreciable basis."
                  badgeColor="amber" badge="estimated" onChange={e => set('land', +e.target.value)} />
                <InputField label="Cost seg % (5/7/15yr)" type="number" value={inputs.costSeg} step={1}
                  tooltip="Percentage of the depreciable building value that qualifies for accelerated 5/7/15-year depreciation via cost segregation study. These assets receive 100% bonus depreciation in Year 1."
                  badgeColor="amber" badge="estimated" onChange={e => set('costSeg', +e.target.value)} />
              </div>
              <div className="space-y-2">
                {/* 1031 toggle */}
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500 flex items-center gap-1">1031 Exchange</label>
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
                  <p className="text-[9px] text-gray-400">Use carryover basis for depreciation</p>
                </div>
                {inputs.is1031 && (
                  <>
                    <InputField label="Carryover basis ($)" type="number" dollar value={inputs.basis1031} step={10000} min={0}
                      tooltip="Your adjusted tax basis in the relinquished property being carried over. This replaces the normal depreciation basis on the new property — lower carryover basis = smaller depreciation deductions going forward."
                      badgeColor="amber" badge="verify w/ CPA" onChange={e => set('basis1031', Math.max(0, +e.target.value))} />
                    {(inputs.priorSalePrice ?? 0) > 0 ? (
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <label className="text-xs text-gray-500 mb-1 block">1031 equity applied</label>
                        <div className="text-sm font-medium text-gray-900">${Math.round(inputs.equity1031).toLocaleString()}</div>
                        <p className="text-[9px] text-gray-400 mt-0.5">Auto-calculated from 1031 analysis below</p>
                      </div>
                    ) : (
                      <InputField label="1031 equity applied ($)" type="number" dollar value={inputs.equity1031} step={10000}
                        tooltip="Net proceeds from your prior sale rolling into this deal. Reduces your required cash to close. Auto-calculated from the 1031 analysis below when prior sale price is entered."
                        badgeColor="amber" badge="from relinquished sale" onChange={e => set('equity1031', +e.target.value)} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Section A: 1031 Exchange Analysis ── */}
            {inputs.is1031 && (() => {
              const ex = calc1031(inputs)
              const priorSale = inputs.priorSalePrice ?? 0
              const cgRateVal = inputs.cgRate ?? 20
              const reclaimRateVal = inputs.reclaimRate ?? 25
              // For chart: after-tax proceeds if they sold without 1031
              const afterTaxProceeds = ex ? ex.netProceeds - ex.totalTaxDeferred : 0
              return (
                <>
                  <SectionHeader title="1031 Exchange Analysis" tooltip="A 1031 exchange lets you sell a property and defer all capital gains taxes by rolling the proceeds into a new like-kind property. The deferred tax stays invested — effectively an interest-free loan from the IRS that compounds over your hold period." />
                  {/* Input fields */}
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <InputField label="Prior sale price" type="number" dollar value={priorSale}
                      tooltip="The gross sale price of the property you are selling (the relinquished property) to fund this 1031 exchange. This is the contract price before any deductions for commissions or closing costs."
                      onChange={e => {
                        const v = +e.target.value
                        setInputs(prev => {
                          const next = { ...prev, priorSalePrice: v }
                          // Auto-set equity1031 from net proceeds
                          const ex2 = calc1031(next)
                          if (ex2 && ex2.netProceeds > 0) next.equity1031 = Math.round(ex2.netProceeds)
                          return next
                        })
                      }} />
                    <InputField label="Selling costs %" type="number" value={inputs.priorSellingCostsPct ?? 5} step={0.5}
                      tooltip="Total transaction costs on the sale — typically broker commission (3-6%) plus closing costs (1-2%). Applied to the prior sale price to determine net proceeds. Default 5%."
                      onChange={e => set('priorSellingCostsPct' as keyof ModelInputs, +e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <InputField label="Mortgage payoff" type="number" dollar value={inputs.priorMortgagePayoff ?? 0}
                      tooltip="The outstanding loan balance you must pay off at closing on the relinquished property. Net 1031 proceeds = sale price minus selling costs minus this payoff amount."
                      onChange={e => {
                        const v = +e.target.value
                        setInputs(prev => {
                          const next = { ...prev, priorMortgagePayoff: v }
                          const ex2 = calc1031(next)
                          if (ex2 && ex2.netProceeds > 0) next.equity1031 = Math.round(ex2.netProceeds)
                          return next
                        })
                      }} />
                    <InputField label="Cap gains rate %" type="number" value={cgRateVal} step={1}
                      tooltip="Your federal long-term capital gains tax rate. Applies to gains on property held more than one year. Most investors pay 15% or 20% depending on income. The 1031 exchange defers this tax entirely."
                      onChange={e => set('cgRate' as keyof ModelInputs, +e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <InputField label="Original purchase price" type="number" dollar value={inputs.priorPurchasePrice ?? 0}
                      tooltip="What you originally paid for the relinquished property. Combined with capital improvements and reduced by depreciation taken, this determines your adjusted basis and the size of your capital gain."
                      onChange={e => set('priorPurchasePrice' as keyof ModelInputs, +e.target.value)} />
                    <InputField label="Capital improvements" type="number" dollar value={inputs.priorImprovements ?? 0}
                      tooltip="Money spent on permanent improvements to the relinquished property during your ownership (renovations, additions, major repairs). These add to your basis and reduce your taxable gain."
                      onChange={e => set('priorImprovements' as keyof ModelInputs, +e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <InputField label="Depreciation taken" type="number" dollar value={inputs.priorDepreciation ?? 0}
                      tooltip="Total cumulative depreciation deductions claimed on the relinquished property across all years of ownership. This reduces your adjusted basis and is subject to 25% depreciation recapture tax upon sale — separate from capital gains tax."
                      onChange={e => set('priorDepreciation' as keyof ModelInputs, +e.target.value)} />
                    <InputField label="Recapture rate %" type="number" value={reclaimRateVal} step={1}
                      tooltip="The IRS taxes depreciation recapture (the depreciation you previously deducted) at a maximum rate of 25% — separate from and in addition to capital gains tax. Default 25%."
                      onChange={e => set('reclaimRate' as keyof ModelInputs, +e.target.value)} />
                  </div>

                  {/* Calculated results */}
                  {ex && priorSale > 0 && (
                    <>
                      <div className="border border-gray-100 rounded-lg p-3 mb-3">
                        <PLRow label="Adjusted basis" value={fmtDollar(ex.adjustedBasis)} />
                        <PLRow label="Capital gain" value={fmtDollar(ex.capitalGain)} variant="total" />
                        <PLRow label={`Tax deferred — cap gains @ ${cgRateVal}%`} value={fmtDollar(ex.capGainsTax)} variant="pos" indent />
                        <PLRow label={`Tax deferred — recapture @ ${reclaimRateVal}%`} value={fmtDollar(ex.recaptureTax)} variant="pos" indent />
                        <div className="mt-1 pt-1 border-t border-green-200 bg-green-50 rounded px-2 py-1">
                          <PLRow label="Total tax deferred" value={fmtDollar(ex.totalTaxDeferred)} variant="pos" />
                        </div>
                      </div>

                      {/* 1031 Proceeds */}
                      <div className="border border-gray-100 rounded-lg p-3 mb-3">
                        <PLRow label="Net proceeds available" value={fmtDollar(ex.netProceeds)} variant="noi" />
                        <PLRow label={`Required down payment (${inputs.lev}% LTV)`} value={fmtDollar(ex.requiredDown)} indent />
                        <PLRow label="Excess capital" value={ex.excessCapital > 0 ? fmtDollar(ex.excessCapital) : '$0'}
                          variant={ex.excessCapital > 0 ? 'pos' : 'normal'} />
                      </div>

                      {/* Apply excess to down payment checkbox */}
                      {ex.excessCapital > 0 && (() => {
                        const checked = !!inputs.applyExcessToDown
                        const newLoan = Math.max(0, inputs.price - ex.netProceeds)
                        const newMp = pmtCalcExport(newLoan, inputs.ir, inputs.am)
                        const newDs = newMp * 12
                        const newDcr = newDs > 0 ? d.NOI / newDs : 0
                        return (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 mb-3">
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input type="checkbox" checked={checked}
                                onChange={e => set('applyExcessToDown' as keyof ModelInputs, e.target.checked as any)}
                                className="mt-0.5 w-3.5 h-3.5 rounded border-blue-300" />
                              <div>
                                <p className="text-[11px] font-semibold text-blue-800">
                                  Apply excess {fmtDollar(ex.excessCapital)} to additional down payment
                                </p>
                                <p className="text-[10px] text-blue-600 mt-0.5">
                                  Reduces loan to {fmtDollar(newLoan)} · Payment {fmtDollar(newMp)}/mo · DCR {fmtX(newDcr)}
                                </p>
                              </div>
                            </label>
                          </div>
                        )
                      })()}

                      {/* Bar chart */}
                      <div className="mb-4" style={{ height: 220 }}>
                        <Bar
                          data={{
                            labels: ['Sell & pay tax', '1031 Exchange'],
                            datasets: [{
                              label: 'Net proceeds',
                              data: [Math.max(0, afterTaxProceeds), ex.netProceeds],
                              backgroundColor: ['#E24B4A', '#1D9E75'],
                              borderRadius: 4,
                            }],
                          }}
                          options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtDollar(ctx.raw as number) } } },
                            scales: { y: { beginAtZero: true, ticks: { callback: v => `$${(+v / 1000).toFixed(0)}k` } } },
                          }}
                        />
                      </div>
                    </>
                  )}
                </>
              )
            })()}

            {/* ── Section B: Bonus Depreciation ── */}
            {inputs.price > 0 && d.brk > 0 && (() => {
              const bracket = d.brk / 100
              const depBasis = inputs.price * (1 - inputs.land / 100)
              const bonusDed = depBasis * (inputs.costSeg / 100)
              const slAnnual = (depBasis * (1 - inputs.costSeg / 100)) / 27.5
              const y1PaperLoss = d.NOI - bonusDed - slAnnual
              const y1TaxBenefit = Math.max(0, -y1PaperLoss) * bracket
              const years = Array.from({ length: 10 }, (_, i) => i + 1)
              const noiArr = years.map(() => d.NOI)
              const taxableArr = years.map(y => y === 1 ? d.NOI - bonusDed - slAnnual : d.NOI - slAnnual)
              return (
                <>
                  <SectionHeader title="Bonus Depreciation" tooltip="Cost segregation identifies building components (fixtures, land improvements, personal property) that qualify for 5, 7, or 15-year depreciation instead of 27.5 years. Under current bonus depreciation rules, these assets can be fully expensed in Year 1, creating a large paper loss that offsets your other ordinary income at your bracket rate. Cash flow is unchanged — only your tax bill moves." />
                  <div className="border border-gray-100 rounded-lg p-3 mb-3">
                    <PLRow label="Year 1 bonus deduction" value={fmtDollar(bonusDed)} variant="pos" />
                    <PLRow label="Year 1 paper loss" value={y1PaperLoss < 0 ? `(${fmtDollar(Math.abs(y1PaperLoss))})` : fmtDollar(y1PaperLoss)} variant={y1PaperLoss < 0 ? 'pos' : 'neg'} indent />
                    <PLRow label={`Year 1 tax benefit @ ${d.brk}%`} value={fmtDollar(y1TaxBenefit)} variant="total" />
                  </div>
                  <div className="mb-4" style={{ height: 240 }}>
                    <Bar
                      data={{
                        labels: years.map(y => `Y${y}`),
                        datasets: [
                          { label: 'NOI', data: noiArr, backgroundColor: '#3B82F6', borderRadius: 3 },
                          { label: 'Taxable income', data: taxableArr.map(v => v), backgroundColor: taxableArr.map(v => v < 0 ? '#E24B4A' : '#1D9E75'), borderRadius: 3 },
                        ],
                      }}
                      options={{
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                          legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtDollar(ctx.raw as number)}` } },
                        },
                        scales: { y: { ticks: { callback: v => `$${(+v / 1000).toFixed(0)}k` } } },
                      }}
                    />
                  </div>
                </>
              )
            })()}

            {/* ── Section C: 27.5-Year Depreciation Schedule ── */}
            {inputs.price > 0 && d.brk > 0 && (() => {
              const depBasis = inputs.price * (1 - inputs.land / 100) * (1 - inputs.costSeg / 100)
              const annualDed = depBasis / 27.5
              const bracket = d.brk / 100
              const annualShield = annualDed * bracket
              const years28 = Array.from({ length: 28 }, (_, i) => i + 1)
              const shieldArr = years28.map((_, i) => i < 27 ? annualShield : annualShield * 0.5)
              const cumulArr = years28.map((_, i) => shieldArr.slice(0, i + 1).reduce((a, b) => a + b, 0))
              return (
                <>
                  <SectionHeader title="27.5-Year Depreciation Schedule" tooltip="Residential rental property is depreciated straight-line (SL) over 27.5 years — meaning an equal deduction every year for 27.5 years. Each year you deduct an equal share of the depreciable basis (purchase price minus land value, minus any cost-segregated assets), creating a consistent annual tax shield. The shield ends when the basis is fully depreciated." />
                  <div className="border border-gray-100 rounded-lg p-3 mb-3">
                    <PLRow label="Depreciable basis (after cost seg)" value={fmtDollar(depBasis)} />
                    <PLRow label="Annual deduction" value={fmtDollar(annualDed)} variant="pos" indent />
                    <PLRow label={`Annual tax shield @ ${d.brk}%`} value={fmtDollar(annualShield)} variant="total" />
                  </div>
                  <div className="mb-4" style={{ height: 200 }}>
                    <Bar
                      data={{
                        labels: years28.map(y => y % 5 === 0 || y === 1 || y === 28 ? `Y${y}` : ''),
                        datasets: [
                          { label: 'Annual shield', data: shieldArr, backgroundColor: '#14B8A6', borderRadius: 2, yAxisID: 'y' },
                          { label: 'Cumulative saved', data: cumulArr, type: 'line' as const, borderColor: '#3B82F6', borderWidth: 2, pointRadius: 0, yAxisID: 'y1' } as any,
                        ],
                      }}
                      options={{
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                          legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
                          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtDollar(ctx.raw as number)}` } },
                        },
                        scales: {
                          y: { position: 'left', ticks: { callback: v => `$${(+v / 1000).toFixed(0)}k` }, title: { display: true, text: 'Annual', font: { size: 9 } } },
                          y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => `$${(+v / 1000).toFixed(0)}k` }, title: { display: true, text: 'Cumulative', font: { size: 9 } } },
                        },
                      }}
                    />
                  </div>
                </>
              )
            })()}

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
      {showPdfPreview && pdfPreviewProps && ReactDOM.createPortal((() => {
        const safeProp = (pdfPreviewProps.propertyName || 'Property').replace(/[^a-zA-Z0-9]/g, '_')
        const tabSuffix: Record<ExportTab, string> = { full: 'Full_Report', pl: 'PL', tax: 'Tax', flags: 'Flags', om: 'OM', inputs: 'Inputs' }
        const fileName = `${safeProp}_${tabSuffix[exportTab]}.pdf`
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: 9999 }}>
            <div className="bg-white w-full max-w-4xl mx-4 rounded-xl shadow-2xl flex flex-col" style={{ height: '90vh' }}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-800">Report Preview{exportTab !== 'full' && <span className="ml-2 text-xs font-normal text-[#c9a84c]">— {({ pl: 'P&L', tax: 'Tax', flags: 'Flags', om: 'OM As-Presented', inputs: 'Inputs', full: '' } as Record<ExportTab, string>)[exportTab]}</span>}</h2>
                <div className="flex items-center gap-3">
                  <BlobProvider document={<ReportDocument {...pdfPreviewProps} />}>
                    {({ url, loading: pdfLoading }) => (
                      <a
                        href={url ?? '#'}
                        download={fileName}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors ${pdfLoading ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <Download size={12} />
                        {pdfLoading ? 'Preparing...' : 'Download PDF'}
                      </a>
                    )}
                  </BlobProvider>
                  <button onClick={() => setShowPdfPreview(false)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <PDFViewer width="100%" height="100%" style={{ border: 'none' }}>
                  <ReportDocument {...pdfPreviewProps} />
                </PDFViewer>
              </div>
            </div>
          </div>
        )
      })(), document.body)}
    </div>
  )
}
