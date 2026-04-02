import { useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useScenario } from '../hooks/useScenario'
import { getScenariosForProperty } from '../hooks/useScenario'
import { ModelCalculator } from '../components/model/ModelCalculator'
import { Spinner } from '../components/ui'
import type { ModelInputs, Scenario } from '../types'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface PropertyMeta {
  name: string
  address: string
  units: number
  year_built: number
  property_image_url: string | null
}

export function ScenarioPage() {
  const { id } = useParams<{ id: string }>()
  const { scenario, loading, saving, save } = useScenario(id)
  const [siblings, setSiblings] = useState<Scenario[]>([])
  const [brokerScenario, setBrokerScenario] = useState<Scenario | null>(null)
  const [property, setProperty] = useState<PropertyMeta | null>(null)

  useEffect(() => {
    if (scenario?.property_id) {
      getScenariosForProperty(scenario.property_id).then(all => {
        setSiblings(all)
        const broker = all.find(s => s.is_default)
        if (broker) setBrokerScenario(broker)
      })

      supabase
        .from('properties')
        .select('name, address, units, year_built, property_image_url')
        .eq('id', scenario.property_id)
        .single()
        .then(({ data }) => {
          if (data) setProperty(data as PropertyMeta)
        })
    }
  }, [scenario?.property_id])

  const handleSave = async (name: string, inputs: ModelInputs) => {
    await save(name, inputs)
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <Link
          to={scenario ? `/property/${scenario.property_id}` : '/'}
          className="flex items-center gap-0.5 -ml-1 text-gray-400 hover:text-[#1a1a2e] transition-colors">
          <ChevronLeft size={20} />
          <span className="text-xs">Scenarios</span>
        </Link>
      </div>

      {scenario && (
        <div className="flex-1 overflow-hidden">
          <ModelCalculator
            initialInputs={scenario.inputs}
            scenarioName={scenario.name}
            onSave={handleSave}
            saving={saving}
            siblings={siblings}
            currentScenarioId={scenario.id}
            brokerScenario={brokerScenario}
            propertyName={property?.name ?? ''}
            propertyAddress={property?.address ?? ''}
            propertyUnits={property?.units ?? 0}
            propertyYearBuilt={property?.year_built ?? 0}
            propertyId={scenario.property_id}
            propertyImageUrl={property?.property_image_url ?? undefined}
          />
        </div>
      )}
    </div>
  )
}
