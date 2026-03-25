import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, BarChart3, Trash2, Copy, Camera, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getScenariosForProperty, useScenario } from '../hooks/useScenario'
import type { Property, Scenario, ModelInputs } from '../types'
import { Spinner, EmptyState } from '../components/ui'
import { OmSetupFlow } from '../components/OMSetupFlow'
import type { OmConfirmMeta } from '../components/OMSetupFlow'

export function PropertyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { createScenario, deleteScenario } = useScenario()
  const [property, setProperty] = useState<Property | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [duplicating, setDuplicating] = useState<Scenario | null>(null)
  const [dupName, setDupName] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
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

  const handleCreate = async (inputs: ModelInputs, meta: OmConfirmMeta) => {
    if (!id) return
    setShowSetup(false)
    const s = await createScenario(id, meta.scenarioName, 'om', inputs, true)
    if (s) { await loadData(); navigate(`/scenario/${s.id}`) }
  }

  const handleDelete = async (sid: string) => {
    if (!window.confirm('Delete this scenario?')) return
    await deleteScenario(sid)
    setScenarios(prev => prev.filter(s => s.id !== sid))
  }

  const startDuplicate = (s: Scenario) => {
    setDuplicating(s)
    setDupName(`${s.name} (copy)`)
  }

  const handleDuplicate = async () => {
    if (!id || !duplicating || !dupName.trim()) return
    const s = await createScenario(id, dupName.trim(), duplicating.method, duplicating.inputs)
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
      setProperty(prev => prev ? { ...prev, property_image_url: data.publicUrl } as any : prev)
    } catch (e: any) {
      console.error('Photo upload failed:', e.message)
    }
    setPhotoUploading(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363d] bg-[#0d1117]">
        <Link to="/" className="p-1 -ml-1 text-[#8b949e] hover:text-[#c9a84c] transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium text-[#e6edf3] truncate">{property?.name}</h1>
          {property?.address && <p className="text-xs text-[#8b949e] truncate">{property.address}</p>}
        </div>
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
        <button onClick={() => photoRef.current?.click()}
          disabled={photoUploading}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-[#8b949e] border border-[#30363d] rounded-sm bg-transparent hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors">
          {photoUploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
          {photoUploading ? 'Uploading...' : 'Photo'}
        </button>
        <button onClick={() => setShowSetup(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#c9a84c] text-[#c9a84c] rounded-sm hover:bg-[#c9a84c] hover:text-[#0d1117] transition-colors">
          <Plus size={13} /> Scenario
        </button>
      </div>

      {showSetup && (
        <div className="flex-1 overflow-y-auto">
          <OmSetupFlow
            onConfirm={handleCreate}
            onCancel={() => setShowSetup(false)}
            defaultScenarioName="OM As-Presented"
          />
        </div>
      )}

      {duplicating && (
        <div className="mx-4 mt-3 p-3 border border-[#30363d] rounded-sm bg-[#161b22]">
          <p className="text-xs font-medium text-[#e6edf3] mb-1">Duplicating <span className="font-semibold">"{duplicating.name}"</span></p>
          <p className="text-[10px] text-[#8b949e] mb-2">All inputs copied — adjust as needed after creating</p>
          <input value={dupName} onChange={e => setDupName(e.target.value)} placeholder="Name for duplicate"
            className="w-full text-sm border border-[#30363d] rounded-sm px-3 py-2 mb-3 focus:outline-none focus:border-[#c9a84c] bg-[#0d1117] text-[#e6edf3]" />
          <div className="flex gap-2">
            <button onClick={handleDuplicate} className="flex-1 bg-[#c9a84c] text-[#0d1117] text-xs font-medium py-2 rounded-sm">Duplicate</button>
            <button onClick={() => setDuplicating(null)} className="flex-1 bg-[#0d1117] border border-[#30363d] text-[#8b949e] text-xs font-medium py-2 rounded-sm">Cancel</button>
          </div>
        </div>
      )}

      {!showSetup && !duplicating && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {scenarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BarChart3 size={40} className="text-[#30363d] mb-4" />
              <h3 className="text-base font-light text-[#484f58]">No scenarios yet</h3>
              <p className="text-xs text-[#484f58] mt-1">Import or enter the OM to start underwriting</p>
              <button onClick={() => setShowSetup(true)}
                className="flex items-center gap-2 mt-6 px-5 py-2 text-xs font-medium border border-[#c9a84c] text-[#c9a84c] rounded-sm hover:bg-[#c9a84c] hover:text-[#0d1117] transition-colors">
                <Plus size={14} /> Add OM data
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {scenarios.map(s => (
                <div key={s.id} className="bg-[#161b22] border border-[#30363d] rounded-sm hover:border-[#c9a84c]/50 transition-colors overflow-hidden">
                  <Link to={`/scenario/${s.id}`}
                    className="flex items-center px-4 py-3.5">
                    <div className={`w-9 h-9 rounded-sm flex items-center justify-center mr-3 flex-shrink-0 border
                      ${s.method === 'om' ? 'bg-[#0d1117] border-[#30363d]' : 'bg-[#0d1117] border-[#30363d]'}`}>
                      <BarChart3 size={18} className={s.method === 'om' ? 'text-[#c9a84c]' : 'text-[#8b949e]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#e6edf3] truncate">{s.name}</div>
                      <div className="text-[10px] text-[#8b949e] mt-0.5">
                        {s.method === 'om' ? 'OM method' : 'Physical occupancy'} · {new Date(s.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                  <div className="border-t border-[#30363d] flex">
                    <button onClick={() => startDuplicate(s)}
                      className="flex items-center gap-1 px-3 py-2 text-[10px] text-[#8b949e] hover:text-[#c9a84c] transition-colors">
                      <Copy size={11} /> Duplicate
                    </button>
                    <div className="w-px bg-[#30363d]" />
                    <button onClick={() => handleDelete(s.id)}
                      className="flex items-center gap-1 px-3 py-2 text-[10px] text-[#8b949e] hover:text-red-400 transition-colors">
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
