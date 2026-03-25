import { useState } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import type { LOIData } from '../../types/loi'
import { LOIDocument } from './LOIDocument'

interface Props {
  initial: LOIData
  onClose: () => void
}

function Field({ label, value, onChange, placeholder, readOnly, wide }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean; wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <label className="block text-[9px] text-gray-500 mb-0.5 font-medium uppercase tracking-wide">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400
          ${readOnly ? 'bg-gray-50 text-gray-500 cursor-default' : 'bg-white'}`}
      />
    </div>
  )
}

export function LOIModal({ initial, onClose }: Props) {
  const [data, setData] = useState<LOIData>(initial)
  const [generating, setGenerating] = useState(false)
  const [editPrice, setEditPrice] = useState(false)

  const set = (key: keyof LOIData, val: string) => setData(prev => ({ ...prev, [key]: val }))

  const handleDownload = async () => {
    setGenerating(true)
    try {
      const blob = await pdf(<LOIDocument data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (data.propertyName || 'Property').replace(/[^a-zA-Z0-9]/g, '_')
      const safeDate = (data.date || 'undated').replace(/[^a-zA-Z0-9]/g, '_')
      a.download = `LOI_${safeName}_${safeDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full max-w-lg mx-4 my-8 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Generate LOI</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="px-4 py-3 overflow-y-auto max-h-[calc(100dvh-10rem)]">
          {/* Template toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-4">
            <button
              onClick={() => set('template', 'original')}
              className={`flex-1 px-3 py-2 text-xs font-semibold text-center transition-colors
                ${data.template === 'original' ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:bg-gray-50'}`}>
              Simple
              <span className="block text-[9px] font-normal mt-0.5">Lean 2-page format</span>
            </button>
            <button
              onClick={() => set('template', 'buyer-friendly')}
              className={`flex-1 px-3 py-2 text-xs font-semibold text-center transition-colors
                ${data.template === 'buyer-friendly' ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-50'}`}>
              Buyer-Friendly
              <span className="block text-[9px] font-normal mt-0.5">DD checklist + seller reps</span>
            </button>
          </div>

          {/* Auto-populated */}
          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Property (auto-populated)</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Field label="Property" value={data.propertyName} onChange={v => set('propertyName', v)} readOnly />
            <Field label="Address" value={data.propertyAddress} onChange={v => set('propertyAddress', v)} readOnly />
            <Field label="Units" value={data.units} onChange={v => set('units', v)} readOnly />
            <div>
              <label className="block text-[9px] text-gray-500 mb-0.5 font-medium uppercase tracking-wide">Purchase Price</label>
              <div className="flex gap-1">
                <input
                  value={data.purchasePrice}
                  onChange={e => set('purchasePrice', e.target.value)}
                  readOnly={!editPrice}
                  className={`flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400
                    ${!editPrice ? 'bg-gray-50 text-gray-500 cursor-default' : 'bg-white'}`}
                />
                <button onClick={() => setEditPrice(!editPrice)}
                  className="text-[9px] text-blue-500 hover:text-blue-700 px-1.5 whitespace-nowrap">
                  {editPrice ? 'Lock' : 'Edit'}
                </button>
              </div>
            </div>
          </div>

          {/* Deal terms */}
          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Deal Terms</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Field label="Date" value={data.date} onChange={v => set('date', v)} />
            <Field label="Recipient Names (broker)" value={data.recipientNames} onChange={v => set('recipientNames', v)} placeholder="John Smith, Jane Doe" />
            <Field label="Seller Entity Name" value={data.sellerName} onChange={v => set('sellerName', v)} placeholder="Seller LLC" wide />
            <div className="col-span-2">
              <label className="block text-[9px] text-gray-500 mb-0.5 font-medium uppercase tracking-wide">Earnest Deposit</label>
              <input
                value={data.earnestDeposit}
                onChange={e => set('earnestDeposit', e.target.value)}
                onBlur={e => {
                  const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''))
                  if (!isNaN(n) && n > 0) set('earnestDeposit', `$${n.toLocaleString('en-US')}`)
                }}
                placeholder="e.g. 100,000"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
              />
            </div>
            <Field label="Due Diligence (days)" value={data.ddPeriodDays} onChange={v => set('ddPeriodDays', v)} />
            <Field label="DD Doc Delivery (biz days)" value={data.ddDeliveryDays} onChange={v => set('ddDeliveryDays', v)} />
          </div>

          {/* Financing */}
          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Financing & Closing</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Field label="Min Loan Amount" value={data.loanAmountMin} onChange={v => set('loanAmountMin', v)} />
            <Field label="Loan Approval (days)" value={data.loanApprovalDays} onChange={v => set('loanApprovalDays', v)} />
            <Field label="Closing (days after DD)" value={data.closingDays} onChange={v => set('closingDays', v)} />
          </div>

          {/* Parties */}
          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Parties</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Field label="Purchaser Name" value={data.purchaserName} onChange={v => set('purchaserName', v)} wide />
            <Field label="Purchaser's Counsel" value={data.purchaserCounsel} onChange={v => set('purchaserCounsel', v)} wide />
          </div>

          {/* LOI Expiration */}
          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">LOI Expiration</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Field label="Expires in (biz days)" value={data.loiExpirationDays} onChange={v => set('loiExpirationDays', v)} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-600 text-xs font-medium py-2.5 rounded-lg">
            Cancel
          </button>
          <button onClick={handleDownload} disabled={generating}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white text-xs font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
