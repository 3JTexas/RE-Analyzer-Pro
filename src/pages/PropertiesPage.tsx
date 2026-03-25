import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, Trash2, ChevronRight } from 'lucide-react'
import { useProperties, useScenario } from '../hooks/useScenario'
import { Spinner } from '../components/ui'
import { OmSetupFlow } from '../components/OMSetupFlow'
import type { ModelInputs } from '../types'
import type { OmConfirmMeta } from '../components/OMSetupFlow'

export function PropertiesPage() {
  const { properties, loading, createProperty, deleteProperty } = useProperties()
  const { createScenario } = useScenario()
  const navigate = useNavigate()
  const [showSetup, setShowSetup] = useState(false)

  const handleConfirm = async (inputs: ModelInputs, meta: OmConfirmMeta) => {
    setShowSetup(false)
    const prop = await createProperty(
      meta.propertyName || 'New Property',
      meta.propertyAddress || undefined,
      meta.propertyYearBuilt || undefined,
      meta.propertyImageUrl || undefined
    )
    if (!prop) return
    const scenario = await createScenario(prop.id, meta.scenarioName, 'om', inputs, true)
    if (scenario) navigate(`/scenario/${scenario.id}`)
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] sticky top-0 bg-[#0d1117] z-10">
        <div>
          <h1 className="text-[11px] tracking-[0.2em] uppercase text-[#8b949e] font-medium">Properties</h1>
          <p className="text-xs text-[#484f58] mt-0.5">{properties.length} active deal{properties.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowSetup(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium tracking-wide border border-[#c9a84c] text-[#c9a84c] rounded-sm bg-transparent hover:bg-[#c9a84c] hover:text-[#0d1117] transition-colors">
          <Plus size={13} /> New Property
        </button>
      </div>

      {showSetup && (
        <div className="flex-1 overflow-y-auto">
          <OmSetupFlow
            showPropertyFields
            onConfirm={handleConfirm}
            onCancel={() => setShowSetup(false)}
          />
        </div>
      )}

      {!showSetup && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 max-w-3xl mx-auto w-full">
          {properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Building2 size={40} className="text-[#30363d] mb-4" />
              <h3 className="text-base font-light text-[#484f58]">No properties</h3>
              <p className="text-xs text-[#484f58] mt-1">Add your first deal to get started</p>
              <button onClick={() => setShowSetup(true)}
                className="flex items-center gap-2 mt-6 px-5 py-2 text-xs font-medium tracking-wide border border-[#c9a84c] text-[#c9a84c] rounded-sm hover:bg-[#c9a84c] hover:text-[#0d1117] transition-colors">
                <Plus size={14} /> New Property
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {properties.map(p => (
                <div key={p.id} className="bg-[#161b22] border border-[#30363d] rounded-sm hover:border-[#c9a84c]/50 transition-colors">
                  <Link to={`/property/${p.id}`}
                    className="flex items-center gap-4 px-4 py-3.5">
                    <div className="w-11 h-11 bg-[#0d1117] border border-[#30363d] rounded-sm flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-[#484f58]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#e6edf3] truncate">{p.name}</div>
                      {p.address && <div className="text-[11px] text-[#8b949e] mt-0.5 truncate">{p.address}</div>}
                      <div className="text-[10px] text-[#484f58] mt-0.5">
                        {p.units ? `${p.units} units` : ''}{p.units && p.year_built ? ' · ' : ''}{p.year_built ? `Built ${p.year_built}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="bg-[#0d1117] border border-[#30363d] text-[#8b949e] text-[10px] tracking-wide px-2 py-0.5 rounded-sm">
                        {(p.scenarios?.length ?? 0)} scenario{(p.scenarios?.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                      <ChevronRight size={14} className="text-[#484f58]" />
                    </div>
                  </Link>
                  <div className="border-t border-[#30363d] flex">
                    <button onClick={() => deleteProperty(p.id)}
                      className="flex items-center gap-1 px-3 py-2 text-[10px] text-[#8b949e] hover:text-red-400 hover:bg-red-400/5 transition-colors">
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
