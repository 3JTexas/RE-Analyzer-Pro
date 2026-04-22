import { useState, useRef } from 'react'
import { Upload, FileText, Trash2, Loader2, Download, Sparkles, Send, Inbox, MessageSquare, RefreshCw, FileCheck, XCircle, Edit3, Share2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useDealDocuments } from '../../hooks/usePipeline'
import { DocIterationTimeline } from './DocIterationTimeline'
import { PdfMarkupEditor } from './PdfMarkupEditor'
import { sharePdf } from '../../lib/sharePdf'
import type { DealDocType, LOITracking, PSATracking, LOIEvent, PSAEvent } from '../../types/pipeline'
import { DOC_TYPE_LABELS } from '../../types/pipeline'

const localDate = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]

interface Props {
  pipelineId: string
  loiTracking: LOITracking
  psaTracking: PSATracking
  onUpdateLOI: (loi: LOITracking) => void
  onUpdatePSA: (psa: PSATracking) => void
}

const DOC_TYPE_COLORS: Record<DealDocType, string> = {
  loi: 'bg-amber-50 text-amber-700 border-amber-200',
  psa: 'bg-blue-50 text-blue-700 border-blue-200',
  inspection_report: 'bg-red-50 text-red-700 border-red-200',
  contract: 'bg-purple-50 text-purple-700 border-purple-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
}

