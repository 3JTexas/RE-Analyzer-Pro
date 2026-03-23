import { useState, useRef } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { OM_DEFAULTS } from '../lib/calc'
import type { ModelInputs } from '../types'

const FIELDS: { key: keyof ModelInputs; label: string; step: number; prefix?: string; suffix?: string }[] = [
  { key: 'price', label: 'Purchase price',       step: 10000, prefix: '$' },
  { key: 'tu',    label: 'Total units',           step: 1 },
  { key: 'rent',  label: 'Avg rent / unit / mo',  step: 25,   prefix: '$' },
  { key: 'vp',    label: 'Vacancy %',             step: 0.5,  suffix: '%' },
  { key: 'lev',   label: 'LTV %',                 step: 1,    suffix: '%' },
  { key: 'ir',    label: 'Interest rate %',       step: 0.125,suffix: '%' },
  { key: 'am',    label: 'Amortization (yrs)',    step: 5 },
  { key: 'tax',   label: 'Real estate taxes',     step: 500,  prefix: '$' },
  { key: 'ins',   label: 'Insurance $/door/yr',   step: 100,  prefix: '$' },
  { key: 'util',  label: 'Utilities',             step: 500,  prefix: '$' },
  { key: 'rm',    label: 'R&M $/unit/yr',         step: 50,   prefix: '$' },
  { key: 'cs',    label: 'Contract services',     step: 100,  prefix: '$' },
  { key: 'ga',    label: 'G&A',                   step: 100,  prefix: '$' },
  { key: 'res',   label: 'Reserves $/unit/yr',    step: 50,   prefix: '$' },
  { key: 'pm',    label: 'Prop. mgmt %',          step: 0.5,  suffix: '%' },
]

export interface OmConfirmMeta {
  scenarioName: string
  propertyName?: string
  propertyAddress?: string
}

type Mode = 'choose' | 'manual' | 'pdf'
type PdfStatus = 'idle' | 'reading' | 'extracting' | 'done' | 'error'

interface Props {
  onConfirm: (inputs: ModelInputs, meta: OmConfirmMeta) => void
  onCancel: () => void
  showPropertyFields?: boolean  // true when creating a new property
  defaultScenarioName?: string
}

