import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, CheckCircle, XCircle, Clock, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface FeatureRequest {
  id: string
  title: string
  description: string | null
  category: string
  user_email: string | null
  status: string
  created_at: string
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', icon: Clock, color: 'text-blue-600 bg-blue-50' },
  { value: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  { value: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-50' },
  { value: 'done', label: 'Done', icon: CheckCircle, color: 'text-gray-600 bg-gray-100' },
]

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General', underwriting: 'Underwriting / P&L', pipeline: 'Deal Pipeline',
  tax: 'Tax / 1031', reporting: 'PDF / Reports', mobile: 'Mobile / iOS', other: 'Other',
}

export function AdminFeatureRequestsPage() {
  const [requests, setRequests] = useState<FeatureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('feature_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRequests((data as FeatureRequest[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('feature_requests').update({ status }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const deleteRequest = async (id: string) => {
    await supabase.from('feature_requests').delete().eq('id', id)
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  const parseDescription = (desc: string | null): any => {
    if (!desc) return null
    try { return JSON.parse(desc) } catch { return null }
  }

  const counts = {
    all: requests.length,
    new: requests.filter(r => r.status === 'new').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    done: requests.filter(r => r.status === 'done').length,
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Feature Requests</h1>
          <p className="text-xs text-gray-500">{counts.new} new · {counts.approved} approved · {requests.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {[{ value: 'all', label: 'All' }, ...STATUS_OPTIONS].map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === opt.value
                ? 'bg-[#1a1a2e] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label} ({counts[opt.value as keyof typeof counts] ?? 0})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-400 text-sm py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-12">No feature requests{filter !== 'all' ? ` with status "${filter}"` : ''}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const parsed = parseDescription(req.description)
            const isExpanded = expanded.has(req.id)
            const statusOpt = STATUS_OPTIONS.find(s => s.value === req.status) ?? STATUS_OPTIONS[0]
            const StatusIcon = statusOpt.icon

            return (
              <div key={req.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(req.id)}
                >
                  <StatusIcon size={16} className={statusOpt.color.split(' ')[0]} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                    <p className="text-[11px] text-gray-400">
                      {CATEGORY_LABELS[req.category] ?? req.category} · {req.user_email ?? 'anonymous'} · {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {parsed?.priority && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        parsed.priority === 'must-have' ? 'bg-red-100 text-red-700' :
                        parsed.priority === 'should-have' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {parsed.priority}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                    {parsed ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-700">{parsed.summary}</p>
                        <p className="text-xs text-gray-500 italic">{parsed.userStory}</p>
                        {parsed.acceptanceCriteria?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Acceptance Criteria</p>
                            <ul className="space-y-0.5">
                              {parsed.acceptanceCriteria.map((c: string, i: number) => (
                                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                                  <span className="text-[#c9a84c]">✓</span> {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {parsed.notes && (
                          <p className="text-[11px] text-gray-400 border-t border-gray-200 pt-2">{parsed.notes}</p>
                        )}
                      </div>
                    ) : req.description ? (
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">{req.description}</pre>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No description</p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200">
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateStatus(req.id, opt.value)}
                          disabled={req.status === opt.value}
                          className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                            req.status === opt.value
                              ? `${opt.color} cursor-default`
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <div className="flex-1" />
                      <button
                        onClick={() => deleteRequest(req.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
