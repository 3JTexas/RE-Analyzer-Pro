import { useState, useRef } from 'react'
import { Send, MessageSquare, FileCheck, XCircle, RefreshCw, Upload, FileText, Plus, Loader2, ChevronDown, ChevronUp, Sparkles, Edit3 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmtDollar } from '../../lib/calc'

interface DocEvent {
  id: string
  type: string
  date: string
  notes: string
  documentUrl: string | null
  price?: number | null
  extractedTerms?: Record<string, any> | null
}

interface EventTypeConfig {
  icon: typeof Send
  color: string
  bg: string
  border: string
  label: string
}

interface Props {
  title: string
  events: DocEvent[]
  onUpdate: (events: DocEvent[]) => void
  eventTypes: { id: string; label: string; config: EventTypeConfig }[]
  extractDocType: string  // 'loi' | 'psa' for edge function
  pipelineId: string
  showPrice?: boolean
  suggestNextType?: (events: DocEvent[]) => string
}

const toBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = () => rej(new Error('Read failed'))
    r.readAsDataURL(file)
  })

const localDate = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]

export function DocIterationTimeline({ title, events, onUpdate, eventTypes, extractDocType, pipelineId, showPrice, suggestNextType }: Props) {
  const [uploadMode, setUploadMode] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState(eventTypes[0]?.id ?? '')
  const [extracting, setExtracting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingTermsId, setEditingTermsId] = useState<string | null>(null)
  const [termsDraft, setTermsDraft] = useState<Record<string, any>>({})
  const [draft, setDraft] = useState({ type: '', notes: '', price: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  const attachRef = useRef<HTMLInputElement>(null)
  const attachTargetId = useRef<string | null>(null)

  const suggested = suggestNextType?.(events) ?? eventTypes[0]?.id ?? ''
  const lastEvent = events[events.length - 1]
  const configMap: Record<string, EventTypeConfig> = Object.fromEntries(eventTypes.map(t => [t.id, t.config]))

  const handleUploadAndExtract = async () => {
    if (!uploadFile) return
    const eventId = crypto.randomUUID()
    setExtracting(eventId)
    try {
      const ext = uploadFile.name.split('.').pop() ?? 'pdf'
      const path = `${pipelineId}/${extractDocType}/${eventId}.${ext}`
      const { error: upErr } = await supabase.storage.from('deal-documents').upload(path, uploadFile, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('deal-documents').getPublicUrl(path)

      let extracted: Record<string, any> | null = null
      const isPdf = uploadFile.type === 'application/pdf' || uploadFile.name.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        try {
          const b64 = await toBase64(uploadFile)
          const { data, error } = await supabase.functions.invoke('extract-deal-doc', {
            body: { pdf: b64, docType: extractDocType },
          })
          if (!error && data) extracted = data
        } catch (e) {
          console.error('Extraction failed:', e)
        }
      }

      let eventDate = localDate()
      const dateField = extracted?.executionDate ?? extracted?.loiDate ?? extracted?.effectiveDate
      if (dateField) {
        const d = new Date(String(dateField))
        if (!isNaN(d.getTime())) {
          const raw = String(dateField).trim()
          eventDate = raw.match(/^\d{4}-\d{2}-\d{2}$/) ? raw : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
        }
      }

      const event: DocEvent = {
        id: eventId,
        type: uploadType,
        date: eventDate,
        notes: '',
        documentUrl: urlData.publicUrl,
        price: extracted?.purchasePrice ?? null,
        extractedTerms: extracted,
      }
      onUpdate([...events, event])
      setExpandedId(eventId)
    } catch (e: any) {
      console.error('Upload failed:', e.message)
    }
    setExtracting(null)
    setUploadMode(false)
    setUploadFile(null)
  }

  const addManualEvent = () => {
    const event: DocEvent = {
      id: crypto.randomUUID(),
      type: draft.type || suggested,
      date: localDate(),
      notes: draft.notes.trim(),
      documentUrl: null,
      price: draft.price ? parseFloat(draft.price) : null,
      extractedTerms: null,
    }
    onUpdate([...events, event])
    setDraft({ type: '', notes: '', price: '' })
    setManualMode(false)
  }

  const handleAttach = async (file: File, eventId: string) => {
    setExtracting(eventId)
    try {
      const ext = file.name.split('.').pop() ?? 'pdf'
      const path = `${pipelineId}/${extractDocType}/${eventId}.${ext}`
      const { error } = await supabase.storage.from('deal-documents').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('deal-documents').getPublicUrl(path)

      let extracted: Record<string, any> | null = null
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const b64 = await toBase64(file)
          const { data: extData, error: extErr } = await supabase.functions.invoke('extract-deal-doc', {
            body: { pdf: b64, docType: extractDocType },
          })
          if (!extErr && extData) extracted = extData
        } catch (e) { console.error('Extraction failed:', e) }
      }

      onUpdate(events.map(e => e.id === eventId ? {
        ...e, documentUrl: data.publicUrl,
        extractedTerms: extracted ?? e.extractedTerms,
        price: extracted?.purchasePrice ?? e.price,
      } : e))
    } catch (e: any) { console.error('Upload failed:', e.message) }
    setExtracting(null)
  }

  const updateEvent = (eventId: string, updates: Partial<DocEvent>) => {
    onUpdate(events.map(e => e.id === eventId ? { ...e, ...updates } : e))
  }

  const deleteEvent = (eventId: string) => {
    onUpdate(events.filter(e => e.id !== eventId))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {events.length > 0 && (
            <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{events.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setUploadType(suggested); setUploadMode(!uploadMode); setManualMode(false) }}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-[#c9a84c] border border-[#c9a84c] rounded-lg hover:bg-[#c9a84c] hover:text-white transition-colors">
            <Upload size={10} /> Upload PDF
          </button>
          <button onClick={() => { setDraft(d => ({ ...d, type: suggested })); setManualMode(!manualMode); setUploadMode(false) }}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            <Plus size={10} /> Log Manually
          </button>
        </div>
      </div>

      {/* Upload mode */}
      {uploadMode && (
        <div className="px-4 py-3 border-b border-gray-200 bg-amber-50/50">
          <div className="flex items-end gap-3 mb-2">
            <div>
              <label className="block text-[9px] uppercase tracking-wide text-gray-500 font-medium mb-1">Type</label>
              <select value={uploadType} onChange={e => setUploadType(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white">
                {eventTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <input ref={fileRef} type="file" accept="application/pdf,.doc,.docx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); e.target.value = '' }} />
              <button onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-2.5 text-center hover:border-[#c9a84c] transition-colors">
                <span className="text-xs text-gray-400">{uploadFile ? uploadFile.name : 'Select PDF'}</span>
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleUploadAndExtract} disabled={!uploadFile || !!extracting}
              className="px-4 py-1.5 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40 flex items-center gap-1">
              {extracting ? <><Loader2 size={10} className="animate-spin" /> Extracting...</> : <><Sparkles size={10} /> Upload & Extract</>}
            </button>
            <button onClick={() => { setUploadMode(false); setUploadFile(null) }}
              className="px-4 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-500 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Manual mode */}
      {manualMode && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            <select value={draft.type || suggested} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white">
              {eventTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {showPrice && (
              <input type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))}
                placeholder="Price ($)" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
            )}
            <input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="Notes" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white md:col-span-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={addManualEvent}
              className="px-4 py-1.5 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors">Log Event</button>
            <button onClick={() => setManualMode(false)}
              className="px-4 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-500 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {/* Event timeline */}
      {events.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <FileText size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">No {title.toLowerCase()} activity yet</p>
        </div>
      ) : (
        <div className="px-4 py-3">
          <input ref={attachRef} type="file" accept="application/pdf,.doc,.docx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f && attachTargetId.current) handleAttach(f, attachTargetId.current); e.target.value = '' }} />

          <div className="relative">
            <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-200" />
            <div className="space-y-2">
              {events.map((evt, i) => {
                const cfg = configMap[evt.type] ?? { icon: FileText, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-300', label: evt.type }
                const Icon = cfg.icon
                const expanded = expandedId === evt.id
                const isLatest = i === events.length - 1

                return (
                  <div key={evt.id} className="relative pl-8">
                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2
                      ${isLatest ? cfg.border + ' ' + cfg.bg : 'border-gray-300 bg-gray-100'}`} style={{ zIndex: 1 }}>
                      {extracting === evt.id ? <Loader2 size={11} className="animate-spin text-[#c9a84c]" /> : <Icon size={11} className={isLatest ? cfg.color : 'text-gray-400'} />}
                    </div>
                    <div className={`border rounded-lg p-2.5 transition-colors
                      ${isLatest ? cfg.border + ' ' + cfg.bg : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedId(expanded ? null : evt.id)}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isLatest ? cfg.color : 'text-gray-700'}`}>{cfg.label}</span>
                          {evt.price && showPrice && <span className="text-xs font-bold text-gray-900">{fmtDollar(evt.price)}</span>}
                          {evt.documentUrl && <span className="text-[8px] font-medium text-green-600 bg-green-50 border border-green-200 px-1 py-0.5 rounded-full">PDF</span>}
                          {evt.extractedTerms && <span className="text-[8px] font-medium text-[#c9a84c] bg-amber-50 border border-amber-200 px-1 py-0.5 rounded-full flex items-center gap-0.5"><Sparkles size={7} />AI</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400">{new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          {expanded ? <ChevronUp size={11} className="text-gray-400" /> : <ChevronDown size={11} className="text-gray-400" />}
                        </div>
                      </div>
                      {evt.notes && !expanded && <p className="text-[10px] text-gray-400 mt-1 truncate">{evt.notes}</p>}

                      {expanded && (
                        <div className="mt-2 pt-2 border-t border-gray-200" onClick={e => e.stopPropagation()}>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                            <div>
                              <label className="block text-[9px] uppercase tracking-wide text-gray-500 font-medium mb-0.5">Type</label>
                              <select value={evt.type} onChange={e => updateEvent(evt.id, { type: e.target.value })}
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white">
                                {eventTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase tracking-wide text-gray-500 font-medium mb-0.5">Date</label>
                              <input type="date" value={evt.date} onChange={e => updateEvent(evt.id, { date: e.target.value })}
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white" />
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase tracking-wide text-gray-500 font-medium mb-0.5">Notes</label>
                              <input value={evt.notes} onChange={e => updateEvent(evt.id, { notes: e.target.value })}
                                placeholder="..." className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white" />
                            </div>
                          </div>
                          {evt.extractedTerms && (() => {
                            const isEditing = editingTermsId === evt.id
                            const displayData = isEditing ? termsDraft : evt.extractedTerms!
                            const entries = Object.entries(displayData).filter(([_, v]) => v !== null && v !== undefined)

                            return (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 mb-2">
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[8px] font-semibold text-[#c9a84c] uppercase tracking-wide flex items-center gap-1"><Sparkles size={8} /> Extracted Terms</p>
                                <div className="flex items-center gap-1">
                                  {isEditing ? (
                                    <>
                                      <button onClick={() => { updateEvent(evt.id, { extractedTerms: termsDraft }); setEditingTermsId(null) }}
                                        className="px-2 py-0.5 text-[9px] font-semibold bg-green-500 text-white rounded hover:bg-green-600 transition-colors">Save</button>
                                      <button onClick={() => setEditingTermsId(null)}
                                        className="px-2 py-0.5 text-[9px] font-medium text-gray-400 hover:text-gray-600">Cancel</button>
                                    </>
                                  ) : (
                                    <button onClick={() => { setTermsDraft({ ...evt.extractedTerms }); setEditingTermsId(evt.id) }}
                                      className="px-2 py-0.5 text-[9px] font-medium text-gray-400 hover:text-[#c9a84c] transition-colors flex items-center gap-0.5">
                                      <Edit3 size={8} /> Edit
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                {entries.slice(0, 15).map(([key, val]) => (
                                  <div key={key} className="text-[9px]">
                                    <label className="text-gray-400 block">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</label>
                                    {isEditing ? (
                                      <input
                                        value={typeof termsDraft[key] === 'boolean' ? (termsDraft[key] ? 'true' : 'false') : String(termsDraft[key] ?? '')}
                                        onChange={e => {
                                          const v = e.target.value
                                          const num = parseFloat(v)
                                          setTermsDraft(d => ({ ...d, [key]: v === 'true' ? true : v === 'false' ? false : !isNaN(num) && v === String(num) ? num : v }))
                                        }}
                                        className="w-full text-[9px] font-medium text-gray-700 border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#c9a84c] bg-white"
                                      />
                                    ) : (
                                      <span className="text-gray-700 font-medium">
                                        {typeof val === 'number' ? (val > 100 ? fmtDollar(val) : String(val))
                                          : typeof val === 'boolean' ? (val ? 'Yes' : 'No')
                                          : typeof val === 'string' ? (val.length > 50 ? val.slice(0, 50) + '...' : val)
                                          : Array.isArray(val) ? `${val.length} items` : String(val)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            )
                          })()}
                          <div className="flex items-center gap-2">
                            {evt.documentUrl ? (
                              <a href={evt.documentUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[#c9a84c] border border-[#c9a84c] rounded-lg hover:bg-[#c9a84c] hover:text-white transition-colors">
                                <FileText size={9} /> View PDF
                              </a>
                            ) : (
                              <button onClick={() => { attachTargetId.current = evt.id; attachRef.current?.click() }}
                                disabled={extracting === evt.id}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-[#c9a84c] transition-colors">
                                {extracting === evt.id ? <Loader2 size={9} className="animate-spin" /> : <Upload size={9} />} Attach PDF
                              </button>
                            )}
                            <button onClick={() => { if (window.confirm('Delete?')) deleteEvent(evt.id) }}
                              className="px-2 py-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors">Delete</button>
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
