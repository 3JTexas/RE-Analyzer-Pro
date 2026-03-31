import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { ModelInputs } from '../types'

// ── Style constants ──────────────────────────────────────────────────────
const GOLD = 'FFC9A84C'
const DARK = 'FF1A1A2E'
const WHITE = 'FFFFFFFF'
const LIGHT_GRAY = 'FFF9FAFB'
const GREEN = 'FF16A34A'
const RED = 'FFDC2626'

function headerFill(): ExcelJS.FillPattern {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
}
function goldFont(bold = true): Partial<ExcelJS.Font> {
  return { bold, color: { argb: GOLD }, size: 11 }
}
function whiteFont(bold = true): Partial<ExcelJS.Font> {
  return { bold, color: { argb: WHITE }, size: 11 }
}
function dollarFmt(): string { return '#,##0' }
function dollarFmtNeg(): string { return '$#,##0;($#,##0)' }
function pctFmt(): string { return '0.00"%"' }
function pctInputFmt(): string { return '0.0#' }

function styleInputCell(cell: ExcelJS.Cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE8' } }
  cell.border = {
    bottom: { style: 'thin', color: { argb: GOLD } },
  }
  cell.font = { bold: true, size: 11, color: { argb: DARK } }
}

function sectionRow(ws: ExcelJS.Worksheet, row: number, label: string) {
  const r = ws.getRow(row)
  r.getCell(1).value = label
  r.getCell(1).font = { bold: true, size: 12, color: { argb: DARK } }
  r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E0D0' } }
  r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E0D0' } }
  r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E0D0' } }
}

function labelRow(ws: ExcelJS.Worksheet, row: number, label: string, formula: string, fmt?: string, indent = false) {
  const r = ws.getRow(row)
  r.getCell(1).value = indent ? `   ${label}` : label
  r.getCell(1).font = { size: 11, color: { argb: indent ? 'FF6B7280' : DARK } }
  r.getCell(2).value = { formula }
  r.getCell(2).numFmt = fmt ?? dollarFmtNeg()
  r.getCell(2).font = { size: 11, color: { argb: DARK } }
}

function totalRow(ws: ExcelJS.Worksheet, row: number, label: string, formula: string, fmt?: string, color?: string) {
  const r = ws.getRow(row)
  r.getCell(1).value = label
  r.getCell(1).font = { bold: true, size: 11, color: { argb: color ?? DARK } }
  r.getCell(2).value = { formula }
  r.getCell(2).numFmt = fmt ?? dollarFmtNeg()
  r.getCell(2).font = { bold: true, size: 11, color: { argb: color ?? DARK } }
  r.getCell(1).border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } } }
  r.getCell(2).border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } } }
}

