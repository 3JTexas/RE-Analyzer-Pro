import { useState } from 'react'
import { Plus, Trash2, Download, Wrench } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import type { RepairEstimate, RepairSeverity, RepairStatus } from '../../types/pipeline'
import { RepairsPdf } from './RepairsPdf'

interface Props {
  repairEstimates: RepairEstimate[]
  onUpdate: (repairs: RepairEstimate[]) => void
  propertyName: string
  propertyAddress: string | null
  readOnly?: boolean
}

const SEVERITY_CONFIG: Record<RepairSeverity, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  medium: { label: 'Medium', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  high: { label: 'High', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', color: 'bg-red-50 text-red-700 border-red-200' },
}

const STATUS_CONFIG: Record<RepairStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600' },
  approved: { label: 'Approved', color: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-50 text-green-700' },
}

export function RepairsSection({ repairEstimates, onUpdate, propertyName, propertyAddress, readOnly }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState({
    description: '',
    severity: 'medium' as RepairSeverity,
    contractor: '',
    estimatedCost: '',
    notes: '',
  })
  const [generating, setGenerating] = useState(false)

  const totalCost = repairEstimates.reduce((s, r) => s + r.estimatedCost, 0)
  const criticalCount = repairEstimates.filter(r => r.severity === 'critical' || r.severity === 'high').length

  const addRepair = () => {
    if (!draft.description.trim()) return
    const repair: RepairEstimate = {
      id: crypto.randomUUID(),
      description: draft.description.trim(),
      severity: draft.severity,
      contractor: draft.contractor.trim(),
      estimatedCost: parseFloat(draft.estimatedCost) || 0,
      status: 'pending',
      fromInspection: false,
      notes: draft.notes.trim(),
    }
    onUpdate([...repairEstimates, repair])
    setDraft({ description: '', severity: 'medium', contractor: '', estimatedCost: '', notes: '' })
    setShowAdd(false)
  }

  const removeRepair = (id: string) => {
    onUpdate(repairEstimates.filter(r => r.id !== id))
  }

  const updateRepair = (id: string, updates: Partial<RepairEstimate>) => {
    onUpdate(repairEstimates.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  const handleDownloadPdf = async () => {
    setGenerating(true)
    try {
      const blob = await pdf(
        <RepairsPdf
          repairs={repairEstimates}
          propertyName={propertyName}
          propertyAddress={propertyAddress}
          totalCost={totalCost}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(propertyName || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_Repair_Estimates.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }

  const fmtD = (n: number) => `$${Math.round(n).toLocaleString()}`

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[10px] text-gray-500 mb-1">Total Items</div>
          <div className="text-xl font-semibold text-gray-900">{repairEstimates.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[10px] text-gray-500 mb-1">Estimated Cost</div>
          <div className="text-xl font-semibold text-gray-900">{fmtD(totalCost)}</div>
        </div>
        <div className={`border rounded-lg p-4 ${criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="text-[10px] text-gray-500 mb-1">High / Critical</div>
          <div className={`text-xl font-semibold ${criticalCount > 0 ? 'text-red-700' : 'text-green-700'}`}>{criticalCount}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-3">
        {!readOnly && (
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#c9a84c] hover:text-[#b8963f] transition-colors">
            <Plus size={14} /> Add Repair Item
          </button>
        )}
        {repairEstimates.length > 0 && (
          <button onClick={handleDownloadPdf} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-50">
            {generating ? 'Generating...' : <><Download size={12} /> Re-Trade PDF</>}
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white border border-[#c9a84c] rounded-lg p-4 mb-3">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Description *" className="col-span-2 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
            <select value={draft.severity} onChange={e => setDraft(d => ({ ...d, severity: e.target.value as RepairSeverity }))}
              className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <input type="number" value={draft.estimatedCost} onChange={e => setDraft(d => ({ ...d, estimatedCost: e.target.value }))}
              placeholder="Estimated cost ($)" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
            <input value={draft.contractor} onChange={e => setDraft(d => ({ ...d, contractor: e.target.value }))}
              placeholder="Contractor (optional)" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
            <input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="Notes (optional)" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={addRepair} disabled={!draft.description.trim()}
              className="flex-1 bg-[#1a1a2e] text-white text-xs font-medium py-2 rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40">
              Add Item
            </button>
            <button onClick={() => setShowAdd(false)}
              className="flex-1 bg-white border border-gray-200 text-gray-500 text-xs font-medium py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Repair items */}
      {repairEstimates.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Wrench size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No repair items yet</p>
          <p className="text-xs text-gray-400 mt-1">Add items from inspection findings or manually</p>
        </div>
      ) : (
        <div className="space-y-2">
          {repairEstimates.map(repair => (
            <div key={repair.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{repair.description}</span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${SEVERITY_CONFIG[repair.severity].color}`}>
                      {SEVERITY_CONFIG[repair.severity].label}
                    </span>
                    {!readOnly && (
                      <select value={repair.status}
                        onChange={e => updateRepair(repair.id, { status: e.target.value as RepairStatus })}
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${STATUS_CONFIG[repair.status].color}`}>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="completed">Completed</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    {repair.contractor && <span>Contractor: {repair.contractor}</span>}
                    {repair.notes && <span className="italic">{repair.notes}</span>}
                    {repair.fromInspection && <span className="text-blue-500 font-medium">From inspection</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900">{fmtD(repair.estimatedCost)}</span>
                  {!readOnly && (
                    <button onClick={() => { if (window.confirm('Remove?')) removeRepair(repair.id) }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {/* Total */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Total Estimated Cost</span>
            <span className="text-lg font-bold text-gray-900">{fmtD(totalCost)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
