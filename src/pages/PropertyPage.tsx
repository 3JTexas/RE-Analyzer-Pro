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
      const { error } = await supabase.storage.from('property-images').upload(path, file, { upsert: true })
      if (error) throw error
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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Link to="/" className="p-1 -ml-1 text-gray-400 hover:text-gray-700">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">{property?.name}</h1>
          {property?.address && <p className="text-xs text-gray-400 truncate">{property.address}</p>}
        </div>
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
        <button onClick={() => photoRef.current?.click()}
          disabled={photoUploading}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-500">
          {photoUploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
          {photoUploading ? 'Uploading…' : 'Photo'}
        </button>
        <button onClick={() => setShowSetup(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-lg">
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
        <div className="mx-4 mt-3 p-3 border border-blue-200 rounded-xl bg-blue-50 shadow-sm">
          <p className="text-xs font-medium text-blue-700 mb-1">Duplicating <span className="font-semibold">"{duplicating.name}"</span></p>
          <p className="text-[10px] text-blue-500 mb-2">All inputs copied — adjust as needed after creating</p>
          <input value={dupName} onChange={e => setDupName(e.target.value)} placeholder="Name for duplicate"
            className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-blue-400 bg-white" />
          <div className="flex gap-2">
            <button onClick={handleDuplicate} className="flex-1 bg-blue-600 text-white text-xs font-medium py-2 rounded-lg">Duplicate</button>
            <button onClick={() => setDuplicating(null)} className="flex-1 bg-gray-100 text-gray-600 text-xs font-medium py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {!showSetup && !duplicating && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {scenarios.length === 0 ? (
            <EmptyState
              icon={<BarChart3 size={48} />}
              title="No scenarios yet"
              description="Import or enter the OM to start underwriting"
              action={
                <button onClick={() => setShowSetup(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-medium rounded-xl">
                  <Plus size={16} /> Add OM data
                </button>
              }
            />
          ) : (
            <div className="space-y-2">
              {scenarios.map(s => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <Link to={`/scenario/${s.id}`}
                    className="flex items-center px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 flex-shrink-0
                      ${s.method === 'om' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                      <BarChart3 size={18} className={s.method === 'om' ? 'text-blue-700' : 'text-amber-700'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{s.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {s.method === 'om' ? 'OM method' : 'Physical occupancy'} · {new Date(s.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                  <div className="border-t border-gray-50 flex">
                    <button onClick={() => startDuplicate(s)}
                      className="flex items-center gap-1 px-3 py-2 text-[10px] text-blue-500 hover:bg-blue-50 transition-colors">
                      <Copy size={11} /> Duplicate
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button onClick={() => handleDelete(s.id)}
                      className="flex items-center gap-1 px-3 py-2 text-[10px] text-red-400 hover:bg-red-50 transition-colors">
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
