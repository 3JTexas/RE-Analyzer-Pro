import { useState, useRef } from 'react'
import { FileSearch, X, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import type { TaxRecordExtraction } from '../types'

interface Props {
  currentTax: number
  currentLand: number
  units: number
  purchasePrice: number
  onApply: (tax: number, land: number) => void
}

export function TaxRecordImport({ currentTax, currentLand, units, purchasePrice, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [data, setData] = useState<TaxRecordExtraction | null>(null)
  const [applied, setApplied] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const toBase64 = (f: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = () => rej(new Error('Read failed'))
      r.readAsDataURL(f)
    })

  const extract = async () => {
    if (!file) return
    setStatus('loading')
    setError('')
    try {
      const b64 = await toBase64(file)
      const resp = await fetch(
        'https://mrraacrijhzlchskuzru.supabase.co/functions/v1/extract-tax-record',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ pdf: b64 }),
        }
      )
      const parsed = await resp.json()
      if (parsed.error) throw new Error(parsed.error)
      setData(parsed as TaxRecordExtraction)
      setStatus('done')
    } catch (e: any) {
      setError(e.message ?? 'Extraction failed')
      setStatus('error')
    }
  }

  const handleApply = () => {
    if (!data) return
    const tax = data.annualTaxBill ?? currentTax
    const land = data.landPct ?? currentLand
    onApply(tax, land)
    setApplied(true)
    setTimeout(() => { setApplied(false); setOpen(false); setStatus('idle'); setFile(null); setData(null) }, 2000)
  }

  const close = () => { setOpen(false); setStatus('idle'); setFile(null); setData(null); setError('') }

  const fmtD = (n: number | null) => n != null ? `$${n.toLocaleString()}` : '—'

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded hover:border-blue-400 hover:text-blue-500 transition-colors">
        <FileSearch size={12} /> Import Tax Record
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full max-w-md mx-4 my-8 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Import County Tax Record</h2>
          <button onClick={close} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="px-4 py-4">
          {/* STATE: Upload */}
          {status === 'idle' && (
            <>
              <p className="text-[10px] text-gray-400 mb-3">Upload a PDF from the county property appraiser to auto-populate corrected tax values</p>
              <input ref={ref} type="file" accept="application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
              <button onClick={() => ref.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors mb-3">
                <Upload size={20} className="mx-auto mb-1 text-gray-400" />
                <p className="text-xs text-gray-600">{file ? file.name : 'Drop PDF here or tap to select'}</p>
              </button>
              {file && (
                <button onClick={extract}
                  className="w-full bg-blue-600 text-white text-xs font-semibold py-2.5 rounded-lg hover:bg-blue-700">
                  Extract Tax Data
                </button>
              )}
            </>
          )}

          {/* STATE: Loading */}
          {status === 'loading' && (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-600">
              <Loader2 size={16} className="animate-spin" /> Reading tax record...
            </div>
          )}

          {/* STATE: Error */}
          {status === 'error' && (
            <div className="text-center py-4">
              <AlertCircle size={24} className="mx-auto text-red-400 mb-2" />
              <p className="text-xs text-red-600 mb-3">{error}</p>
              <button onClick={() => { setStatus('idle'); setError('') }}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium">Try again</button>
            </div>
          )}

          {/* STATE: Review */}
          {status === 'done' && data && (
            <div className="space-y-3">
              {applied && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                  <CheckCircle size={13} /> Applied — tax and land % updated
                </div>
              )}

              {/* Property info */}
              <div className="bg-gray-50 rounded-lg p-3 text-[10px] text-gray-500 space-y-0.5">
                {data.parcelId && <p><strong>Parcel:</strong> {data.parcelId}</p>}
                {data.ownerName && <p><strong>Owner:</strong> {data.ownerName}</p>}
                {data.taxYear && <p><strong>Tax Year:</strong> {data.taxYear}</p>}
                {data.propertyAddress && <p><strong>Address:</strong> {data.propertyAddress}</p>}
              </div>

              {/* Assessed values */}
              <div className="border border-gray-100 rounded-lg p-3">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Assessed Values</p>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div><span className="text-gray-400 block">Total</span><span className="font-semibold text-gray-800">{fmtD(data.assessedValue)}</span></div>
                  <div><span className="text-gray-400 block">Land</span><span className="font-semibold text-gray-800">{fmtD(data.landValue)}{data.landPct != null ? <span className="text-gray-400 ml-1">({data.landPct.toFixed(1)}%)</span> : ''}</span></div>
                  <div><span className="text-gray-400 block">Improvements</span><span className="font-semibold text-gray-800">{fmtD(data.improvementValue)}</span></div>
                </div>
              </div>

              {/* Tax details */}
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide mb-2">Tax Details</p>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div><span className="text-blue-400 block">Taxable Value</span><span className="font-semibold text-blue-800">{fmtD(data.taxableValue)}</span></div>
                  <div><span className="text-blue-400 block">Millage Rate</span><span className="font-semibold text-blue-800">{data.millageRate != null ? `${data.millageRate.toFixed(4)} mills` : '—'}</span></div>
                  <div><span className="text-blue-400 block">Annual Tax Bill</span><span className="font-bold text-blue-900 text-sm">{fmtD(data.annualTaxBill)}</span></div>
                </div>
              </div>

              {/* Comparison */}
              {(currentTax > 0 || currentLand > 0) && (
                <div className="border border-gray-100 rounded-lg p-3">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2">vs Current Inputs</p>
                  <div className="space-y-1.5 text-[10px]">
                    {currentTax > 0 && data.annualTaxBill != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Tax: Current ${currentTax.toLocaleString()} → Record {fmtD(data.annualTaxBill)}</span>
                        {(() => {
                          const diff = data.annualTaxBill! - currentTax
                          return <span className={`font-semibold ${diff > 0 ? 'text-red-600' : 'text-green-700'}`}>{diff > 0 ? '+' : ''}{fmtD(diff)}</span>
                        })()}
                      </div>
                    )}
                    {data.landPct != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Land %: Current {currentLand}% → Record {data.landPct.toFixed(1)}%</span>
                        <span className="font-semibold text-gray-700">{data.landPct > currentLand ? '+' : ''}{(data.landPct - currentLand).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              {!applied && (
                <div className="flex gap-2 pt-1">
                  <button onClick={close}
                    className="flex-1 bg-gray-100 text-gray-600 text-xs font-medium py-2.5 rounded-lg">Cancel</button>
                  <button onClick={handleApply}
                    disabled={data.annualTaxBill == null && data.landPct == null}
                    className="flex-1 bg-blue-600 text-white text-xs font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-40">
                    Apply to Inputs
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
