import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, Camera } from 'lucide-react'
import { OM_DEFAULTS } from '../lib/calc'
import { supabase } from '../lib/supabase'
import { useUserDefaults } from '../hooks/useUserDefaults'
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
  { key: 'utilElec',  label: 'Electric',           step: 100,  prefix: '$' },
  { key: 'utilWater', label: 'Water & Sewer',     step: 100,  prefix: '$' },
  { key: 'utilTrash', label: 'Trash',             step: 100,  prefix: '$' },
  { key: 'util',  label: 'Total Utilities',       step: 500,  prefix: '$' },
  { key: 'rm',    label: 'R&M $/unit/yr',         step: 50,   prefix: '$' },
  { key: 'cs',    label: 'Contract services',     step: 100,  prefix: '$' },
  { key: 'ga',    label: 'G&A',                   step: 100,  prefix: '$' },
  { key: 'res',   label: 'Reserves $/unit/yr',    step: 50,   prefix: '$' },
  { key: 'pm',    label: 'Prop. mgmt %',          step: 0.5,  suffix: '%' },
]

// ── Extraction quality tiers ──────────────────────────────────────────────
const CRITICAL_FIELDS = [
  { key: 'price', label: 'Purchase price' },
  { key: 'tu', label: 'Total units' },
  { key: 'tax', label: 'Real estate taxes' },
  { key: 'ins', label: 'Insurance' },
]
const EXPECTED_FIELDS = [
  { key: 'ir', label: 'Interest rate' },
  { key: 'am', label: 'Amortization' },
  { key: 'lev', label: 'LTV %' },
  { key: 'pm', label: 'Prop mgmt %' },
]
const isFilled = (inp: ModelInputs, key: string) => {
  const v = (inp as any)[key]
  return v !== null && v !== undefined && v !== 0 && v !== ''
}

export interface OmConfirmMeta {
  scenarioName: string
  propertyName?: string
  propertyAddress?: string
  propertyYearBuilt?: number
  propertyImageUrl?: string
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
  const { loadDefaults } = useUserDefaults()

  // Merge user defaults into initial inputs on mount
  useEffect(() => {
    loadDefaults().then(d => {
      if (Object.keys(d).length > 0) {
        setInputs(prev => ({ ...prev, ...d }))
      }
    })
  }, [])
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle')
  const [pdfError, setPdfError] = useState('')
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [scenarioName, setScenarioName] = useState(defaultScenarioName)
  const [propertyName, setPropertyName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [propertyYearBuilt, setPropertyYearBuilt] = useState<number | undefined>(undefined)
  const [propertyImageUrl, setPropertyImageUrl] = useState<string | undefined>(undefined)
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof ModelInputs, val: number) =>
    setInputs(prev => ({ ...prev, [key]: val }))

  const addOtherIncome = () =>
    setInputs(prev => ({ ...prev, otherIncome: [...(prev.otherIncome ?? []), { label: 'Other income', amount: 0 }] }))
  const updateOtherIncome = (i: number, key: 'label' | 'amount', val: string | number) =>
    setInputs(prev => { const arr = [...(prev.otherIncome ?? [])]; arr[i] = { ...arr[i], [key]: val }; return { ...prev, otherIncome: arr } })
  const removeOtherIncome = (i: number) =>
    setInputs(prev => ({ ...prev, otherIncome: (prev.otherIncome ?? []).filter((_, idx) => idx !== i) }))

