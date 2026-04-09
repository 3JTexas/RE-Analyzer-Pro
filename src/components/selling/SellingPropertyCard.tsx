import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, Link2, Calendar } from 'lucide-react'
import type { SellingProperty, Exchange1031Link } from '../../types/selling'
import { computeSaleAnalysis } from '../../types/selling'

const fmtD = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString()}`
const fmtNeg = (v: number) => v < 0 ? `(${fmtD(v)})` : fmtD(v)

const STATUS_CONFIG = {
  listed: { label: 'Listed', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  under_contract: { label: 'Under Contract', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed: { label: 'Closed', color: 'bg-green-50 text-green-700 border-green-200' },
}

interface Props {
  property: SellingProperty
  onUpdate: (id: string, updates: Partial<SellingProperty>) => void
  onDelete: (id: string) => void
  links: Exchange1031Link[]
  buyProperties: { id: string; name: string; address: string }[]
  onCreateLink: (sellingId: string, buyingId: string, amount: number) => void
  onRemoveLink: (linkId: string) => void
}

export function SellingPropertyCard({ property: sp, onUpdate, onDelete, links, buyProperties, onCreateLink, onRemoveLink }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [linkingTo, setLinkingTo] = useState<string | null>(null)
  const analysis = computeSaleAnalysis(sp)
  const cfg = STATUS_CONFIG[sp.status] ?? STATUS_CONFIG.listed

  const set = (key: keyof SellingProperty, val: any) => onUpdate(sp.id, { [key]: val })

  const inputCls = "w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-purple-400 bg-white"
  const labelCls = "block text-[9px] uppercase tracking-wide text-gray-500 font-medium mb-0.5"

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">{sp.name}</span>
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
          </div>
          {sp.address && <p className="text-[10px] text-gray-400 truncate mt-0.5">{sp.address}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {sp.sale_price > 0 && (
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">{fmtD(sp.sale_price)}</div>
              <div className="text-[9px] text-green-600">Net: {fmtD(analysis.netProceeds)}</div>
            </div>
          )}
          {links.length > 0 && (
            <span className="text-[9px] font-medium text-purple-500 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Link2 size={8} /> {links.length} linked
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4">
          {/* Status + timeline dates */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div>
              <label className={labelCls}>Status</label>
              <select value={sp.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                <option value="listed">Listed</option>
                <option value="under_contract">Under Contract</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Listed Date</label>
              <input type="date" value={sp.listing_date ?? ''} onChange={e => set('listing_date', e.target.value || null)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contract Date</label>
              <input type="date" value={sp.contract_date ?? ''} onChange={e => set('contract_date', e.target.value || null)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Closing Date</label>
              <input type="date" value={sp.closing_date ?? ''} onChange={e => set('closing_date', e.target.value || null)} className={inputCls} />
            </div>
          </div>

          {/* Name + Address */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div>
              <label className={labelCls}>Property Name</label>
              <input value={sp.name} onChange={e => set('name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input value={sp.address ?? ''} onChange={e => set('address', e.target.value || null)} className={inputCls} />
            </div>
          </div>

          {/* Financial fields */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Sale Details</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Sale Price ($)</label>
                <input type="number" value={sp.sale_price || ''} onChange={e => set('sale_price', parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Selling Costs (%)</label>
                <input type="number" step="0.5" value={sp.selling_costs_pct} onChange={e => set('selling_costs_pct', parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Mortgage Payoff ($)</label>
                <input type="number" value={sp.mortgage_payoff || ''} onChange={e => set('mortgage_payoff', parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Original Basis (for 1031 / Tax)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Original Purchase Price ($)</label>
                <input type="number" value={sp.original_purchase_price || ''} onChange={e => set('original_purchase_price', parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Capital Improvements ($)</label>
                <input type="number" value={sp.capital_improvements || ''} onChange={e => set('capital_improvements', parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Depreciation Taken ($)</label>
                <input type="number" value={sp.depreciation_taken || ''} onChange={e => set('depreciation_taken', parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cap Gains Rate (%)</label>
                <input type="number" step="0.1" value={sp.cg_rate} onChange={e => set('cg_rate', parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Recapture Rate (%)</label>
                <input type="number" step="1" value={sp.recapture_rate} onChange={e => set('recapture_rate', parseFloat(e.target.value) || 0)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Computed analysis */}
          {sp.sale_price > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
              <p className="text-[9px] font-semibold text-purple-600 uppercase tracking-wide mb-2">Sale Analysis</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-[9px] text-gray-500">Net Proceeds</div>
                  <div className="font-bold text-gray-900">{fmtD(analysis.netProceeds)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500">Capital Gain</div>
                  <div className="font-bold text-gray-900">{fmtD(analysis.capitalGain)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500">Cap Gains Tax</div>
                  <div className="font-bold text-red-600">{fmtD(analysis.capGainsTax)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-500">Total Tax Deferred (1031)</div>
                  <div className="font-bold text-green-700">{fmtD(analysis.totalTaxDeferred)}</div>
                </div>
              </div>
            </div>
          )}

          {/* 1031 Links */}
          <div className="mb-4">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">1031 Exchange Links</p>
            {links.length > 0 ? (
              <div className="space-y-1.5 mb-2">
                {links.map(link => {
                  const buyProp = buyProperties.find(p => p.id === link.buying_property_id)
                  return (
                    <div key={link.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <Link2 size={10} className="text-purple-500" />
                      <span className="text-xs font-medium text-gray-900 flex-1">{buyProp?.name ?? 'Unknown Property'}</span>
                      <span className="text-xs font-bold text-purple-700">{fmtD(link.allocated_amount)}</span>
                      <button onClick={() => onRemoveLink(link.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 mb-2">No purchase properties linked yet</p>
            )}
            {linkingTo !== null ? (
              <div className="flex gap-2">
                <select value={linkingTo} onChange={e => setLinkingTo(e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-400 bg-white">
                  <option value="">Select purchase property...</option>
                  {buyProperties.filter(p => !links.some(l => l.buying_property_id === p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (linkingTo) { onCreateLink(sp.id, linkingTo, analysis.netProceeds); setLinkingTo(null) } }}
                  disabled={!linkingTo}
                  className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40">
                  Link
                </button>
                <button onClick={() => setLinkingTo(null)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-500 rounded-lg">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setLinkingTo('')}
                className="flex items-center gap-1 text-[10px] font-medium text-purple-600 hover:text-purple-700 transition-colors">
                <Link2 size={10} /> Link to purchase property
              </button>
            )}
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className={labelCls}>Notes</label>
            <textarea value={sp.notes ?? ''} onChange={e => set('notes', e.target.value || null)}
              placeholder="Notes about this sale..." rows={2}
              className={`${inputCls} resize-none`} />
          </div>

          {/* Delete */}
          <div className="flex justify-end">
            <button onClick={() => { if (window.confirm(`Delete "${sp.name}"? This will also remove all 1031 links.`)) onDelete(sp.id) }}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={10} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