// ── Main export function ─────────────────────────────────────────────────
export async function exportToExcel(inputs: ModelInputs, scenarioName: string, propertyName?: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'RE Analyzer Pro'
  wb.created = new Date()

  // ════════════════════════════════════════════════════════════════════════
  // INPUTS SHEET — all editable inputs live here, referenced by other sheets
  // ════════════════════════════════════════════════════════════════════════
  const inp = wb.addWorksheet('Inputs', { properties: { tabColor: { argb: GOLD } } })
  inp.getColumn(1).width = 30
  inp.getColumn(2).width = 18
  inp.getColumn(3).width = 30

  // Header
  const hdr = inp.getRow(1)
  hdr.getCell(1).value = 'RE Analyzer Pro — Model Inputs'
  hdr.getCell(1).font = whiteFont()
  hdr.getCell(1).fill = headerFill()
  hdr.getCell(2).fill = headerFill()
  hdr.getCell(3).fill = headerFill()

  if (propertyName) {
    inp.getRow(2).getCell(1).value = propertyName
    inp.getRow(2).getCell(1).font = goldFont()
  }

  let r = 4

  // Helper to add an input row and return its cell address
  const inputMap: Record<string, string> = {}
  function addInput(key: string, label: string, value: number | string, fmt?: string) {
    inp.getRow(r).getCell(1).value = label
    inp.getRow(r).getCell(1).font = { size: 11, color: { argb: '6B7280' } }
    const cell = inp.getRow(r).getCell(2)
    cell.value = typeof value === 'string' ? value : value
    if (fmt) cell.numFmt = fmt
    styleInputCell(cell)
    inputMap[key] = `Inputs!$B$${r}`
    r++
    return `Inputs!$B$${r - 1}`
  }

  // ── Income
  sectionRow(inp, r, 'Income'); r++
  addInput('tu', 'Total units', inputs.tu, '#,##0')
  addInput('ou', 'Occupied units', inputs.useRentRoll ? (inputs.rentRoll?.filter(u => !u.vacant).length ?? inputs.ou) : inputs.ou, '#,##0')
  addInput('rent', 'Avg rent / unit / month', inputs.useRentRoll ? (inputs.tu > 0 ? (inputs.rentRoll?.filter(u => !u.vacant).reduce((s, u) => s + (u.rent || 0), 0) ?? 0) / inputs.tu : 0) : inputs.rent, '$#,##0')
  addInput('vp', 'Vacancy %', inputs.vp, pctInputFmt())

  // Other income items
  const otherInc = inputs.otherIncome ?? []
  for (let i = 0; i < otherInc.length; i++) {
    addInput(`oi_${i}`, `Other income: ${otherInc[i].label || `Item ${i + 1}`}`, otherInc[i].amount, '$#,##0')
  }

  r++ // blank row

  // ── Financing
  sectionRow(inp, r, 'Financing'); r++
  addInput('price', 'Purchase price', inputs.price, '$#,##0')
  addInput('ir', 'Interest rate %', inputs.ir, '0.00')
  addInput('lev', 'LTV %', inputs.lev, '0.0')
  addInput('am', 'Amortization (years)', inputs.am, '#,##0')
  addInput('lf', 'Lender fee %', inputs.lf, '0.0')
  addInput('cc', 'Closing costs %', inputs.cc, '0.0')

  r++

  // ── Expenses
  sectionRow(inp, r, 'Expenses'); r++
  addInput('tax', 'Real estate taxes (annual)', inputs.tax, '$#,##0')
  addInput('ins', 'Insurance ($/unit/yr)', inputs.ins, '$#,##0')
  addInput('util', 'Utilities (annual)', inputs.util, '$#,##0')
  addInput('rm', 'Repairs & maintenance ($/unit/yr)', inputs.rm, '$#,##0')
  addInput('cs', 'Contract services (annual)', inputs.cs, '$#,##0')
  addInput('ga', 'G&A (annual)', inputs.ga, '$#,##0')
  addInput('res', 'Reserves ($/unit/yr)', inputs.res, '$#,##0')
  if (inputs.pmMode === 'unit') {
    addInput('pmPerUnit', 'Prop. mgmt ($/unit/mo)', inputs.pmPerUnit, '$#,##0')
  } else {
    addInput('pm', 'Prop. mgmt (% of EGI)', inputs.pm, pctInputFmt())
  }

  // Other expense items
  const otherExp = inputs.otherExpenses ?? []
  for (let i = 0; i < otherExp.length; i++) {
    addInput(`oe_${i}`, `Other expense: ${otherExp[i].label || `Item ${i + 1}`}`, otherExp[i].amount, '$#,##0')
  }

  r++

  // ── Tax
  sectionRow(inp, r, 'Tax / Depreciation'); r++
  addInput('brk', 'Tax bracket %', inputs.brk, '0.0')
  addInput('land', 'Land % (non-depreciable)', inputs.land, '0.0')
  addInput('costSeg', 'Cost seg % (5/7/15yr)', inputs.costSeg, '0.0')

  if (inputs.is1031) {
    r++
    sectionRow(inp, r, '1031 Exchange'); r++
    addInput('basis1031', 'Carryover basis', inputs.basis1031, '$#,##0')
    addInput('equity1031', '1031 equity applied', inputs.equity1031, '$#,##0')
  }

  // ════════════════════════════════════════════════════════════════════════
  // P&L SHEET
  // ════════════════════════════════════════════════════════════════════════
  const pl = wb.addWorksheet('P&L', { properties: { tabColor: { argb: '16A34A' } } })
  pl.getColumn(1).width = 35
  pl.getColumn(2).width = 18
  pl.getColumn(3).width = 18

  // Header
  const plHdr = pl.getRow(1)
  plHdr.getCell(1).value = 'Profit & Loss'
  plHdr.getCell(1).font = whiteFont()
  for (let c = 1; c <= 3; c++) plHdr.getCell(c).fill = headerFill()
  pl.getRow(2).getCell(1).value = scenarioName
  pl.getRow(2).getCell(1).font = goldFont()

  // Column headers
  pl.getRow(3).getCell(2).value = 'Annual'
  pl.getRow(3).getCell(3).value = 'Monthly'
  pl.getRow(3).getCell(2).font = { bold: true, size: 10, color: { argb: '6B7280' } }
  pl.getRow(3).getCell(3).font = { bold: true, size: 10, color: { argb: '6B7280' } }

  let pr = 5 // P&L row counter

  // Refs to input cells
  const ref = (key: string) => inputMap[key]

  // ── Income
  sectionRow(pl, pr, 'Income'); pr++

  // GSR = rent * tu * 12
  const gsrFormula = `${ref('rent')}*${ref('tu')}*12`
  labelRow(pl, pr, 'Gross scheduled rent (GSR)', gsrFormula); pr++

  // Physical vacancy = GSR * vp / 100
  const pvFormula = `-(${ref('rent')}*${ref('tu')}*12)*(${ref('vp')}/100)`
  labelRow(pl, pr, `Vacancy (${inputs.vp}%)`, pvFormula, dollarFmtNeg(), true); pr++

  // Collected rent = GSR - vacancy
  const colRow = pr
  const colFormula = `B${pr - 2}+B${pr - 1}`
  totalRow(pl, pr, 'Collected rental income', colFormula); pr++

  // Other income items
  for (let i = 0; i < otherInc.length; i++) {
    labelRow(pl, pr, `${otherInc[i].label || `Other income ${i + 1}`}`, ref(`oi_${i}`), dollarFmtNeg(), true); pr++
  }

  // EGI
  const egiRow = pr
  const oiRefs = otherInc.map((_, i) => ref(`oi_${i}`)).join('+')
  const egiFormula = otherInc.length > 0 ? `B${colRow}+${oiRefs}` : `B${colRow}`
  totalRow(pl, pr, 'Effective gross income (EGI)', egiFormula, dollarFmtNeg(), GREEN); pr++

  pr++ // blank

  // ── Expenses
  sectionRow(pl, pr, 'Expenses'); pr++

  const expStartRow = pr

  // Tax
  labelRow(pl, pr, 'Real estate taxes', ref('tax'), dollarFmtNeg(), true); pr++

  // Insurance = ins * tu
  const insFormula = `${ref('ins')}*${ref('tu')}`
  labelRow(pl, pr, 'Insurance', insFormula, dollarFmtNeg(), true); pr++

  // Utilities
  labelRow(pl, pr, 'Utilities', ref('util'), dollarFmtNeg(), true); pr++

  // R&M = rm * tu
  const rmFormula = `${ref('rm')}*${ref('tu')}`
  labelRow(pl, pr, 'Repairs & maintenance', rmFormula, dollarFmtNeg(), true); pr++

  // Contract services
  labelRow(pl, pr, 'Contract services', ref('cs'), dollarFmtNeg(), true); pr++

  // G&A
  labelRow(pl, pr, 'G&A', ref('ga'), dollarFmtNeg(), true); pr++

  // Reserves = res * tu
  const resFormula = `${ref('res')}*${ref('tu')}`
  labelRow(pl, pr, 'Reserves', resFormula, dollarFmtNeg(), true); pr++

  // Property management
  const pmRow = pr
  let pmFormula: string
  let pmLabel: string
  if (inputs.pmMode === 'unit') {
    pmFormula = `${ref('pmPerUnit')}*12*${ref('tu')}`
    pmLabel = 'Prop. mgmt ($/unit/mo)'
  } else {
    pmFormula = `B${egiRow}*${ref('pm')}/100`
    pmLabel = 'Prop. mgmt (% EGI)'
  }
  labelRow(pl, pr, pmLabel, pmFormula, dollarFmtNeg(), true); pr++

  // Other expense items
  for (let i = 0; i < otherExp.length; i++) {
    labelRow(pl, pr, `${otherExp[i].label || `Other expense ${i + 1}`}`, ref(`oe_${i}`), dollarFmtNeg(), true); pr++
  }

  // Total expenses = sum of expense rows
  const expEndRow = pr - 1
  const expFormula = `SUM(B${expStartRow}:B${expEndRow})`
  totalRow(pl, pr, 'Total expenses', expFormula); pr++
  const totalExpRow = pr - 1

  pr++ // blank

  // ── Operations
  sectionRow(pl, pr, 'Operations'); pr++

  // NOI = EGI - expenses
  const noiRow = pr
  const noiFormula = `B${egiRow}-B${totalExpRow}`
  totalRow(pl, pr, 'Net operating income (NOI)', noiFormula, dollarFmtNeg(), GREEN); pr++

  // Debt service = PMT * 12
  const dsRow = pr
  // Loan = price * lev / 100
  // PMT formula in Excel: =PMT(rate/12, am*12, -loan)
  const dsFormula = `IF(${ref('ir')}=0, ${ref('price')}*${ref('lev')}/100/(${ref('am')}*12)*12, PMT(${ref('ir')}/100/12,${ref('am')}*12,-${ref('price')}*${ref('lev')}/100)*12)`
  labelRow(pl, pr, 'Annual debt service', dsFormula, dollarFmtNeg(), true); pr++

  // Pre-tax cash flow = NOI - DS
  const cfRow = pr
  const cfFormula = `B${noiRow}-B${dsRow}`
  totalRow(pl, pr, 'Pre-tax cash flow', cfFormula); pr++

  pr++ // blank

  // ── Key Metrics
  sectionRow(pl, pr, 'Key Metrics'); pr++

  // Cap rate = NOI / price * 100
  const capFormula = `IF(${ref('price')}=0,0,B${noiRow}/${ref('price')}*100)`
  labelRow(pl, pr, 'Cap rate', capFormula, pctFmt()); pr++

  // Cash-on-cash = CF / equity * 100
  // equity = down + lender fee = price*(1-lev/100) + price*lev/100*lf/100
  const eqFormula = `${ref('price')}*(1-${ref('lev')}/100)+${ref('price')}*${ref('lev')}/100*${ref('lf')}/100`
  const cocFormula = `IF((${eqFormula})=0,0,B${cfRow}/(${eqFormula})*100)`
  labelRow(pl, pr, 'Cash-on-cash return', cocFormula, pctFmt()); pr++

  // DCR = NOI / DS
  const dcrFormula = `IF(B${dsRow}=0,0,B${noiRow}/B${dsRow})`
  labelRow(pl, pr, 'Debt coverage ratio (DCR)', dcrFormula, '0.00"x"'); pr++

  // Expense ratio = expenses / EGI
  const expRatioFormula = `IF(B${egiRow}=0,0,B${totalExpRow}/B${egiRow}*100)`
  labelRow(pl, pr, 'Expense ratio', expRatioFormula, pctFmt()); pr++

  // GRM = price / GSR
  const grmFormula = `IF(B5=0,0,${ref('price')}/B5)`
  labelRow(pl, pr, 'Gross rent multiplier (GRM)', grmFormula, '0.00"x"'); pr++

  // ── Add monthly column formulas for key rows
  // Walk back and add monthly = annual / 12 for all value rows
  for (let row = 5; row <= pr; row++) {
    const cell = pl.getRow(row).getCell(2)
    if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) {
      const monthlyCell = pl.getRow(row).getCell(3)
      monthlyCell.value = { formula: `B${row}/12` }
      monthlyCell.numFmt = cell.numFmt || dollarFmtNeg()
      monthlyCell.font = { size: 10, color: { argb: '9CA3AF' } }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // FINANCING SHEET
  // ════════════════════════════════════════════════════════════════════════
  const fin = wb.addWorksheet('Financing', { properties: { tabColor: { argb: '3B82F6' } } })
  fin.getColumn(1).width = 32
  fin.getColumn(2).width = 18

  const finHdr = fin.getRow(1)
  finHdr.getCell(1).value = 'Financing & Cash to Close'
  finHdr.getCell(1).font = whiteFont()
  finHdr.getCell(1).fill = headerFill()
  finHdr.getCell(2).fill = headerFill()

  let fr = 3

  sectionRow(fin, fr, 'Loan'); fr++

  // Loan amount
  const loanFormula = `${ref('price')}*${ref('lev')}/100`
  labelRow(fin, fr, 'Loan amount', loanFormula); fr++
  const loanRow = fr - 1

  // Down payment
  const downFormula = `${ref('price')}-B${loanRow}`
  labelRow(fin, fr, 'Down payment', downFormula); fr++

  // LTV
  const ltvFormula = `IF(${ref('price')}=0,0,B${loanRow}/${ref('price')}*100)`
  labelRow(fin, fr, 'LTV', ltvFormula, pctFmt()); fr++

  // Monthly payment
  const mpFormula = `IF(${ref('ir')}=0,B${loanRow}/(${ref('am')}*12),PMT(${ref('ir')}/100/12,${ref('am')}*12,-B${loanRow}))`
  labelRow(fin, fr, 'Monthly payment', mpFormula, '$#,##0'); fr++
  const mpRow = fr - 1

  // Annual debt service
  labelRow(fin, fr, 'Annual debt service', `B${mpRow}*12`, '$#,##0'); fr++

  fr++
  sectionRow(fin, fr, 'Cash to Close'); fr++

  // Down payment (ref)
  labelRow(fin, fr, 'Down payment', `${ref('price')}-B${loanRow}`); fr++
  const ctcDownRow = fr - 1

  // Lender fee
  const lfeeFormula = `B${loanRow}*${ref('lf')}/100`
  labelRow(fin, fr, 'Lender origination fee', lfeeFormula, dollarFmtNeg(), true); fr++
  const lfeeRow = fr - 1

  // Closing costs
  const ccFormula = `${ref('price')}*${ref('cc')}/100`
  labelRow(fin, fr, 'Closing costs', ccFormula, dollarFmtNeg(), true); fr++
  const ccRow = fr - 1

  // Total equity required (down + lender fee)
  const eqTotalFormula = `B${ctcDownRow}+B${lfeeRow}`
  totalRow(fin, fr, 'Equity required (down + fee)', eqTotalFormula); fr++

  // Total cash to close
  const ctcFormula = `B${ctcDownRow}+B${lfeeRow}+B${ccRow}`
  totalRow(fin, fr, 'Total cash to close', ctcFormula, dollarFmtNeg(), GOLD); fr++

  fr++
  sectionRow(fin, fr, 'Prepayment Penalty (3/2/1)'); fr++
  labelRow(fin, fr, 'Year 1 (3%)', `B${loanRow}*0.03`); fr++
  labelRow(fin, fr, 'Year 2 (2%)', `B${loanRow}*0.02`); fr++
  labelRow(fin, fr, 'Year 3 (1%)', `B${loanRow}*0.01`); fr++

  // ════════════════════════════════════════════════════════════════════════
  // TAX SHEET
  // ════════════════════════════════════════════════════════════════════════
  const tx = wb.addWorksheet('Tax Analysis', { properties: { tabColor: { argb: 'A855F7' } } })
  tx.getColumn(1).width = 35
  tx.getColumn(2).width = 18

  const txHdr = tx.getRow(1)
  txHdr.getCell(1).value = 'Tax Analysis — REP · 100% Bonus Dep'
  txHdr.getCell(1).font = whiteFont()
  txHdr.getCell(1).fill = headerFill()
  txHdr.getCell(2).fill = headerFill()

  let tr = 3

  sectionRow(tx, tr, 'Depreciation'); tr++

  // Depreciable basis
  let deprBaseFormula: string
  if (inputs.is1031 && inputs.basis1031 > 0) {
    deprBaseFormula = ref('basis1031')
  } else {
    deprBaseFormula = `${ref('price')}*(1-${ref('land')}/100)`
  }
  labelRow(tx, tr, 'Depreciable basis', deprBaseFormula); tr++
  const deprBaseRow = tr - 1

  // Bonus depreciation (cost seg components)
  const bdFormula = `B${deprBaseRow}*${ref('costSeg')}/100`
  labelRow(tx, tr, 'Bonus depreciation (cost seg)', bdFormula); tr++
  const bdRow = tr - 1

  // Straight-line 27.5yr
  const slFormula = `(B${deprBaseRow}*(1-${ref('costSeg')}/100))/27.5`
  labelRow(tx, tr, 'Straight-line depreciation (27.5yr)', slFormula); tr++
  const slRow = tr - 1

  tr++
  sectionRow(tx, tr, 'Year 1 Tax Impact'); tr++

  // NOI (reference from P&L)
  labelRow(tx, tr, 'Net operating income', `'P&L'!B${noiRow}`); tr++
  const txNoiRow = tr - 1

  // Year 1 interest
  // We'll use an approximation: interest ≈ loan * rate (close enough for Y1 with amortization)
  // Actually let's use IPMT sum for accuracy
  const intFormula = `IF(${ref('ir')}=0,0,SUMPRODUCT(-IPMT(${ref('ir')}/100/12,ROW(INDIRECT("1:12")),${ref('am')}*12,${ref('price')}*${ref('lev')}/100)))`
  labelRow(tx, tr, 'Year 1 interest', intFormula, dollarFmtNeg(), true); tr++
  const intRow = tr - 1

  // Taxable income before depreciation = NOI - interest
  const tiFormula = `B${txNoiRow}-B${intRow}`
  labelRow(tx, tr, 'Taxable income (before dep.)', tiFormula); tr++
  const tiRow = tr - 1

  // Total depreciation
  const totalDeprFormula = `B${bdRow}+B${slRow}`
  labelRow(tx, tr, 'Total depreciation', totalDeprFormula, dollarFmtNeg(), true); tr++
  const totalDeprRow = tr - 1

  // Paper loss = TI - depreciation
  const lossFormula = `B${tiRow}-B${totalDeprRow}`
  totalRow(tx, tr, 'Paper loss', lossFormula, dollarFmtNeg(), RED); tr++
  const lossRow = tr - 1

  // Tax savings = |loss| * bracket
  const tsFormula = `ABS(B${lossRow})*${ref('brk')}/100`
  totalRow(tx, tr, 'Tax savings (Year 1)', tsFormula, dollarFmtNeg(), GREEN); tr++
  const tsRow = tr - 1

  tr++
  sectionRow(tx, tr, 'After-Tax Returns'); tr++

  // Pre-tax cash flow
  labelRow(tx, tr, 'Pre-tax cash flow', `'P&L'!B${cfRow}`); tr++
  const txCfRow = tr - 1

  // After-tax cash flow = CF + tax savings
  const atFormula = `B${txCfRow}+B${tsRow}`
  totalRow(tx, tr, 'After-tax cash flow', atFormula); tr++
  const atRow = tr - 1

  // Year 1 principal paydown
  const prinFormula = `'P&L'!B${dsRow}-B${intRow}`
  labelRow(tx, tr, 'Year 1 principal paydown', prinFormula, dollarFmtNeg(), true); tr++
  const prinRow = tr - 1

  // Total Y1 economic return = after-tax CF + principal paydown
  const y1Formula = `B${atRow}+B${prinRow}`
  totalRow(tx, tr, 'Total Y1 economic return', y1Formula, dollarFmtNeg(), GOLD); tr++

  tr++

  // Return percentages
  sectionRow(tx, tr, 'Return Metrics'); tr++

  const eqRef = `(${ref('price')}*(1-${ref('lev')}/100)+${ref('price')}*${ref('lev')}/100*${ref('lf')}/100)`
  labelRow(tx, tr, 'Pre-tax CoC', `IF(${eqRef}=0,0,B${txCfRow}/${eqRef}*100)`, pctFmt()); tr++
  labelRow(tx, tr, 'After-tax CoC', `IF(${eqRef}=0,0,B${atRow}/${eqRef}*100)`, pctFmt()); tr++
  labelRow(tx, tr, 'Total Y1 return on equity', `IF(${eqRef}=0,0,(B${atRow}+B${prinRow})/${eqRef}*100)`, pctFmt()); tr++

  // ════════════════════════════════════════════════════════════════════════
  // Final: freeze panes, protect input styling
  // ════════════════════════════════════════════════════════════════════════
  inp.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }]
  pl.views = [{ state: 'frozen', ySplit: 3, xSplit: 0 }]
  fin.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }]
  tx.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }]

  // Alternate row shading on P&L
  for (let row = 5; row <= pr; row++) {
    if (row % 2 === 0) {
      const r = pl.getRow(row)
      if (!r.getCell(1).font?.bold) {
        for (let c = 1; c <= 3; c++) {
          const cell = r.getCell(c)
          if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === undefined) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY } }
          }
        }
      }
    }
  }

  // ── Generate and download ──────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const safeName = (propertyName || scenarioName || 'Model').replace(/[^a-zA-Z0-9_-]/g, '_')
  saveAs(blob, `${safeName}_Model.xlsx`)
}
