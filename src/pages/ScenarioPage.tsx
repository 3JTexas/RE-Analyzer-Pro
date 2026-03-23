import { useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useScenario } from '../hooks/useScenario'
import { getScenariosForProperty } from '../hooks/useScenario'
import { ModelCalculator } from '../components/model/ModelCalculator'
import { Spinner } from '../components/ui'
import type { ModelInputs, Method, Scenario } from '../types'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface PropertyMeta {
  name: string
  address: string
  units: number
  year_built: number
}

export function ScenarioPage() {
  const { id } = useParams<{ id: string }>()
  const { scenario, loading, saving, save } = useScenario(id)
  const [siblings, setSiblings] = useState<Scenario[]>([])
  const [omScenario, setOmScenario] = useState<Scenario | null>(null)
  const [property, setProperty] = useState<PropertyMeta | null>(null)

  useEffect(() => {
    if (scenario?.property_id) {
      // Load sibling scenarios
      getScenariosForProperty(scenario.property_id).then(all => {
        setSiblings(all)
        const om = all.find(s => s.is_default)
        if (om) setOmScenario(om)
      })

      // Load property metadata for PDF export
      supabase
        .from('properties')
        .select('name, address, units, year_built')
        .eq('id', scenario.property_id)
        .single()
        .then(({ data }) => {
          if (data) setProperty(data as PropertyMeta)
        })
    }
  }, [scenario?.property_id])

  const handleSave = async (name: string, method: Method, inputs: ModelInputs) => {
    await save(name, method, inputs)
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 flex-shrink-0">
        <Link
          to={scenario ? `/property/${scenario.property_id}` : '/'}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-700">
          <ChevronLeft size={20} />
        </Link>
        <span className="text-xs text-gray-400">
          {scenario ? 'Edit scenario' : 'Scenario not found'}
        </span>
      </div>

      {scenario && (
        <div className="flex-1 overflow-hidden">
          <ModelCalculator
            initialInputs={scenario.inputs}
            initialMethod={scenario.method}
            scenarioName={scenario.name}
            onSave={handleSave}
            saving={saving}
            siblings={siblings}
            currentScenarioId={scenario.id}
            omScenario={omScenario}
            propertyName={property?.name ?? ''}
            propertyAddress={property?.address ?? ''}
            propertyUnits={property?.units ?? 0}
            propertyYearBuilt={property?.year_built ?? 0}
          />
        </div>
      )}
    </div>
  )
}
