import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, BarChart3, Trash2, Copy, Camera, Loader2, ExternalLink, Pencil, Check, X, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getScenariosForProperty, useScenario } from '../hooks/useScenario'
import { useUserDefaults } from '../hooks/useUserDefaults'
import type { Property, Scenario, ModelInputs } from '../types'
import { Spinner, EmptyState } from '../components/ui'
import { SetupFlow } from '../components/OMSetupFlow'
import type { SetupConfirmMeta } from '../components/OMSetupFlow'

export function PropertyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { createScenario, deleteScenario } = useScenario()
  const { loadDefaults } = useUserDefaults()
  const [property, setProperty] = useState<Property | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [duplicating, setDuplicating] = useState<Scenario | null>(null)
  const [dupName, setDupName] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [editingCrexi, setEditingCrexi] = useState(false)
  const [crexiDraft, setCrexiDraft] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    if (!id) return
    const [{ data: prop }, scens] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).single(),
      getScenariosForProperty(id),
    ])
    setProperty(prop as Property)
    setScenarios(scens)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  const handleCreate = async (inputs: ModelInputs, meta: SetupConfirmMeta) => {
    if (!id) return
    setShowSetup(false)
    const s = await createScenario(id, meta.scenarioName, inputs, true)
    if (s) { await loadData(); navigate(`/scenario/${s.id}`) }
  }

  const handleDelete = async (sid: string) => {
    if (!window.confirm('Delete this scenario?')) return
    await deleteScenario(sid)
    setScenarios(prev => prev.filter(s => s.id !== sid))
  }

  const handleRename = async (sid: string) => {
    const trimmed = renameDraft.trim()
    if (!trimmed) { setRenamingId(null); return }
    await supabase.from('scenarios').update({ name: trimmed, updated_at: new Date().toISOString() }).eq('id', sid)
    setScenarios(prev => prev.map(s => s.id === sid ? { ...s, name: trimmed } : s))
    setRenamingId(null)
  }

  const startDuplicate = (s: Scenario) => {
    setDuplicating(s)
    setDupName(`${s.name} (copy)`)
  }

  const handleDuplicate = async () => {
    if (!id || !duplicating || !dupName.trim()) return
    // Merge user defaults (tax strategy fields) into duplicated inputs
    const defaults = await loadDefaults()
    const mergedInputs: ModelInputs = { ...duplicating.inputs }
    // Only apply defaults for fields that are 0/unset in the source scenario
    for (const [k, v] of Object.entries(defaults)) {
      if (v !== undefined && v !== 0 && ((mergedInputs as any)[k] === 0 || (mergedInputs as any)[k] === undefined)) {
        (mergedInputs as any)[k] = v
      }
    }
    const s = await createScenario(id, dupName.trim(), mergedInputs)
    setDuplicating(null)
    setDupName('')
    if (s) { await loadData(); navigate(`/scenario/${s.id}`) }
  }

  const handlePhotoUpload = async (file: File) => {
    if (!id) return
    setPhotoUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${id}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('property-images').upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data } = supabase.storage.from('property-images').getPublicUrl(path)
      await supabase.from('properties').update({ property_image_url: data.publicUrl }).eq('id', id)
      setProperty(prev => prev ? { ...prev, property_image_url: data.publicUrl } : prev)
    } catch (e: any) {
      console.error('Photo upload failed:', e.message)
    }
    setPhotoUploading(false)
  }

  const saveCrexiUrl = async (url: string) => {
    if (!id) return
    const trimmed = url.trim() || null
    await supabase.from('properties').update({ crexi_url: trimmed }).eq('id', id)
    setProperty(prev => prev ? { ...prev, crexi_url: trimmed } as Property : prev)
    setEditingCrexi(false)
  }

  const updateStatus = async (status: 'research' | 'pending' | 'active' | 'closed') => {
    if (!id) return
    await supabase.from('properties').update({ status }).eq('id', id)
    setProperty(prev => prev ? { ...prev, status } : prev)
  }

  const status = property?.status ?? 'research'
  const statusConfig = {
    research: { label: 'Research', color: 'bg-gray-100 text-gray-600 border-gray-200' },
    pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    active: { label: 'Active', color: 'bg-green-50 text-green-700 border-green-200' },
    closed: { label: 'Closed', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
        <Link to="/" className="flex items-center gap-0.5 -ml-1 text-gray-400 hover:text-[#1a1a2e] transition-colors">
          <ChevronLeft size={20} />
          <span className="text-xs">Properties</span>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">{property?.name}</h1>
          {property?.address && <p className="text-xs text-gray-400 truncate">{property.address}</p>}
          <div className="flex items-center gap-2 mt-1">
            {editingCrexi ? (
              <div className="flex items-center gap-1">
                <input
                  value={crexiDraft}
                  onChange={e => setCrexiDraft(e.target.value)}
                  placeholder="https://www.crexi.com/properties/..."
                  className="text-[11px] border border-gray-300 rounded px-2 py-1 w-56 focus:outline-none focus:border-[#c9a84c] bg-white text-gray-700"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveCrexiUrl(crexiDraft) }}
                />
                <button onClick={() => saveCrexiUrl(crexiDraft)} className="p-0.5 text-green-500 hover:text-green-700">
                  <Check size={13} />
                </button>
                <button onClick={() => setEditingCrexi(false)} className="p-0.5 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              </div>
            ) : property?.crexi_url ? (
              <div className="flex items-center gap-1.5">
                <a href={property?.crexi_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-medium text-[#c9a84c] border border-[#c9a84c] rounded px-2 py-0.5 hover:bg-[#c9a84c] hover:text-white transition-colors">
                  <ExternalLink size={10} /> View on Crexi
                </a>
                <button onClick={() => { setCrexiDraft(property?.crexi_url ?? ''); setEditingCrexi(true) }}
                  className="p-0.5 text-gray-300 hover:text-gray-500">
                  <Pencil size={10} />
                </button>
              </div>
            ) : (
              <button onClick={() => { setCrexiDraft(''); setEditingCrexi(true) }}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#c9a84c] transition-colors">
                <Pencil size={10} /> Add Crexi link
              </button>
            )}
          </div>
        </div>
        {/* Status dropdown + Track Deal */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={status}
            onChange={e => updateStatus(e.target.value as typeof status)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border appearance-none cursor-pointer focus:outline-none
              ${statusConfig[status].color}`}
          >
            <option value="research">Research</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          {(status === 'pending' || status === 'active' || status === 'closed') && (
            <Link to={`/property/${id}/pipeline`}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#c9a84c] text-white rounded-sm hover:bg-[#b8963f] transition-colors whitespace-nowrap">
              Track Deal <ArrowRight size={12} />
            </Link>
          )}
        </div>
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
        <button onClick={() => photoRef.current?.click()}
          disabled={photoUploading}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-sm hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors">
          {photoUploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
          {photoUploading ? 'Uploading...' : 'Photo'}
        </button>
        <button onClick={() => setShowSetup(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1a1a2e] text-white rounded-sm hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors">
          <Plus size={13} /> Scenario
        </button>
      </div>

      {showSetup && (
        <div className="flex-1 overflow-y-auto">
          <SetupFlow
            onConfirm={handleCreate}
            onCancel={() => setShowSetup(false)}
            defaultScenarioName="As-Presented"
          />
        </div>
      )}

      {duplicating && (
        <div className="mx-4 mt-3 p-3 bg-white border border-gray-200 rounded-sm">
          <p className="text-xs font-medium text-gray-800 mb-1">Duplicating <span className="font-semibold">"{duplicating.name}"</span></p>
          <p className="text-[10px] text-gray-400 mb-2">All inputs copied — adjust as needed after creating</p>
          <input value={dupName} onChange={e => setDupName(e.target.value)} placeholder="Name for duplicate"
            className="w-full text-sm border border-gray-300 rounded-sm px-3 py-2 mb-3 focus:outline-none focus:border-[#c9a84c] bg-white text-gray-800" />
          <div className="flex gap-2">
            <button onClick={handleDuplicate} className="flex-1 bg-[#1a1a2e] text-white text-xs font-medium py-2 rounded-sm hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors">Duplicate</button>
            <button onClick={() => setDuplicating(null)} className="flex-1 bg-white border border-gray-200 text-gray-500 text-xs font-medium py-2 rounded-sm">Cancel</button>
          </div>
        </div>
      )}

      {!showSetup && !duplicating && (
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-3 max-w-5xl mx-auto w-full">
          {scenarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BarChart3 size={40} className="text-gray-200 mb-4" />
              <h3 className="text-base font-light text-gray-500">No scenarios yet</h3>
              <p className="text-xs text-gray-400 mt-1">Import broker data or enter figures manually to start underwriting</p>
              <button onClick={() => setShowSetup(true)}
                className="flex items-center gap-2 mt-6 px-5 py-2 text-xs font-medium border border-[#c9a84c] text-[#c9a84c] rounded-sm hover:bg-[#c9a84c] hover:text-white transition-colors">
                <Plus size={14} /> Add scenario
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scenarios.map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-sm hover:border-[#c9a84c] transition-colors overflow-hidden group">
                  <Link to={`/scenario/${s.id}`}
                    className="flex items-center px-4 py-3.5">
                    <div className={`w-9 h-9 rounded-sm flex items-center justify-center mr-3 flex-shrink-0 border border-gray-200
                      ${s.is_default ? 'bg-blue-50' : 'bg-amber-50'}`}>
                      <BarChart3 size={18} className={s.is_default ? 'text-blue-600' : 'text-amber-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {renamingId === s.id ? (
                        <div className="flex items-center gap-1.5" onClick={e => e.preventDefault()}>
                          <input value={renameDraft} onChange={e => setRenameDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRename(s.id); if (e.key === 'Escape') setRenamingId(null) }}
                            autoFocus
                            className="text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-0.5 focus:border-[#c9a84c] focus:outline-none flex-1 min-w-0" />
                          <button onClick={(e) => { e.preventDefault(); handleRename(s.id) }} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                          <button onClick={(e) => { e.preventDefault(); setRenamingId(null) }} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-gray-900 truncate">{s.name}</div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {s.is_default ? 'Broker figures' : 'Scenario'} · {new Date(s.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                  <div className="border-t border-gray-100 flex">
                    <button onClick={() => { setRenamingId(s.id); setRenameDraft(s.name) }}
                      className="flex items-center gap-1 px-3 py-2 text-[10px] text-gray-400 hover:text-[#c9a84c] transition-colors">
                      <Pencil size={11} /> Rename
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button onClick={() => startDuplicate(s)}
                      className="flex items-center gap-1 px-3 py-2 text-[10px] text-gray-400 hover:text-[#c9a84c] transition-colors">
                      <Copy size={11} /> Duplicate
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button onClick={() => handleDelete(s.id)}
                      className="flex items-center gap-1 px-3 py-2 text-[10px] text-gray-400 hover:text-red-400 transition-colors">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
