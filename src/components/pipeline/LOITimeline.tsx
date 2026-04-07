import { useState, useRef } from 'react'
import { Send, MessageSquare, FileCheck, XCircle, RefreshCw, Upload, FileText, Plus, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmtDollar } from '../../lib/calc'
import type { LOITracking, LOIEvent, LOIEventType, LOIExtractedTerms } from '../../types/pipeline'

interface Props {
  loiTracking: LOITracking
  onUpdate: (loi: LOITracking) => void
  dealPrice: number
  pipelineId: string
}

const EVENT_CONFIG: Record<LOIEventType, { icon: typeof Send; color: string; bg: string; border: string; label: string }> = {
  sent: { icon: Send, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300', label: 'LOI Sent' },
  counter_offer: { icon: MessageSquare, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-300', label: 'Counter-Offer Received' },
  revised: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300', label: 'Revised LOI Sent' },
  accepted: { icon: FileCheck, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-300', label: 'LOI Accepted' },
  rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300', label: 'LOI Rejected' },
}

const TERM_LABELS: Record<string, string> = {
  purchasePrice: 'Purchase Price',
  earnestDeposit: 'Earnest Deposit',
  ddPeriodDays: 'DD Period',
  closingDays: 'Closing Period',
  contingencies: 'Contingencies',
  buyerName: 'Buyer',
  sellerName: 'Seller',
}

export function LOITimeline({ loiTracking, onUpdate, dealPrice, pipelineId }: Props) {
  const events = loiTracking.events ?? []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<{ type: LOIEventType; notes: string; price: string }>({
    type: 'sent', notes: '', price: String(dealPrice || ''),
  })
  const [uploading, setUploading] = useState<string | null>(null)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [uploadMode, setUploadMode] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState<LOIEventType>('sent')
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadTargetId = useRef<string | null>(null)
  const addFileRef = useRef<HTMLInputElement>(null)

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

  const suggestedType: LOIEventType = currentStatus === 'none' ? 'sent'
    : currentStatus === 'submitted' ? 'counter_offer'
    : currentStatus === 'counter_offer' ? 'revised'
    : 'sent'

  const toBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = () => rej(new Error('Read failed'))
      r.readAsDataURL(file)
    })

  // Upload PDF + extract terms → create event
  const handleUploadAndExtract = async () => {
    if (!uploadFile) return
    const eventId = crypto.randomUUID()
    setExtracting(eventId)

    try {
      // Upload file
      const ext = uploadFile.name.split('.').pop() ?? 'pdf'
      const path = `${pipelineId}/loi/${eventId}.${ext}`
      const { error: upErr } = await supabase.storage.from('deal-documents').upload(path, uploadFile, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('deal-documents').getPublicUrl(path)

      // Extract terms via AI — always attempt for PDFs
      let extracted: LOIExtractedTerms | null = null
      const isPdf = uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        try {
          const b64 = await toBase64(uploadFile)
          console.log('[LOI Extract] Sending PDF, base64 length:', b64.length)
          const { data, error } = await supabase.functions.invoke('extract-deal-doc', {
            body: { pdf: b64, docType: 'loi' },
          })
          console.log('[LOI Extract] Response:', { data, error })
          if (error) console.error('[LOI Extract] Error:', error)
          if (!error && data) extracted = data as LOIExtractedTerms
        } catch (e: any) {
          console.error('[LOI Extract] Exception:', e.message)
        }
      } else {
        console.log('[LOI Extract] Skipped — not a PDF. type:', uploadFile.type, 'name:', uploadFile.name)
      }

      const event: LOIEvent = {
        id: eventId,
        type: uploadType,
        date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
        notes: '',
        documentUrl: urlData.publicUrl,
        price: extracted?.purchasePrice ?? null,
        extractedTerms: extracted,
      }

      const newEvents = [...events, event]
      const newStatus = event.type === 'sent' || event.type === 'revised' ? 'submitted'
        : event.type === 'counter_offer' ? 'counter_offer'
        : event.type === 'accepted' ? 'accepted' : 'rejected'
      onUpdate({ ...loiTracking, events: newEvents, status: newStatus as any })
      setExpandedId(eventId)
    } catch (e: any) {
      console.error('Upload failed:', e.message)
    }

    setExtracting(null)
    setUploadMode(false)
    setUploadFile(null)
  }

  // Manual event (no PDF)
  const addManualEvent = () => {
    if (!draft.type) return
    const event: LOIEvent = {
      id: crypto.randomUUID(),
      type: draft.type,
      date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
      notes: draft.notes.trim(),
      documentUrl: null,
      price: draft.price ? parseFloat(draft.price) : null,
      extractedTerms: null,
    }
    const newEvents = [...events, event]
    const newStatus = event.type === 'sent' || event.type === 'revised' ? 'submitted'
      : event.type === 'counter_offer' ? 'counter_offer'
      : event.type === 'accepted' ? 'accepted' : 'rejected'
    onUpdate({ ...loiTracking, events: newEvents, status: newStatus as any })
    setDraft({ type: suggestedType, notes: '', price: '' })
    setAdding(false)
  }

  // Attach PDF to existing event + extract
  const handleAttachToEvent = async (file: File, eventId: string) => {
    setUploading(eventId)
    try {
      const ext = file.name.split('.').pop() ?? 'pdf'
      const path = `${pipelineId}/loi/${eventId}.${ext}`
      const { error } = await supabase.storage.from('deal-documents').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('deal-documents').getPublicUrl(path)

      let extracted: LOIExtractedTerms | null = null
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        setExtracting(eventId)
        try {
          const b64 = await toBase64(file)
          console.log('[LOI Attach Extract] Sending PDF, base64 length:', b64.length)
          const { data: extData, error: extErr } = await supabase.functions.invoke('extract-deal-doc', {
            body: { pdf: b64, docType: 'loi' },
          })
          console.log('[LOI Attach Extract] Response:', { data: extData, error: extErr })
          if (!extErr && extData) extracted = extData as LOIExtractedTerms
        } catch (e: any) {
          console.error('[LOI Attach Extract] Exception:', e.message)
        }
        setExtracting(null)
      }

      const updatedEvents = events.map(e =>
        e.id === eventId ? {
          ...e,
          documentUrl: data.publicUrl,
          extractedTerms: extracted ?? e.extractedTerms,
          price: extracted?.purchasePrice ?? e.price,
        } : e
      )
      onUpdate({ ...loiTracking, events: updatedEvents })
    } catch (e: any) {
      console.error('Upload failed:', e.message)
    }
    setUploading(null)
  }

  // Edit event
  const updateEvent = (eventId: string, updates: Partial<LOIEvent>) => {
    const updatedEvents = events.map(e => e.id === eventId ? { ...e, ...updates } : e)
    const last = updatedEvents[updatedEvents.length - 1]
    const newStatus = last.type === 'sent' || last.type === 'revised' ? 'submitted'
      : last.type === 'counter_offer' ? 'counter_offer'
      : last.type === 'accepted' ? 'accepted' : 'rejected'
    onUpdate({ ...loiTracking, events: updatedEvents, status: newStatus as any })
  }

  const deleteEvent = (eventId: string) => {
    const filtered = events.filter(e => e.id !== eventId)
    const last = filtered[filtered.length - 1]
    const newStatus = !last ? 'none'
      : last.type === 'sent' || last.type === 'revised' ? 'submitted'
      : last.type === 'counter_offer' ? 'counter_offer'
      : last.type === 'accepted' ? 'accepted' : 'rejected'
    onUpdate({ ...loiTracking, events: filtered, status: newStatus as any })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${statusColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">LOI Status</h3>
            <p className="text-[10px] mt-0.5 opacity-80">{statusLabel}</p>
          </div>
          {currentStatus !== 'accepted' && currentStatus !== 'rejected' && (
            <div className="flex items-center gap-2">
              <button onClick={() => { setUploadMode(true); setUploadType(suggestedType); setAdding(false) }}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold bg-white/80 border border-current rounded-lg hover:bg-white transition-colors">
                <Upload size={10} /> Upload LOI PDF
              </button>
              <button onClick={() => { setAdding(!adding); setUploadMode(false) }}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold bg-white/80 border border-current rounded-lg hover:bg-white transition-colors">
                <Plus size={10} /> Log Manually
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upload PDF mode */}
      {uploadMode && (
        <div className="px-4 py-3 border-b border-gray-200 bg-amber-50/50">
          <p className="text-xs font-semibold text-gray-700 mb-2">Upload LOI PDF — terms will be extracted automatically</p>
          <div className="flex items-end gap-3 mb-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-1">Event type</label>
              <select value={uploadType} onChange={e => setUploadType(e.target.value as LOIEventType)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white">
                <option value="sent">LOI Sent</option>
                <option value="counter_offer">Counter-Offer Received</option>
                <option value="revised">Revised LOI Sent</option>
                <option value="accepted">LOI Accepted (Executed)</option>
                <option value="rejected">LOI Rejected</option>
              </select>
            </div>
            <div className="flex-1">
              <input ref={addFileRef} type="file" accept="application/pdf,.doc,.docx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); e.target.value = '' }} />
              <button onClick={() => addFileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-[#c9a84c] transition-colors">
                {uploadFile ? (
                  <span className="text-xs font-medium text-gray-700">{uploadFile.name}</span>
                ) : (
                  <span className="text-xs text-gray-400">Click to select PDF</span>
                )}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleUploadAndExtract}
              disabled={!uploadFile || !!extracting}
              className="px-4 py-2 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40 flex items-center gap-1">
              {extracting ? <><Loader2 size={10} className="animate-spin" /> Extracting...</> : <><Sparkles size={10} /> Upload & Extract Terms</>}
            </button>
            <button onClick={() => { setUploadMode(false); setUploadFile(null) }}
              className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-500 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Manual add form */}
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
              placeholder="Notes" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white md:col-span-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={addManualEvent}
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
          <p className="text-[10px] text-gray-300 mt-0.5">Upload your LOI PDF or log it manually</p>
        </div>
      ) : (
        <div className="px-4 py-3">
          <input ref={fileRef} type="file" accept="application/pdf,.doc,.docx" className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f && uploadTargetId.current) handleAttachToEvent(f, uploadTargetId.current)
              e.target.value = ''
            }} />

          <div className="relative">
            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200" />

            <div className="space-y-3">
              {events.map((event, i) => {
                const config = EVENT_CONFIG[event.type]
                const Icon = config.icon
                const expanded = expandedId === event.id
                const isLatest = i === events.length - 1
                const isExtracting = extracting === event.id

                return (
                  <div key={event.id} className="relative pl-10">
                    <div className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2
                      ${isLatest ? config.border + ' ' + config.bg : 'border-gray-300 bg-gray-100'}`}
                      style={{ zIndex: 1 }}>
                      {isExtracting ? <Loader2 size={14} className="animate-spin text-[#c9a84c]" /> : <Icon size={14} className={isLatest ? config.color : 'text-gray-400'} />}
                    </div>

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
                            <span className="text-[9px] font-medium text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">PDF</span>
                          )}
                          {event.extractedTerms && (
                            <span className="text-[9px] font-medium text-[#c9a84c] bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Sparkles size={8} /> Extracted
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

                      {/* Expanded */}
                      {expanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200" onClick={e => e.stopPropagation()}>
                          {/* Editable fields */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                            <div>
                              <label className="block text-[9px] uppercase tracking-wide text-gray-500 font-medium mb-0.5">Type</label>
                              <select value={event.type} onChange={e => updateEvent(event.id, { type: e.target.value as LOIEventType })}
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white">
                                <option value="sent">LOI Sent</option>
                                <option value="counter_offer">Counter-Offer</option>
                                <option value="revised">Revised LOI</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase tracking-wide text-gray-500 font-medium mb-0.5">Date</label>
                              <input type="date" value={event.date} onChange={e => updateEvent(event.id, { date: e.target.value })}
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white" />
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase tracking-wide text-gray-500 font-medium mb-0.5">Price</label>
                              <input type="number" value={event.price ?? ''} onChange={e => updateEvent(event.id, { price: e.target.value ? parseFloat(e.target.value) : null })}
                                placeholder="—" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white" />
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="block text-[9px] uppercase tracking-wide text-gray-500 font-medium mb-0.5">Notes</label>
                            <input value={event.notes} onChange={e => updateEvent(event.id, { notes: e.target.value })}
                              placeholder="Add notes..." className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white" />
                          </div>

                          {/* Extracted terms */}
                          {event.extractedTerms && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                              <p className="text-[9px] font-semibold text-[#c9a84c] uppercase tracking-wide mb-2 flex items-center gap-1">
                                <Sparkles size={9} /> AI-Extracted Terms
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {Object.entries(event.extractedTerms)
                                  .filter(([_, v]) => v !== null && v !== undefined)
                                  .map(([key, val]) => (
                                    <div key={key} className="text-[10px]">
                                      <span className="text-gray-400">{TERM_LABELS[key] ?? key}: </span>
                                      <span className="text-gray-700 font-medium">
                                        {typeof val === 'number' ? (val > 100 ? fmtDollar(val) : `${val} days`) : String(val)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {event.documentUrl ? (
                              <a href={event.documentUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-[#c9a84c] border border-[#c9a84c] rounded-lg hover:bg-[#c9a84c] hover:text-white transition-colors">
                                <FileText size={10} /> View PDF
                              </a>
                            ) : (
                              <button
                                onClick={() => { uploadTargetId.current = event.id; fileRef.current?.click() }}
                                disabled={uploading === event.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors">
                                {uploading === event.id ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                                Attach PDF
                              </button>
                            )}
                            <button onClick={() => { if (window.confirm('Delete this event?')) deleteEvent(event.id) }}
                              className="px-2.5 py-1 text-[10px] font-medium text-gray-400 hover:text-red-500 transition-colors">
                              Delete
                            </button>
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
