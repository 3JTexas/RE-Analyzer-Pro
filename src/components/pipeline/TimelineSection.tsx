import { useState } from 'react'
import { Check, Clock, Circle, ChevronDown, ChevronUp, Calendar, FileText, Send } from 'lucide-react'
import { fmtDollar } from '../../lib/calc'
import type { Milestone, MilestoneStatus, LOITracking, LOIEvent, PSATracking, PSAEvent } from '../../types/pipeline'

interface Props {
  milestones: Milestone[]
  onUpdate: (milestones: Milestone[]) => void
  loiTracking?: LOITracking
  psaTracking?: PSATracking
  readOnly?: boolean
}

const STATUS_CONFIG: Record<MilestoneStatus, { icon: typeof Check; color: string; bg: string; border: string; label: string }> = {
  pending: { icon: Circle, color: 'text-gray-400', bg: 'bg-gray-100', border: 'border-gray-300', label: 'Pending' },
  in_progress: { icon: Clock, color: 'text-[#c9a84c]', bg: 'bg-amber-50', border: 'border-[#c9a84c]', label: 'In Progress' },
  completed: { icon: Check, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-400', label: 'Completed' },
}

export function TimelineSection({ milestones, onUpdate, loiTracking, psaTracking, readOnly }: Props) {
  const loiEvents = loiTracking?.events ?? []
  const loiStatus = loiTracking?.status ?? 'none'
  const psaEvents = psaTracking?.events ?? []

  // Auto-derive LOI milestone status from LOI events
  const loiMilestoneStatus: MilestoneStatus = loiStatus === 'accepted' ? 'completed'
    : loiEvents.length > 0 ? 'in_progress' : 'pending'

  // Auto-derive PSA milestone status from PSA events
  const psaMilestoneStatus: MilestoneStatus = psaEvents.some(e => e.type === 'executed') ? 'completed'
    : psaEvents.length > 0 ? 'in_progress' : 'pending'
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const updateMilestone = (id: string, updates: Partial<Milestone>) => {
    const updated = milestones.map(m => m.id === id ? { ...m, ...updates } : m)
    onUpdate(updated)
  }

  const completedCount = milestones.filter(m => {
    if (m.id === 'loi') return loiMilestoneStatus === 'completed'
    if (m.id === 'psa') return psaMilestoneStatus === 'completed'
    return m.status === 'completed'
  }).length
  const progressPct = milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0

  return (
    <div>
      {/* Progress summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Deal Progress</h3>
          <span className="text-xs font-medium text-gray-500">{completedCount} of {milestones.length} milestones</span>
        </div>
        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#c9a84c] to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" style={{ zIndex: 0 }} />

        <div className="space-y-2">
          {milestones.map((milestone, i) => {
            const isLOI = milestone.id === 'loi'
            const isPSA = milestone.id === 'psa'
            const effectiveStatus = isLOI ? loiMilestoneStatus : isPSA ? psaMilestoneStatus : milestone.status
            const config = STATUS_CONFIG[effectiveStatus]
            const Icon = config.icon
            const expanded = expandedId === milestone.id
            const isLast = i === milestones.length - 1

            return (
              <div key={milestone.id} className="relative" style={{ zIndex: 1 }}>
                {/* Node */}
                <div
                  className={`flex items-start gap-3 cursor-pointer group`}
                  onClick={() => setExpandedId(expanded ? null : milestone.id)}
                >
                  {/* Circle indicator */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-colors
                    ${config.border} ${config.bg}`}>
                    <Icon size={16} className={config.color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3 group-hover:border-[#c9a84c] transition-colors min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">{milestone.name}</span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border}`}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {milestone.date && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(milestone.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </div>
                    {milestone.notes && !expanded && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate">{milestone.notes}</p>
                    )}
                  </div>
                </div>

                {/* Expanded editor — skip for LOI and PSA (status derived from events) */}
                {expanded && !readOnly && !isLOI && !isPSA && (
                  <div className="ml-13 mt-2 bg-white border border-[#c9a84c] rounded-lg p-4 shadow-sm" style={{ marginLeft: '52px' }}>
                    {/* Status selector */}
                    <div className="mb-3">
                      <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-1.5">Status</label>
                      <div className="flex gap-1.5">
                        {(['pending', 'in_progress', 'completed'] as MilestoneStatus[]).map(s => {
                          const sc = STATUS_CONFIG[s]
                          const active = milestone.status === s
                          return (
                            <button key={s}
                              onClick={(e) => { e.stopPropagation(); updateMilestone(milestone.id, { status: s }) }}
                              className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors
                                ${active ? `${sc.bg} ${sc.color} ${sc.border}` : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                              {sc.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="mb-3">
                      <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-1.5">Date</label>
                      <input
                        type="date"
                        value={milestone.date ?? ''}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateMilestone(milestone.id, { date: e.target.value || null })}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white text-gray-800"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-1.5">Notes</label>
                      <textarea
                        value={milestone.notes}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateMilestone(milestone.id, { notes: e.target.value })}
                        placeholder="Add notes about this milestone..."
                        rows={2}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white text-gray-800 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* LOI events inline — shown when LOI milestone is expanded */}
                {isLOI && expanded && loiEvents.length > 0 && (
                  <div className="mt-2 space-y-1.5" style={{ marginLeft: '52px' }}>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">LOI History</p>
                    {loiEvents.map(evt => {
                      const evtLabels: Record<string, string> = {
                        sent: 'LOI Sent', received: 'LOI Received', counter_offer: 'Counter-Offer', revised: 'Revised LOI', accepted: 'Accepted', rejected: 'Rejected',
                      }
                      const evtColors: Record<string, string> = {
                        sent: 'text-amber-600', received: 'text-purple-600', counter_offer: 'text-orange-600', revised: 'text-blue-600', accepted: 'text-green-600', rejected: 'text-red-600',
                      }
                      return (
                        <div key={evt.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <Send size={10} className={evtColors[evt.type] ?? 'text-gray-400'} />
                          <span className={`text-xs font-semibold ${evtColors[evt.type] ?? 'text-gray-700'}`}>{evtLabels[evt.type] ?? evt.type}</span>
                          {evt.price && <span className="text-xs font-bold text-gray-900">{fmtDollar(evt.price)}</span>}
                          {evt.documentUrl && <span className="text-[9px] text-green-600 bg-green-50 border border-green-200 px-1 py-0.5 rounded-full">PDF</span>}
                          <span className="text-[10px] text-gray-400 ml-auto">
                            {new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {evt.documentUrl && (
                            <a href={evt.documentUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#c9a84c] hover:underline">
                              <FileText size={10} />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* PSA events inline — shown when PSA milestone is expanded */}
                {isPSA && expanded && psaEvents.length > 0 && (
                  <div className="mt-2 space-y-1.5" style={{ marginLeft: '52px' }}>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">PSA History</p>
                    {psaEvents.map(evt => {
                      const evtLabels: Record<string, string> = {
                        draft_sent: 'Draft Sent', draft_received: 'Draft Received', seller_redlines: 'Seller Redlines', buyer_redlines: 'Buyer Redlines', revised_sent: 'Revised Sent', revised_received: 'Revised Received', revised: 'Revised', executed: 'Executed',
                      }
                      const evtColors: Record<string, string> = {
                        draft_sent: 'text-blue-600', draft_received: 'text-purple-600', seller_redlines: 'text-orange-600', buyer_redlines: 'text-amber-600', revised_sent: 'text-blue-600', revised_received: 'text-purple-600', revised: 'text-blue-600', executed: 'text-green-600',
                      }
                      return (
                        <div key={evt.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <FileText size={10} className={evtColors[evt.type] ?? 'text-gray-400'} />
                          <span className={`text-xs font-semibold ${evtColors[evt.type] ?? 'text-gray-700'}`}>{evtLabels[evt.type] ?? evt.type}</span>
                          {evt.documentUrl && <span className="text-[9px] text-green-600 bg-green-50 border border-green-200 px-1 py-0.5 rounded-full">PDF</span>}
                          <span className="text-[10px] text-gray-400 ml-auto">
                            {new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {evt.documentUrl && (
                            <a href={evt.documentUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#c9a84c] hover:underline">
                              <FileText size={10} />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Empty state for LOI/PSA when expanded with no events */}
                {(isLOI || isPSA) && expanded && ((isLOI && loiEvents.length === 0) || (isPSA && psaEvents.length === 0)) && (
                  <div className="mt-2" style={{ marginLeft: '52px' }}>
                    <p className="text-xs text-gray-400 italic">
                      No {isLOI ? 'LOI' : 'PSA'} documents uploaded yet. Use the Documents tab to upload and track iterations.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
