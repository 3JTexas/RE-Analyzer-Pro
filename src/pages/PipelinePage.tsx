import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Lock, Unlock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePipeline } from '../hooks/usePipeline'
import { Spinner } from '../components/ui'
import type { Property } from '../types'
import type { MiniPipelineTab, FullPipelineTab } from '../types/pipeline'

interface PropertyMeta {
  name: string
  address: string | null
  status: string
  units: number | null
  year_built: number | null
  property_image_url: string | null
}

export function PipelinePage() {
  const { id } = useParams<{ id: string }>()
  const [property, setProperty] = useState<PropertyMeta | null>(null)
  const [propLoading, setPropLoading] = useState(true)
  const { pipeline, loading: pipelineLoading, updateLOITracking, updateMilestones, updateDealTeam, updateRepairEstimates, updateExpenseBudgets } = usePipeline(id)

  // Wide layout on mount
  useEffect(() => {
    document.getElementById('root')?.classList.add('wide-layout')
    return () => { document.getElementById('root')?.classList.remove('wide-layout') }
  }, [])

  // Load property meta
  useEffect(() => {
    if (!id) return
    supabase.from('properties').select('name, address, status, units, year_built, property_image_url')
      .eq('id', id).single()
      .then(({ data }) => { if (data) setProperty(data as PropertyMeta); setPropLoading(false) })
  }, [id])

  const status = property?.status ?? 'research'
  const isPending = status === 'pending'
  const isActive = status === 'active'
  const isClosed = status === 'closed'

  // Mini-pipeline tabs (Pending)
  const miniTabs: { id: MiniPipelineTab; label: string }[] = [
    { id: 'terms', label: 'Deal Terms' },
    { id: 'documents', label: 'Documents' },
    { id: 'contacts', label: 'Contacts' },
  ]

  // Full pipeline tabs (Active / Closed)
  const fullTabs: { id: FullPipelineTab; label: string }[] = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'documents', label: 'Documents' },
    { id: 'team', label: 'Deal Team' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'repairs', label: 'Repairs' },
  ]

  const tabs = isPending ? miniTabs : fullTabs
  const [activeTab, setActiveTab] = useState<string>(isPending ? 'terms' : 'timeline')

  // Reset tab when status changes
  useEffect(() => {
    if (isPending) setActiveTab('terms')
    else if (isActive || isClosed) setActiveTab('timeline')
  }, [isPending, isActive, isClosed])

  const statusConfig: Record<string, { label: string; color: string }> = {
    research: { label: 'Research', color: 'bg-gray-100 text-gray-600 border-gray-200' },
    pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    active: { label: 'Active', color: 'bg-green-50 text-green-700 border-green-200' },
    closed: { label: 'Closed', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  }

  if (propLoading || pipelineLoading) return <Spinner />

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-8 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <Link to={`/property/${id}`} className="flex items-center gap-0.5 -ml-1 text-gray-400 hover:text-[#1a1a2e] transition-colors">
          <ChevronLeft size={20} />
          <span className="text-xs">Property</span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-900 truncate">{property?.name}</h1>
            <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${statusConfig[status]?.color ?? statusConfig.research.color}`}>
              {statusConfig[status]?.label ?? 'Research'}
            </span>
          </div>
          {property?.address && <p className="text-xs text-gray-400 truncate">{property.address}</p>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 px-4 md:px-8">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors relative
              ${activeTab === tab.id
                ? 'text-[#1a1a2e] border-b-2 border-[#c9a84c] bg-white'
                : 'text-gray-400 hover:text-gray-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-6xl mx-auto w-full">
        {/* ── PENDING: Deal Terms ── */}
        {activeTab === 'terms' && pipeline && (
          <div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-xs font-semibold text-amber-800">LOI Submitted — Awaiting Response</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Track deal terms and counter-offers here. Upload the executed LOI to check for changes.</p>
            </div>

            {/* LOI Status */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">LOI Status</h3>
              </div>
              <div className="flex gap-2 mb-3">
                {(['submitted', 'counter_offer', 'accepted', 'rejected'] as const).map(s => {
                  const loi = pipeline.loi_tracking
                  const active = loi.status === s
                  const colors: Record<string, string> = {
                    submitted: 'border-amber-400 bg-amber-50 text-amber-700',
                    counter_offer: 'border-orange-400 bg-orange-50 text-orange-700',
                    accepted: 'border-green-400 bg-green-50 text-green-700',
                    rejected: 'border-red-400 bg-red-50 text-red-700',
                  }
                  const labels: Record<string, string> = {
                    submitted: 'Submitted', counter_offer: 'Counter-Offer', accepted: 'Accepted', rejected: 'Rejected',
                  }
                  return (
                    <button key={s}
                      onClick={() => updateLOITracking({ ...loi, status: s })}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-colors
                        ${active ? colors[s] : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'}`}>
                      {labels[s]}
                    </button>
                  )
                })}
              </div>

              {/* Counter-offer notes */}
              {pipeline.loi_tracking.status === 'counter_offer' && (
                <div className="mt-3">
                  <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-1">Counter-offer notes</label>
                  <textarea
                    value={pipeline.loi_tracking.counterOfferNotes}
                    onChange={e => updateLOITracking({ ...pipeline.loi_tracking, counterOfferNotes: e.target.value })}
                    placeholder="Price adjustment, revised terms, timeline changes..."
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white text-gray-800 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Deal Terms placeholder — will be populated from scenario data */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Deal Terms</h3>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Lock size={10} /> Locked — terms from scenario
                </span>
              </div>
              <p className="text-xs text-gray-400">Deal terms will be populated from the selected scenario's inputs (price, financing, key dates). Coming in next build.</p>
            </div>
          </div>
        )}

        {/* ── PENDING: Documents ── */}
        {activeTab === 'documents' && (
          <div>
            <p className="text-xs text-gray-400">Document upload and AI extraction — coming in Phase 6.</p>
          </div>
        )}

        {/* ── PENDING: Contacts ── */}
        {activeTab === 'contacts' && (
          <div>
            <p className="text-xs text-gray-400">Attorney and broker contacts — coming in Phase 7.</p>
          </div>
        )}

        {/* ── ACTIVE: Timeline ── */}
        {activeTab === 'timeline' && pipeline && (isActive || isClosed) && (
          <div>
            <p className="text-xs text-gray-400">Milestone timeline — coming in Phase 5.</p>
          </div>
        )}

        {/* ── ACTIVE: Deal Team ── */}
        {activeTab === 'team' && (
          <div>
            <p className="text-xs text-gray-400">Full deal team management — coming in Phase 7.</p>
          </div>
        )}

        {/* ── ACTIVE: Expenses ── */}
        {activeTab === 'expenses' && (
          <div>
            <p className="text-xs text-gray-400">Budget vs actual expenses — coming in Phase 8.</p>
          </div>
        )}

        {/* ── ACTIVE: Repairs ── */}
        {activeTab === 'repairs' && (
          <div>
            <p className="text-xs text-gray-400">Repair estimates and re-trade PDF — coming in Phase 9.</p>
          </div>
        )}
      </div>
    </div>
  )
}
