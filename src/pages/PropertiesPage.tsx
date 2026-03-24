import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, Trash2, ChevronRight } from 'lucide-react'
import { useProperties, useScenario } from '../hooks/useScenario'
import { Spinner, EmptyState } from '../components/ui'
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
    // Create property first
    const prop = await createProperty(
      meta.propertyName || 'New Property',
      meta.propertyAddress || undefined,
      meta.propertyYearBuilt || undefined,
      meta.propertyImageUrl || undefined
    )
    if (!prop) return
    // Then create OM scenario
    const scenario = await createScenario(prop.id, meta.scenarioName, 'om', inputs, true)
    if (scenario) navigate(`/scenario/${scenario.id}`)
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h1 className="text-sm font-semibold text-gray-900">Properties</h1>
        <button onClick={() => setShowSetup(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-lg">
          <Plus size={13} /> New property
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
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {properties.length === 0 ? (
            <EmptyState
              icon={<Building2 size={48} />}
              title="No properties yet"
              description="Add a property to start analyzing deals"
              action={
                <button onClick={() => setShowSetup(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-medium rounded-xl">
                  <Plus size={16} /> Add first property
                </button>
              }
            />
          ) : (
            <div className="space-y-2">
              {properties.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <Link to={`/property/${p.id}`}
                    className="flex items-center px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 bg-navy/10 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                      <Building2 size={18} className="text-navy" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                      {p.address && <div className="text-xs text-gray-400 truncate">{p.address}</div>}
                      <div className="text-[10px] text-gray-300 mt-0.5">
                        {(p.scenarios?.length ?? 0)} scenario{(p.scenarios?.length ?? 0) !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                  </Link>
                  <div className="border-t border-gray-50 flex">
                    <button onClick={() => deleteProperty(p.id)}
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