export function OmSetupFlow({ onConfirm, onCancel, showPropertyFields = false, defaultScenarioName = 'OM As-Presented' }: Props) {
  const [mode, setMode] = useState<Mode>('choose')
  const [inputs, setInputs] = useState<ModelInputs>({ ...OM_DEFAULTS })
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle')
  const [pdfError, setPdfError] = useState('')
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [scenarioName, setScenarioName] = useState(defaultScenarioName)
  const [propertyName, setPropertyName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof ModelInputs, val: number) =>
    setInputs(prev => ({ ...prev, [key]: val }))

  const toBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = () => rej(new Error('Read failed'))
      r.readAsDataURL(file)
    })

  const confirm = () => onConfirm(inputs, {
    scenarioName: scenarioName.trim() || defaultScenarioName,
    propertyName: showPropertyFields ? propertyName.trim() : undefined,
    propertyAddress: showPropertyFields ? propertyAddress.trim() : undefined,
  })

  const extractFromPdfs = async () => {
    if (!pdfFiles.length) return
    setPdfStatus('reading')
    setPdfError('')
    try {
      const base64s = await Promise.all(pdfFiles.map(toBase64))
      setPdfStatus('extracting')
      const response = await fetch(
        'https://mrraacrijhzlchskuzru.supabase.co/functions/v1/extract-om',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ pdfs: base64s })
        }
      )
      const parsed = await response.json()
      console.log('EXTRACTION RESULT:', JSON.stringify(parsed, null, 2))
      if (parsed.error) throw new Error(parsed.error)

      const merged: ModelInputs = { ...OM_DEFAULTS }
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== null && v !== undefined) {
          if (typeof v === 'number') {
            (merged as any)[k] = v
          } else if (k === 'otherIncome' && Array.isArray(v)) {
            merged.otherIncome = v as { label: string; amount: number }[]
          }
        }
      }

      // Auto-populate property name/address from extraction
      if (parsed.propertyName && typeof parsed.propertyName === 'string') setPropertyName(parsed.propertyName)
      if (parsed.propertyAddress && typeof parsed.propertyAddress === 'string') setPropertyAddress(parsed.propertyAddress)

      setInputs(merged)
      setPdfStatus('done')
    } catch (e: any) {
      setPdfError(e.message ?? 'Extraction failed')
      setPdfStatus('error')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type === 'application/pdf')
    setPdfFiles(files)
    setPdfStatus('idle')
  }

  // ── Property + scenario name fields (shown in all modes) ─────────────
  const MetaFields = () => (
    <div className="mb-3 space-y-2">
      {showPropertyFields && (
        <>
          <div>
            <label className="block text-[9px] text-gray-500 mb-0.5 font-medium uppercase tracking-wide">Property name</label>
            <input value={propertyName} onChange={e => setPropertyName(e.target.value)}
              placeholder="e.g. Seacrest Apartments"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-navy" />
          </div>
          <div>
            <label className="block text-[9px] text-gray-500 mb-0.5 font-medium uppercase tracking-wide">Address (optional)</label>
            <input value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)}
              placeholder="e.g. 215 S Seacrest Blvd, Boynton Beach FL"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-navy" />
          </div>
        </>
      )}
      <div>
        <label className="block text-[9px] text-gray-500 mb-0.5 font-medium uppercase tracking-wide">Scenario name</label>
        <input value={scenarioName} onChange={e => setScenarioName(e.target.value)}
          placeholder="e.g. OM As-Presented"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-navy" />
      </div>
    </div>
  )

  // ── Choose mode ───────────────────────────────────────────────────────
  if (mode === 'choose') return (
    <div className="mx-4 mt-3 p-4 border border-gray-200 rounded-xl bg-white shadow-sm flex flex-col max-h-[calc(100dvh-8rem)] overflow-hidden">
      <p className="text-xs font-semibold text-gray-700 mb-1">
        {showPropertyFields ? 'Add new property' : 'Add scenario'}
      </p>
      <p className="text-[10px] text-gray-400 mb-3">
        {showPropertyFields ? 'Import the OM or enter figures manually' : 'How do you want to enter the broker\'s figures?'}
      </p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={() => setMode('pdf')}
          className="flex flex-col items-center gap-2 p-3 border-2 border-gray-200 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-colors">
          <Upload size={22} className="text-amber-600" />
          <span className="text-[11px] font-semibold text-gray-700">Import PDF</span>
          <span className="text-[9px] text-gray-400 text-center">AI extracts automatically</span>
        </button>
        <button onClick={() => setMode('manual')}
          className="flex flex-col items-center gap-2 p-3 border-2 border-gray-200 rounded-xl hover:border-navy hover:bg-blue-50 transition-colors">
          <FileText size={22} className="text-navy" />
          <span className="text-[11px] font-semibold text-gray-700">Enter manually</span>
          <span className="text-[9px] text-gray-400 text-center">Type figures from the OM</span>
        </button>
      </div>
      <button onClick={onCancel} className="w-full bg-gray-100 text-gray-600 text-xs font-medium py-2 rounded-lg">
        Cancel
      </button>
    </div>
  )

  // ── PDF mode ──────────────────────────────────────────────────────────
  if (mode === 'pdf') return (
    <div className="mx-4 mt-3 p-4 border border-amber-200 rounded-xl bg-amber-50 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-amber-800">AI PDF extraction</p>
        <button onClick={() => { setMode('choose'); setPdfFiles([]); setPdfStatus('idle') }}>
          <X size={14} className="text-amber-400" />
        </button>
      </div>

      <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={handleFileChange} />
      <button onClick={() => fileRef.current?.click()}
        className="w-full border-2 border-dashed border-amber-300 rounded-lg p-4 text-center hover:border-amber-500 hover:bg-amber-100 transition-colors mb-3">
        <Upload size={20} className="mx-auto mb-1 text-amber-500" />
        <p className="text-xs font-medium text-amber-700">
          {pdfFiles.length ? `${pdfFiles.length} PDF${pdfFiles.length > 1 ? 's' : ''} selected` : 'Click to select OM PDF(s)'}
        </p>
        {pdfFiles.length > 0 && <p className="text-[9px] text-amber-500 mt-1">{pdfFiles.map(f => f.name).join(', ')}</p>}
      </button>

      {pdfFiles.length > 0 && pdfStatus === 'idle' && (
        <button onClick={extractFromPdfs}
          className="w-full bg-amber-600 text-white text-xs font-semibold py-2.5 rounded-lg mb-2 hover:bg-amber-700">
          Extract data with AI
        </button>
      )}
      {(pdfStatus === 'reading' || pdfStatus === 'extracting') && (
        <div className="flex items-center gap-2 py-2 text-xs text-amber-700">
          <Loader2 size={14} className="animate-spin" />
          {pdfStatus === 'reading' ? 'Reading PDF(s)…' : 'AI extracting figures…'}
        </div>
      )}
      {pdfStatus === 'error' && (
        <div className="flex items-center gap-2 py-2 text-xs text-red-600">
          <AlertCircle size={14} />
          {pdfError} — <button onClick={() => setMode('manual')} className="underline">enter manually instead</button>
        </div>
      )}
      {pdfStatus === 'done' && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium mb-3">
            <CheckCircle size={13} /> Extracted — review details then confirm
          </div>
          <MetaFields />
          <button onClick={() => setMode('manual')}
            className="w-full mb-2 border border-amber-300 text-amber-700 text-xs font-medium py-2 rounded-lg hover:bg-amber-100">
            Review / edit all fields
          </button>
          <button onClick={confirm}
            disabled={showPropertyFields && !propertyName.trim()}
            className="w-full bg-navy text-white text-xs font-semibold py-2.5 rounded-lg disabled:opacity-40">
            {showPropertyFields ? 'Create property + OM scenario' : 'Create OM scenario'}
          </button>
        </div>
      )}
      <button onClick={onCancel} className="w-full bg-gray-100 text-gray-600 text-xs font-medium py-2 rounded-lg mt-1">
        Cancel
      </button>
    </div>
  )

  // ── Manual mode ───────────────────────────────────────────────────────
  return (
    <div className="mx-4 mt-3 p-4 border border-gray-200 rounded-xl bg-white shadow-sm flex flex-col max-h-[calc(100dvh-8rem)] overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700">
          {showPropertyFields ? 'New property — OM figures' : 'Enter OM figures'}
        </p>
        <button onClick={() => setMode('choose')}><X size={14} className="text-gray-400" /></button>
      </div>
      <MetaFields />
      <div className="grid grid-cols-2 gap-2 mb-3 flex-1 overflow-y-auto pr-1 min-h-0">
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-[9px] text-gray-400 mb-0.5">{f.label}</label>
            <div className="relative">
              {f.prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{f.prefix}</span>}
              <input type="number" step={f.step} value={inputs[f.key] as number}
                onChange={e => set(f.key, +e.target.value)}
                className={`w-full text-xs border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:border-navy
                  ${f.prefix ? 'pl-5 pr-2' : f.suffix ? 'pl-2 pr-5' : 'px-2'}`} />
              {f.suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{f.suffix}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={confirm}
          disabled={showPropertyFields && !propertyName.trim()}
          className="flex-1 bg-navy text-white text-xs font-semibold py-2.5 rounded-lg disabled:opacity-40">
          {showPropertyFields ? 'Create property + OM scenario' : 'Create OM scenario'}
        </button>
        <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-600 text-xs font-medium py-2 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  )
}
