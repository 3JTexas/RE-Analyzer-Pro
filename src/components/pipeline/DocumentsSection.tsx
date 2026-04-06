import { useState, useRef } from 'react'
import { Upload, FileText, Trash2, Loader2, Download, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useDealDocuments } from '../../hooks/usePipeline'
import type { DealDocType, DealDocument } from '../../types/pipeline'
import { DOC_TYPE_LABELS } from '../../types/pipeline'

interface Props {
  pipelineId: string
}

const DOC_TYPE_COLORS: Record<DealDocType, string> = {
  loi: 'bg-amber-50 text-amber-700 border-amber-200',
  psa: 'bg-blue-50 text-blue-700 border-blue-200',
  inspection_report: 'bg-red-50 text-red-700 border-red-200',
  contract: 'bg-purple-50 text-purple-700 border-purple-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
}

export function DocumentsSection({ pipelineId }: Props) {
  const { documents, loading, uploadDocument, deleteDocument, updateExtracted } = useDealDocuments(pipelineId)
  const [uploading, setUploading] = useState(false)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<DealDocType>('other')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    await uploadDocument(file, selectedType)
    setUploading(false)
    setSelectedType('other')
  }

  const handleExtract = async (doc: DealDocument) => {
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
      if (error) throw error
      if (data) await updateExtracted(doc.id, data)
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
      {/* Upload area */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Upload Document</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-1.5">Document type</label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value as DealDocType)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white text-gray-800"
            >
              {(Object.keys(DOC_TYPE_LABELS) as DealDocType[]).map(t => (
                <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="text-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-400 mx-auto" />
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <FileText size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No documents uploaded yet</p>
          <p className="text-xs text-gray-400 mt-1">Upload LOIs, PSAs, inspection reports, and contracts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id}>
            <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3 hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${DOC_TYPE_COLORS[doc.doc_type as DealDocType] ?? DOC_TYPE_COLORS.other}`}>
                    {DOC_TYPE_LABELS[doc.doc_type as DealDocType] ?? 'Other'}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {doc.doc_type !== 'other' && !doc.extracted && (
                  <button onClick={() => handleExtract(doc)}
                    disabled={extractingId === doc.id}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[#c9a84c] border border-[#c9a84c] rounded-lg hover:bg-[#c9a84c] hover:text-white transition-colors disabled:opacity-50"
                    title="Extract data with AI">
                    {extractingId === doc.id ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    {extractingId === doc.id ? 'Extracting...' : 'Extract'}
                  </button>
                )}
                {doc.extracted && (
                  <span className="text-[9px] font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                    Extracted
                  </span>
                )}
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 text-gray-400 hover:text-[#c9a84c] transition-colors" title="Download">
                  <Download size={14} />
                </a>
                <button onClick={() => { if (window.confirm('Delete this document?')) deleteDocument(doc.id) }}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {/* Extracted data preview */}
            {doc.extracted && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Extracted Data</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(doc.extracted).filter(([_, v]) => v !== null && v !== '' && v !== undefined).slice(0, 12).map(([key, val]) => (
                    <div key={key} className="text-[10px]">
                      <span className="text-gray-400">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}: </span>
                      <span className="text-gray-700 font-medium">
                        {typeof val === 'number' ? (val > 1000 ? `$${val.toLocaleString()}` : String(val))
                          : typeof val === 'boolean' ? (val ? 'Yes' : 'No')
                          : typeof val === 'string' ? (val.length > 60 ? val.slice(0, 60) + '...' : val)
                          : Array.isArray(val) ? `${val.length} items`
                          : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
