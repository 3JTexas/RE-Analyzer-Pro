import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, Trash2, ChevronRight, GripVertical, Camera, Loader2, ArrowRight, TrendingUp, Clock, DollarSign, Tag } from 'lucide-react'
import { useProperties, useScenario } from '../hooks/useScenario'
import { useSellingProperties, use1031Links } from '../hooks/useSellingProperties'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/ui'
import { SetupFlow } from '../components/OMSetupFlow'
import { fmtDollar } from '../lib/calc'
import { computeSaleAnalysis } from '../types/selling'
import { SellingPropertyCard } from '../components/selling/SellingPropertyCard'
import type { ModelInputs, Property } from '../types'
import type { SetupConfirmMeta } from '../components/OMSetupFlow'

export function PropertiesPage() {
  const { properties, loading, createProperty, deleteProperty, reorderProperties, refresh } = useProperties()
  const { properties: sellingProps, loading: sellingLoading, create: createSelling, update: updateSelling, remove: removeSelling } = useSellingProperties()
  const { links: allLinks, createLink, removeLink } = use1031Links()
  const [showAddSelling, setShowAddSelling] = useState(false)
  const [newSellingName, setNewSellingName] = useState('')
  const [newSellingAddress, setNewSellingAddress] = useState('')
  const [pipelines, setPipelines] = useState<Record<string, string | null>>({}) // propertyId → deal_scenario_id

  // Load pipeline deal_scenario_ids for all properties
  useEffect(() => {
    if (properties.length === 0) return
    supabase.from('deal_pipelines').select('property_id, deal_scenario_id').then(({ data }) => {
      if (data) {
        const map: Record<string, string | null> = {}
        data.forEach((p: any) => { map[p.property_id] = p.deal_scenario_id })
        setPipelines(map)
      }
    })
  }, [properties])

  const getDealPrice = (p: Property): number => {
    const dealScenarioId = pipelines[p.id]
    if (dealScenarioId) {
      const ds = p.scenarios?.find(s => s.id === dealScenarioId)
      if (ds) return ds.inputs?.price ?? 0
    }
    // Fallback: first non-default scenario
    const fallback = p.scenarios?.find(s => !s.is_default) ?? p.scenarios?.[0]
    return fallback?.inputs?.price ?? 0
  }

  const dragIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const { createScenario } = useScenario()
  const navigate = useNavigate()
  const [showSetup, setShowSetup] = useState(false)
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoTargetId = useRef<string | null>(null)

  const handlePhotoUpload = async (file: File, propertyId: string) => {
    setUploadingPhotoId(propertyId)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${propertyId}.${ext}`
      const { error } = await supabase.storage.from('property-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('property-images').getPublicUrl(path)
      await supabase.from('properties').update({ property_image_url: data.publicUrl }).eq('id', propertyId)
      refresh()
    } catch (e: any) {
      console.error('Photo upload failed:', e.message)
    }
    setUploadingPhotoId(null)
  }

  const handleConfirm = async (inputs: ModelInputs, meta: SetupConfirmMeta) => {
    setShowSetup(false)
    // If user chose to add scenario to an existing property, skip property creation
    const propertyId = meta.addToExistingPropertyId
      ?? (await createProperty(
        meta.propertyName || 'New Property',
        meta.propertyAddress || undefined,
        meta.propertyYearBuilt || undefined,
        meta.propertyImageUrl || undefined,
        inputs.tu || undefined
      ))?.id
    if (!propertyId) return
    const scenario = await createScenario(propertyId, meta.scenarioName, inputs, true)
    if (scenario) navigate(`/scenario/${scenario.id}`)
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 md:px-8 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-[11px] tracking-[0.2em] uppercase text-gray-400 font-medium">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">{properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button onClick={() => setShowSetup(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium tracking-wide border border-[#c9a84c] text-[#c9a84c] rounded-sm bg-transparent hover:bg-[#c9a84c] hover:text-white transition-colors">
          <Plus size={13} /> New Property
        </button>
      </div>

      {showSetup && (
        <div className="flex-1 overflow-y-auto">
          <SetupFlow
            showPropertyFields
            onConfirm={handleConfirm}
            onCancel={() => setShowSetup(false)}
            existingProperties={properties.map(p => ({
              id: p.id,
              name: p.name,
              address: p.address,
              scenarioCount: p.scenarios?.length ?? 0,
            }))}
          />
        </div>
      )}

      <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f && photoTargetId.current) handlePhotoUpload(f, photoTargetId.current); e.target.value = '' }} />

      {/* ── UNIFIED VIEW — Live Deals + R&D ── */}
      {!showSetup && (
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-5 pb-6 max-w-5xl mx-auto w-full">
          {(() => {
            const liveDeals = properties.filter(p => p.status === 'pending' || p.status === 'active')
            const closedDeals = properties.filter(p => p.status === 'closed')
            const research = properties.filter(p => !p.status || p.status === 'research')
            const totalPipelineValue = liveDeals.reduce((sum, p) => sum + getDealPrice(p), 0)

            const statusBadge = (s: string) => {
              const cfg: Record<string, string> = {
                pending: 'bg-amber-50 text-amber-700 border-amber-200',
                active: 'bg-green-50 text-green-700 border-green-200',
                closed: 'bg-blue-50 text-blue-700 border-blue-200',
              }
              const labels: Record<string, string> = { pending: 'Pending', active: 'Active', closed: 'Closed' }
              return <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${cfg[s] ?? ''}`}>{labels[s] ?? s}</span>
            }

            const DealCard = ({ p }: { p: Property }) => {
              const price = getDealPrice(p)
              return (
                <Link to={`/property/${p.id}/pipeline`}
                  className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-4 hover:border-[#c9a84c] transition-colors group">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                    {p.property_image_url ? (
                      <img src={p.property_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Building2 size={18} className="text-gray-300" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900 truncate">{p.name}</span>
                      {statusBadge(p.status)}
                    </div>
                    {p.address && <div className="text-xs text-gray-400 truncate">{p.address}</div>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                      {p.units && <span>{p.units} units</span>}
                      {price > 0 && <span className="font-medium text-gray-600">{fmtDollar(price)}</span>}
                      {p.created_at && (
                        <span>Imported {new Date(p.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-[#c9a84c] transition-colors flex-shrink-0" />
                </Link>
              )
            }

            return (
              <>
                {/* Metrics — only show when live deals exist */}
                {liveDeals.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} className="text-[#c9a84c]" />
                        <span className="text-[10px] text-gray-500">Live Deals</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{liveDeals.length}</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={14} className="text-green-600" />
                        <span className="text-[10px] text-gray-500">Pipeline Value</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{fmtDollar(totalPipelineValue)}</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 size={14} className="text-blue-500" />
                        <span className="text-[10px] text-gray-500">R&D</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{research.length}</div>
                    </div>
                  </div>
                )}

                {/* ── LIVE DEALS section ── */}
                {liveDeals.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-[11px] tracking-[0.15em] uppercase text-[#c9a84c] font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp size={13} /> Live Deals
                    </h2>
                    <div className="space-y-2">
                      {liveDeals.map(p => <DealCard key={p.id} p={p} />)}
                    </div>
                  </div>
                )}

                {/* ── CLOSED DEALS section ── */}
                {closedDeals.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-[11px] tracking-[0.15em] uppercase text-blue-500 font-semibold mb-3 flex items-center gap-2">
                      <Building2 size={13} /> Closed Deals
                    </h2>
                    <div className="space-y-2">
                      {closedDeals.map(p => <DealCard key={p.id} p={p} />)}
                    </div>
                  </div>
                )}

                {/* ── Properties I'm Selling ── */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[11px] tracking-[0.15em] uppercase text-purple-500 font-semibold flex items-center gap-2">
                      <Tag size={13} /> Properties I'm Selling
                    </h2>
                    {!showAddSelling && (
                      <button onClick={() => setShowAddSelling(true)}
                        className="flex items-center gap-1 text-[10px] font-medium text-purple-500 hover:text-purple-600 transition-colors">
                        <Plus size={12} /> Add Sale
                      </button>
                    )}
                  </div>
                  {showAddSelling && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input value={newSellingName} onChange={e => setNewSellingName(e.target.value)}
                          placeholder="Property name *" autoFocus
                          className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400 bg-white" />
                        <input value={newSellingAddress} onChange={e => setNewSellingAddress(e.target.value)}
                          placeholder="Address (optional)"
                          className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400 bg-white" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          if (newSellingName.trim()) {
                            await createSelling(newSellingName.trim(), newSellingAddress.trim() || undefined)
                            setNewSellingName(''); setNewSellingAddress(''); setShowAddSelling(false)
                          }
                        }} disabled={!newSellingName.trim()}
                          className="px-4 py-2 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40">
                          Add
                        </button>
                        <button onClick={() => { setShowAddSelling(false); setNewSellingName(''); setNewSellingAddress('') }}
                          className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-500 rounded-lg">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {sellingProps.length > 0 ? (
                    <div className="space-y-2">
                      {sellingProps.map(sp => (
                        <SellingPropertyCard
                          key={sp.id}
                          property={sp}
                          onUpdate={updateSelling}
                          onDelete={removeSelling}
                          links={allLinks.filter(l => l.selling_property_id === sp.id)}
                          buyProperties={properties.map(p => ({ id: p.id, name: p.name, address: p.address ?? '' }))}
                          onCreateLink={createLink}
                          onRemoveLink={removeLink}
                        />
                      ))}
                    </div>
                  ) : !showAddSelling && (
                    <p className="text-xs text-gray-400 py-2">No properties being sold — add one to track 1031 exchange proceeds</p>
                  )}
                </div>

                {/* ── R&D section ── */}
                <div className="mb-6">
                  <h2 className="text-[11px] tracking-[0.15em] uppercase text-gray-400 font-semibold mb-3 flex items-center gap-2">
                    <Building2 size={13} /> Research & Development
                  </h2>
                  {research.length === 0 && properties.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Building2 size={40} className="text-gray-200 mb-4" />
                      <h3 className="text-base font-light text-gray-500">No properties</h3>
                      <p className="text-xs text-gray-400 mt-1">Add your first deal to get started</p>
                    </div>
                  ) : research.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4">All properties are in active deals</p>
                  ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {research.map((p, i) => (
                <div key={p.id}
                  draggable
                  onDragStart={() => { dragIdx.current = i }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(i) }}
                  onDragEnd={() => { setDragOverIdx(null) }}
                  onDrop={() => {
                    if (dragIdx.current !== null && dragIdx.current !== i) {
                      const reordered = [...properties]
                      const [moved] = reordered.splice(dragIdx.current, 1)
                      reordered.splice(i, 0, moved)
                      reorderProperties(reordered)
                    }
                    dragIdx.current = null
                    setDragOverIdx(null)
                  }}
                  className={`bg-white border rounded-sm hover:border-[#c9a84c] transition-colors group
                    ${dragOverIdx === i ? 'border-[#c9a84c] shadow-md' : 'border-gray-200'}`}>
                  <div className="flex items-center">
                    <div className="flex items-center justify-center px-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400"
                      onMouseDown={e => e.stopPropagation()}>
                      <GripVertical size={16} />
                    </div>
                    <Link to={`/property/${p.id}`}
                      className="flex items-center gap-4 px-3 py-3.5 flex-1 min-w-0">
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); photoTargetId.current = p.id; photoInputRef.current?.click() }}
                        className="w-12 h-12 bg-[#f8f7f4] border border-gray-200 rounded-sm flex items-center justify-center flex-shrink-0 overflow-hidden hover:border-[#c9a84c] transition-colors group/photo relative"
                        title="Click to add/change photo">
                        {uploadingPhotoId === p.id ? (
                          <Loader2 size={16} className="animate-spin text-gray-400" />
                        ) : p.property_image_url ? (
                          <>
                            <img src={p.property_image_url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/30 transition-colors flex items-center justify-center">
                              <Camera size={14} className="text-white opacity-0 group-hover/photo:opacity-100 transition-opacity" />
                            </div>
                          </>
                        ) : (
                          <Camera size={16} className="text-gray-300 group-hover/photo:text-[#c9a84c] transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                        {p.address && <div className="text-xs text-gray-400 mt-0.5 truncate">{p.address}</div>}
                        <div className="text-[11px] text-gray-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{p.units ? `${p.units} units` : ''}{p.units && p.year_built ? ' · ' : ''}{p.year_built ? `Built ${p.year_built}` : ''}</span>
                          {p.created_at && (
                            <span className="text-[9px] text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full">
                              Imported {new Date(p.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
                            </span>
                          )}
                          {p.status && p.status !== 'research' && (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border
                              ${p.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                p.status === 'active' ? 'bg-green-50 text-green-600 border-green-200' :
                                'bg-blue-50 text-blue-600 border-blue-200'}`}>
                              {p.status === 'pending' ? 'Pending' : p.status === 'active' ? 'Active' : 'Closed'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="bg-gray-50 border border-gray-200 text-gray-400 text-[10px] px-2.5 py-1 rounded-sm">
                          {(p.scenarios?.length ?? 0)} scenario{(p.scenarios?.length ?? 0) !== 1 ? 's' : ''}
                        </span>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-[#c9a84c] transition-colors" />
                      </div>
                    </Link>
                  </div>
                  <div className="border-t border-gray-100 flex">
                    <button onClick={() => deleteProperty(p.id)}
                      className="flex items-center gap-1 px-3 py-2 text-[10px] text-gray-400 hover:text-red-400 transition-colors">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
                  )}
                </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