  const toBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = () => rej(new Error('Read failed'))
      r.readAsDataURL(file)
    })

  const uploadPhoto = async (file: File) => {
    setPhotoUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('property-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('property-images').getPublicUrl(path)
      setPropertyImageUrl(data.publicUrl)
    } catch (e: any) {
      console.error('Photo upload failed:', e.message)
    }
    setPhotoUploading(false)
  }

  const confirm = () => onConfirm(inputs, {
    scenarioName: scenarioName.trim() || defaultScenarioName,
    propertyName: showPropertyFields ? propertyName.trim() : undefined,
    propertyAddress: showPropertyFields ? propertyAddress.trim() : undefined,
    propertyYearBuilt: showPropertyFields ? propertyYearBuilt : undefined,
    propertyImageUrl: showPropertyFields ? propertyImageUrl : undefined,
  })

  const extractFromPdfs = async () => {
    if (!pdfFiles.length) return
    setPdfStatus('reading')
    setPdfError('')
    try {
      const base64s = await Promise.all(pdfFiles.map(toBase64))
      setPdfStatus('extracting')
      const { data, error: invokeError } = await supabase.functions.invoke('extract-om', {
        body: { pdfs: base64s },
      })
      if (invokeError) throw invokeError
      const parsed = data
      console.log('EXTRACTION RESULT:', JSON.stringify(parsed, null, 2))
      if (parsed.error) throw new Error(parsed.error)

      const merged: ModelInputs = { ...OM_DEFAULTS }
      const numericKeys = new Set(['price','tu','ou','rent','vp','lev','ir','am','tax','ins','utilElec','utilWater','utilTrash','util','rm','cs','ga','res','pm','yearBuilt'])
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== null && v !== undefined) {
          if (numericKeys.has(k)) {
            const n = typeof v === 'number' ? v : parseFloat(String(v))
            if (!isNaN(n)) (merged as any)[k] = n
          } else if (typeof v === 'number') {
            (merged as any)[k] = v
          } else if (k === 'otherIncome' && Array.isArray(v)) {
            merged.otherIncome = v.map((item: any) => ({
              label: String(item.label ?? ''),
              amount: typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0,
            }))
          }
        }
      }

      // Map boolean sub-metering flags
      if (parsed.utilElecSubmetered === true) merged.utilElecSubmetered = true
      if (parsed.utilWaterSubmetered === true) merged.utilWaterSubmetered = true

      // Default ou to tu if not extracted (100% occupied assumption)
      if ((merged.ou === 0 || merged.ou === undefined) && merged.tu > 0) {
        merged.ou = merged.tu
      }

      // Auto-sum utility sub-fields if util wasn't extracted directly
      const utilSub = (merged.utilElec ?? 0) + (merged.utilWater ?? 0) + (merged.utilTrash ?? 0)
      if (utilSub > 0 && !merged.util) {
        merged.util = utilSub
      }

      console.log('FORM STATE AFTER MAP:', JSON.stringify(merged, null, 2))

      // Auto-populate property name/address from extraction
      if (parsed.propertyName) setPropertyName(String(parsed.propertyName))
      if (parsed.propertyAddress) setPropertyAddress(String(parsed.propertyAddress))
      if (parsed.yearBuilt) {
        const yb = typeof parsed.yearBuilt === 'number' ? parsed.yearBuilt : parseInt(String(parsed.yearBuilt))
        if (!isNaN(yb)) setPropertyYearBuilt(yb)
      }

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


  // ── Other income rows ────────────────────────────────────────────────
  const OtherIncomeSection = () => (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Additional income</span>
        <button onClick={addOtherIncome}
          className="text-[9px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5">
          <span className="text-sm leading-none">+</span> Add
        </button>
      </div>
      {(inputs.otherIncome ?? []).length === 0 ? (
        <p className="text-[9px] text-gray-400 italic">No additional income — tap + Add to include laundry, parking, etc.</p>
      ) : (
        <div className="space-y-1">
          {(inputs.otherIncome ?? []).map((item, i) => (
            <div key={i} className="flex gap-1 items-center">
              <input value={item.label} onChange={e => updateOtherIncome(i, 'label', e.target.value)}
                placeholder="Label"
                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:border-navy" />
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                <input type="number" value={item.amount} onChange={e => updateOtherIncome(i, 'amount', +e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-md pl-5 pr-2 py-1 bg-white focus:outline-none focus:border-navy text-right" />
              </div>
              <button onClick={() => removeOtherIncome(i)} className="text-gray-300 hover:text-red-400 font-bold text-sm px-0.5">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

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
          <div>
            <label className="block text-[9px] text-gray-500 mb-0.5 font-medium uppercase tracking-wide">Property photo (optional)</label>
            <input ref={photoRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
            {propertyImageUrl ? (
              <div className="flex items-center gap-2">
                <img src={propertyImageUrl} alt="Property" className="w-16 h-12 object-cover rounded border border-gray-200" />
                <button onClick={() => photoRef.current?.click()}
                  className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">Change</button>
              </div>
            ) : (
              <button onClick={() => photoRef.current?.click()}
                disabled={photoUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-500">
                {photoUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                {photoUploading ? 'Uploading…' : 'Add photo'}
              </button>
            )}
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
    <div className="mx-4 mt-3 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
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
    <div className="mx-4 mt-3 p-4 border border-amber-200 rounded-xl bg-amber-50 shadow-sm flex flex-col max-h-[calc(100dvh-8rem)] overflow-y-auto">
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
      {pdfStatus === 'done' && (() => {
        const missingCritical = CRITICAL_FIELDS.filter(f => !isFilled(inputs, f.key))
        const missingRent = !isFilled(inputs, 'rent')
        const missingExpected = EXPECTED_FIELDS.filter(f => !isFilled(inputs, f.key))
        const hasMissing = missingCritical.length > 0 || missingRent || missingExpected.length > 0
        const criticalBlocked = missingCritical.length > 0
        return (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium mb-3">
            <CheckCircle size={13} /> Extracted — review details then confirm
          </div>

          {/* Extraction quality banner */}
          {hasMissing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {(missingCritical.length > 0 || missingRent) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <p className="text-[10px] font-semibold text-red-700 mb-1">
                    {missingCritical.length + (missingRent ? 1 : 0)} critical field{missingCritical.length + (missingRent ? 1 : 0) !== 1 ? 's' : ''} not found
                  </p>
                  <ul className="text-[9px] text-red-600 space-y-0.5 mb-1">
                    {missingCritical.map(f => <li key={f.key}>• {f.label}</li>)}
                    {missingRent && <li>• Avg rent <span className="text-red-400">(not required if entering per-unit rents)</span></li>}
                  </ul>
                  <p className="text-[8px] text-red-400">Required for accurate underwriting — enter manually below</p>
                </div>
              )}
              {missingExpected.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <p className="text-[10px] font-semibold text-amber-700 mb-1">
                    {missingExpected.length} expected field{missingExpected.length !== 1 ? 's' : ''} not found
                  </p>
                  <ul className="text-[9px] text-amber-600 space-y-0.5 mb-1">
                    {missingExpected.map(f => <li key={f.key}>• {f.label}</li>)}
                  </ul>
                  <p className="text-[8px] text-amber-400">Commonly in OMs — enter estimates if not shown</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 mb-3">
              <p className="text-[10px] font-semibold text-green-700">All key fields extracted successfully</p>
            </div>
          )}

          <MetaFields />
          <OtherIncomeSection />
          <button onClick={() => setMode('manual')}
            className="w-full mb-2 border border-amber-300 text-amber-700 text-xs font-medium py-2 rounded-lg hover:bg-amber-100">
            Review / edit all fields
          </button>
          <div className="relative group">
            <button onClick={confirm}
              disabled={(showPropertyFields && !propertyName.trim()) || criticalBlocked}
              className="w-full bg-navy text-white text-xs font-semibold py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
              {showPropertyFields ? 'Create property + OM scenario' : 'Create OM scenario'}
            </button>
            {criticalBlocked && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 px-2.5 py-2 text-[9px] leading-snug text-white bg-gray-800 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 text-center">
                Fill in the fields marked in red before continuing
              </span>
            )}
          </div>
        </div>
        )
      })()}
      <button onClick={onCancel} className="w-full bg-gray-100 text-gray-600 text-xs font-medium py-2 rounded-lg mt-1">
        Cancel
      </button>
    </div>
  )

  // ── Manual mode ───────────────────────────────────────────────────────
  return (
    <div className="mx-4 mt-3 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-700">
          {showPropertyFields ? 'New property — OM figures' : 'Enter OM figures'}
        </p>
        <button onClick={() => setMode('choose')}><X size={14} className="text-gray-400" /></button>
      </div>
      <MetaFields />
      <div className="grid grid-cols-2 gap-2 mb-3 max-h-64 overflow-y-auto pr-1">
        {FIELDS.map(f => {
          const filled = isFilled(inputs, f.key)
          const isCrit = !filled && CRITICAL_FIELDS.some(c => c.key === f.key)
          const isRent = !filled && f.key === 'rent'
          const isExp = !filled && EXPECTED_FIELDS.some(c => c.key === f.key)
          const borderCls = isCrit ? 'border-red-300 bg-red-50' : (isRent || isExp) ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
          return (
          <div key={f.key}>
            <label className="block text-[9px] text-gray-400 mb-0.5">
              {f.label}
              {isCrit && <span className="ml-1 text-red-500 font-medium">(not found)</span>}
              {isRent && <span className="ml-1 text-amber-500 font-medium">(not found)</span>}
              {isExp && <span className="ml-1 text-amber-500 font-medium">(not found)</span>}
            </label>
            <div className="relative">
              {f.prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{f.prefix}</span>}
              <input type="number" step={f.step} value={inputs[f.key] as number}
                onChange={e => set(f.key, +e.target.value)}
                className={`w-full text-xs border rounded-lg py-1.5 focus:outline-none focus:border-navy
                  ${borderCls} ${f.prefix ? 'pl-5 pr-2' : f.suffix ? 'pl-2 pr-5' : 'px-2'}`} />
              {f.suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{f.suffix}</span>}
            </div>
          </div>
          )
        })}
      </div>
      <OtherIncomeSection />
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
