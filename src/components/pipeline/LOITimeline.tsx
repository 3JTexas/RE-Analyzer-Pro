import { useState, useRef } from 'react'
import { Send, MessageSquare, FileCheck, XCircle, RefreshCw, Upload, FileText, Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmtDollar } from '../../lib/calc'
import type { LOITracking, LOIEvent, LOIEventType } from '../../types/pipeline'

interface Props {
  loiTracking: LOITracking
  onUpdate: (loi: LOITracking) => void
  dealPrice: number  // from the deal scenario for reference
  pipelineId: string
}

const EVENT_CONFIG: Record<LOIEventType, { icon: typeof Send; color: string; bg: string; border: string; label: string }> = {
  sent: { icon: Send, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300', label: 'LOI Sent' },
  counter_offer: { icon: MessageSquare, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-300', label: 'Counter-Offer Received' },
  revised: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300', label: 'Revised LOI Sent' },
  accepted: { icon: FileCheck, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-300', label: 'LOI Accepted' },
  rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300', label: 'LOI Rejected' },
}

export function LOITimeline({ loiTracking, onUpdate, dealPrice, pipelineId }: Props) {
  const events = loiTracking.events ?? []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<{ type: LOIEventType; notes: string; price: string }>({
    type: 'sent', notes: '', price: String(dealPrice || ''),
  })
  const [uploading, setUploading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadTargetId = useRef<string | null>(null)

  // Derive current status from last event
  const currentStatus = events.length === 0 ? 'none'
    : events[events.length - 1].type === 'sent' || events[events.length - 1].type === 'revised' ? 'submitted'
    : events[events.length - 1].type === 'counter_offer' ? 'counter_offer'
    : events[events.length - 1].type === 'accepted' ? 'accepted'
    : 'rejected'

  const statusLabel = currentStatus === 'none' ? 'No LOI Activity'
    : currentStatus === 'submitted' ? 'LOI Submitted — Awaiting Response'
    : currentStatus === 'counter_offer' ? 'Counter-Offer Received — Action Needed'
    : currentStatus === 'accepted' ? 'LOI Accepted'
    : 'LOI Rejected'

  const statusColor = currentStatus === 'none' ? 'bg-gray-100 text-gray-600 border-gray-200'
    : currentStatus === 'submitted' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : currentStatus === 'counter_offer' ? 'bg-orange-50 text-orange-700 border-orange-200'
    : currentStatus === 'accepted' ? 'bg-green-50 text-green-700 border-green-200'
    : 'bg-red-50 text-red-700 border-red-200'

  // Suggest next action based on current status
  const suggestedType: LOIEventType = currentStatus === 'none' ? 'sent'
    : currentStatus === 'submitted' ? 'counter_offer'
    : currentStatus === 'counter_offer' ? 'revised'
    : 'sent'

  const addEvent = () => {
    if (!draft.type) return
    const event: LOIEvent = {
      id: crypto.randomUUID(),
      type: draft.type,
      date: new Date().toISOString().split('T')[0],
      notes: draft.notes.trim(),
      documentUrl: null,
      price: draft.price ? parseFloat(draft.price) : null,
    }
    const newEvents = [...events, event]
    const newStatus = event.type === 'sent' || event.type === 'revised' ? 'submitted'
      : event.type === 'counter_offer' ? 'counter_offer'
      : event.type === 'accepted' ? 'accepted' : 'rejected'
    onUpdate({ ...loiTracking, events: newEvents, status: newStatus as any })
    setDraft({ type: suggestedType, notes: '', price: '' })
    setAdding(false)
  }

  const handleFileUpload = async (file: File, eventId: string) => {
    setUploading(eventId)
    try {
      const ext = file.name.split('.').pop() ?? 'pdf'
      const path = `${pipelineId}/loi/${eventId}.${ext}`
      const { error } = await supabase.storage.from('deal-documents').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('deal-documents').getPublicUrl(path)
      const updatedEvents = events.map(e =>
        e.id === eventId ? { ...e, documentUrl: data.publicUrl } : e
      )
      onUpdate({ ...loiTracking, events: updatedEvents })
    } catch (e: any) {
      console.error('Upload failed:', e.message)
    }
    setUploading(null)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
      {/* Header with current status */}
      <div className={`px-4 py-3 border-b ${statusColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">LOI Status</h3>
            <p className="text-[10px] mt-0.5 opacity-80">{statusLabel}</p>
          </div>
          {currentStatus !== 'accepted' && currentStatus !== 'rejected' && (
            <button onClick={() => { setDraft(d => ({ ...d, type: suggestedType })); setAdding(!adding) }}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold bg-white/80 border border-current rounded-lg hover:bg-white transition-colors">
              <Plus size={10} />
              {currentStatus === 'none' ? 'Log LOI Sent' :
                currentStatus === 'submitted' ? 'Log Response' :
                'Log Next Action'}
            </button>
          )}
        </div>
      </div>

      {/* Add event form */}
      {adding && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value as LOIEventType }))}
              className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white">
              <option value="sent">LOI Sent</option>
              <option value="counter_offer">Counter-Offer Received</option>
              <option value="revised">Revised LOI Sent</option>
              <option value="accepted">LOI Accepted</option>
              <option value="rejected">LOI Rejected</option>
            </select>
            <input type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
              placeholder="Price ($)" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
            <input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="Notes (optional)" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white md:col-span-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={addEvent}
              className="px-4 py-2 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors">
              Log Event
            </button>
            <button onClick={() => setAdding(false)}
              className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-500 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <Send size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">No LOI activity yet</p>
          <p className="text-[10px] text-gray-300 mt-0.5">Generate an LOI from your scenario, then log it here when sent</p>
        </div>
      ) : (
        <div className="px-4 py-3">
          <input ref={fileRef} type="file" accept="application/pdf,.doc,.docx" className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f && uploadTargetId.current) handleFileUpload(f, uploadTargetId.current)
              e.target.value = ''
            }} />

          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200" />

            <div className="space-y-3">
              {events.map((event, i) => {
                const config = EVENT_CONFIG[event.type]
                const Icon = config.icon
                const expanded = expandedId === event.id
                const isLatest = i === events.length - 1

                return (
                  <div key={event.id} className="relative pl-10">
                    {/* Node circle */}
                    <div className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2
                      ${isLatest ? config.border + ' ' + config.bg : 'border-gray-300 bg-gray-100'}`}
                      style={{ zIndex: 1 }}>
                      <Icon size={14} className={isLatest ? config.color : 'text-gray-400'} />
                    </div>

                    {/* Event card */}
                    <div
                      className={`border rounded-lg p-3 cursor-pointer transition-colors
                        ${isLatest ? config.border + ' ' + config.bg : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      onClick={() => setExpandedId(expanded ? null : event.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isLatest ? config.color : 'text-gray-700'}`}>
                            {config.label}
                          </span>
                          {event.price && (
                            <span className="text-xs font-bold text-gray-900">{fmtDollar(event.price)}</span>
                          )}
                          {event.documentUrl && (
                            <span className="text-[9px] font-medium text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                              PDF
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">
                            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {expanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                        </div>
                      </div>
                      {event.notes && !expanded && (
                        <p className="text-[10px] text-gray-400 mt-1 truncate">{event.notes}</p>
                      )}

                      {/* Expanded details */}
                      {expanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200" onClick={e => e.stopPropagation()}>
                          {event.notes && (
                            <p className="text-xs text-gray-600 mb-2">{event.notes}</p>
                          )}
                          <div className="flex items-center gap-2">
                            {event.documentUrl ? (
                              <a href={event.documentUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-[#c9a84c] border border-[#c9a84c] rounded-lg hover:bg-[#c9a84c] hover:text-white transition-colors">
                                <FileText size={10} /> View Document
                              </a>
                            ) : (
                              <button
                                onClick={() => { uploadTargetId.current = event.id; fileRef.current?.click() }}
                                disabled={uploading === event.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors">
                                {uploading === event.id ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                                {uploading === event.id ? 'Uploading...' : 'Attach PDF'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
