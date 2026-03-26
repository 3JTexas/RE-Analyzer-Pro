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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <div>
          <h1 className="text-[11px] tracking-[0.2em] uppercase text-gray-400 font-medium">Properties</h1>
          <p className="text-xs text-gray-400 mt-0.5">{properties.length} active deal{properties.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowSetup(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium tracking-wide border border-[#c9a84c] text-[#c9a84c] rounded-sm bg-transparent hover:bg-[#c9a84c] hover:text-white transition-colors">
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
        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-6 max-w-3xl mx-auto w-full">
          {properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Building2 size={40} className="text-gray-200 mb-4" />
              <h3 className="text-base font-light text-gray-500">No properties</h3>
              <p className="text-xs text-gray-400 mt-1">Add your first deal to get started</p>
              <button onClick={() => setShowSetup(true)}
                className="flex items-center gap-2 mt-6 px-5 py-2 text-xs font-medium tracking-wide border border-[#c9a84c] text-[#c9a84c] rounded-sm hover:bg-[#c9a84c] hover:text-white transition-colors">
                <Plus size={14} /> New Property
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.map(p => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-sm hover:border-[#c9a84c] transition-colors group">
                  <Link to={`/property/${p.id}`}
                    className="flex items-center gap-4 px-4 py-3.5">
                    <div className="w-12 h-12 bg-[#f8f7f4] border border-gray-200 rounded-sm flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-gray-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                      {p.address && <div className="text-xs text-gray-400 mt-0.5 truncate">{p.address}</div>}
                      <div className="text-[11px] text-gray-300 mt-0.5">
                        {p.units ? `${p.units} units` : ''}{p.units && p.year_built ? ' · ' : ''}{p.year_built ? `Built ${p.year_built}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="bg-gray-50 border border-gray-200 text-gray-400 text-[10px] px-2.5 py-1 rounded-sm">
                        {(p.scenarios?.length ?? 0)} scenario{(p.scenarios?.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#c9a84c] transition-colors" />
                    </div>
                  </Link>
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
      )}
    </div>
  )
}
