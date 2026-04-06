import { useState, useRef } from 'react'
import { Upload, FileText, Trash2, Loader2, Download } from 'lucide-react'
import { useDealDocuments } from '../../hooks/usePipeline'
import type { DealDocType } from '../../types/pipeline'
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
  const { documents, loading, uploadDocument, deleteDocument } = useDealDocuments(pipelineId)
  const [uploading, setUploading] = useState(false)
  const [selectedType, setSelectedType] = useState<DealDocType>('other')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    await uploadDocument(file, selectedType)
    setUploading(false)
    setSelectedType('other')
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
            <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3 hover:border-gray-300 transition-colors">
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
          ))}
        </div>
      )}
    </div>
  )
}