// LOI event type configs
const LOI_EVENT_TYPES = [
  { id: 'sent', label: 'LOI Sent', config: { icon: Send, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300', label: 'LOI Sent' } },
  { id: 'received', label: 'LOI Received', config: { icon: Inbox, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-300', label: 'LOI Received' } },
  { id: 'counter_offer', label: 'Counter-Offer Received', config: { icon: MessageSquare, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-300', label: 'Counter-Offer' } },
  { id: 'revised', label: 'Revised LOI Sent', config: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300', label: 'Revised LOI' } },
  { id: 'accepted', label: 'LOI Accepted', config: { icon: FileCheck, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-300', label: 'Accepted' } },
  { id: 'rejected', label: 'LOI Rejected', config: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300', label: 'Rejected' } },
]

// PSA event type configs
const PSA_EVENT_TYPES = [
  { id: 'draft_sent', label: 'Draft Sent (Buyer)', config: { icon: Send, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300', label: 'Draft Sent' } },
  { id: 'draft_received', label: 'Draft Received (Seller)', config: { icon: Inbox, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-300', label: 'Draft Received' } },
  { id: 'seller_redlines', label: 'Seller Redlines', config: { icon: Edit3, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-300', label: 'Seller Redlines' } },
  { id: 'buyer_redlines', label: 'Buyer Redlines', config: { icon: Edit3, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300', label: 'Buyer Redlines' } },
  { id: 'revised_sent', label: 'Revised PSA Sent', config: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300', label: 'Revised Sent' } },
  { id: 'revised_received', label: 'Revised PSA Received', config: { icon: RefreshCw, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-300', label: 'Revised Received' } },
  { id: 'executed', label: 'PSA Executed', config: { icon: FileCheck, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-300', label: 'Executed' } },
]

const loiSuggestNext = (events: any[]) => {
  if (events.length === 0) return 'sent'
  const last = events[events.length - 1].type
  if (last === 'sent' || last === 'revised') return 'counter_offer'
  if (last === 'counter_offer') return 'revised'
  return 'sent'
}

const psaSuggestNext = (events: any[]) => {
  if (events.length === 0) return 'draft_sent'
  const last = events[events.length - 1].type
  if (last === 'draft_sent' || last === 'revised_sent') return 'seller_redlines'
  if (last === 'draft_received' || last === 'revised_received') return 'buyer_redlines'
  if (last === 'seller_redlines') return 'revised_sent'
  if (last === 'buyer_redlines') return 'revised_received'
  return 'draft_sent'
}

export function DocumentsSection({ pipelineId, loiTracking, psaTracking, onUpdateLOI, onUpdatePSA }: Props) {
  const { documents, loading, uploadDocument, deleteDocument, updateExtracted } = useDealDocuments(pipelineId)
  const [uploading, setUploading] = useState(false)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<DealDocType>('inspection_report')
  const [editing, setEditing] = useState<{ url: string; name: string; kind: 'loi' | 'psa' | 'other'; docType?: DealDocType } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loiEvents = loiTracking?.events ?? []
  const psaEvents = psaTracking?.events ?? []

  const handleSaveMarkup = async (bytes: Uint8Array, newName: string) => {
    if (!editing) return
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
    const file = new File([blob], newName, { type: 'application/pdf' })

    if (editing.kind === 'other') {
      await uploadDocument(file, editing.docType ?? 'other')
      setEditing(null)
      return
    }

    // PSA or LOI — upload to timeline folder and add a new event
    const eventId = crypto.randomUUID()
    const path = `${pipelineId}/${editing.kind}/${eventId}.pdf`
    const { error: upErr } = await supabase.storage.from('deal-documents').upload(path, file, { upsert: false })
    if (upErr) { alert(`Upload failed: ${upErr.message}`); return }
    const { data: urlData } = supabase.storage.from('deal-documents').getPublicUrl(path)

    if (editing.kind === 'psa') {
      const newEvent: PSAEvent = {
        id: eventId,
        type: 'buyer_redlines',
        date: localDate(),
        notes: `Marked up from ${editing.name}`,
        documentUrl: urlData.publicUrl,
        extractedTerms: null,
      }
      onUpdatePSA({ events: [...psaEvents, newEvent] })
    } else {
      const newEvent: LOIEvent = {
        id: eventId,
        type: 'revised',
        date: localDate(),
        notes: `Marked up from ${editing.name}`,
        documentUrl: urlData.publicUrl,
        price: null,
        extractedTerms: null,
      }
      onUpdateLOI({ ...loiTracking, events: [...loiEvents, newEvent] as LOIEvent[] })
    }

    setEditing(null)
  }

  // Other documents (not LOI or PSA — those are in iteration timelines)
  const otherDocs = documents.filter(d => d.doc_type !== 'loi' && d.doc_type !== 'psa')

  const handleUpload = async (file: File) => {
    setUploading(true)
    await uploadDocument(file, selectedType)
    setUploading(false)
  }

  const handleExtract = async (doc: any) => {
    if (!doc.file_url || doc.doc_type === 'other') return
    setExtractingId(doc.id)
    try {
      const resp = await fetch(doc.file_url)
      const blob = await resp.blob()
      const b64 = await new Promise<string>((res) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })
      const { data, error } = await supabase.functions.invoke('extract-deal-doc', {
        body: { pdf: b64, docType: doc.doc_type },
      })
      if (!error && data) await updateExtracted(doc.id, data)
    } catch (e: any) {
      console.error('Extraction failed:', e.message)
    }
    setExtractingId(null)
  }

  const fmtSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      {/* LOI Iteration Timeline */}
      <DocIterationTimeline
        title="Letter of Intent (LOI)"
        events={loiEvents as any[]}
        onUpdate={events => {
          const lastEvt = events[events.length - 1]
          const newStatus = !lastEvt ? 'none'
            : lastEvt.type === 'sent' || lastEvt.type === 'revised' ? 'submitted'
            : lastEvt.type === 'counter_offer' ? 'counter_offer'
            : lastEvt.type === 'accepted' ? 'accepted' : 'rejected'
          onUpdateLOI({ ...loiTracking, events: events as LOIEvent[], status: newStatus as any })
        }}
        eventTypes={LOI_EVENT_TYPES}
        extractDocType="loi"
        pipelineId={pipelineId}
        showPrice
        suggestNextType={loiSuggestNext}
        onRequestEdit={(url, name) => setEditing({ url, name, kind: 'loi' })}
      />

      {/* PSA Iteration Timeline */}
      <DocIterationTimeline
        title="Purchase & Sale Agreement (PSA)"
        events={psaEvents as any[]}
        onUpdate={events => onUpdatePSA({ events: events as PSAEvent[] })}
        eventTypes={PSA_EVENT_TYPES}
        extractDocType="psa"
        pipelineId={pipelineId}
        suggestNextType={psaSuggestNext}
        onRequestEdit={(url, name) => setEditing({ url, name, kind: 'psa' })}
      />

      {/* Other Documents — inspection reports, contracts, etc. */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Other Documents</h3>
          <div className="flex items-end gap-2">
            <select value={selectedType} onChange={e => setSelectedType(e.target.value as DealDocType)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white">
              <option value="inspection_report">Inspection Report</option>
              <option value="contract">Contract</option>
              <option value="other">Other</option>
            </select>
            <input ref={fileRef} type="file" accept="application/pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-50">
              {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
              Upload
            </button>
          </div>
        </div>

        {otherDocs.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <FileText size={24} className="text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No other documents uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {otherDocs.map(doc => (
              <div key={doc.id} className="px-4 py-3 flex items-center gap-3">
                <FileText size={16} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900 truncate">{doc.file_name}</span>
                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border ${DOC_TYPE_COLORS[doc.doc_type as DealDocType] ?? DOC_TYPE_COLORS.other}`}>
                      {DOC_TYPE_LABELS[doc.doc_type as DealDocType] ?? 'Other'}
                    </span>
                    {doc.extracted && <span className="text-[8px] font-medium text-green-600 bg-green-50 border border-green-200 px-1 py-0.5 rounded-full">Extracted</span>}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {doc.doc_type !== 'other' && !doc.extracted && (
                    <button onClick={() => handleExtract(doc)} disabled={extractingId === doc.id}
                      className="flex items-center gap-1 px-2 py-1 text-[9px] font-semibold text-[#c9a84c] border border-[#c9a84c] rounded-lg hover:bg-[#c9a84c] hover:text-white transition-colors disabled:opacity-50">
                      {extractingId === doc.id ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />} Extract
                    </button>
                  )}
                  {doc.file_url && doc.file_name.toLowerCase().endsWith('.pdf') && (
                    <button
                      onClick={() => setEditing({ url: doc.file_url!, name: doc.file_name, kind: 'other', docType: doc.doc_type as DealDocType })}
                      className="flex items-center gap-1 px-2 py-1 text-[9px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
                      title="Edit / markup PDF">
                      <Edit3 size={9} /> Edit
                    </button>
                  )}
                  {doc.file_url && (
                    <button onClick={() => sharePdf(doc.file_url!, doc.file_name)}
                      className="p-1 text-gray-400 hover:text-[#c9a84c]" title="Open in another app / download">
                      <Share2 size={13} />
                    </button>
                  )}
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:text-[#c9a84c]" title="Download"><Download size={13} /></a>
                  <button onClick={() => { if (window.confirm('Delete?')) deleteDocument(doc.id) }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <PdfMarkupEditor
          pdfUrl={editing.url}
          fileName={editing.name}
          onSave={handleSaveMarkup}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
