import { useState, useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calculate } from '../lib/calc'
import type { ModelInputs, ModelOutputs, Scenario } from '../types'

export interface DealContext {
  property: {
    name: string
    address: string | null
    units: number | null
    yearBuilt: number | null
    status: string
  } | null
  scenario: {
    name: string
    inputs: ModelInputs
  } | null
  outputs: ModelOutputs | null
  pipeline: {
    milestones: any[]
    keyDates: any
    loiTracking: any
    psaTracking: any
  } | null
}

/** Reads deal data from the current route for the chat assistant */
export function useDealContext(): { dealContext: DealContext | null; loading: boolean } {
  const location = useLocation()
  const params = useParams<{ id: string }>()
  const [dealContext, setDealContext] = useState<DealContext | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const path = location.pathname

    // Match /scenario/:id
    const scenarioMatch = path.match(/^\/scenario\/([^/]+)/)
    // Match /property/:id or /property/:id/pipeline
    const propertyMatch = path.match(/^\/property\/([^/]+)/)

    if (scenarioMatch) {
      loadFromScenario(scenarioMatch[1])
    } else if (propertyMatch) {
      loadFromProperty(propertyMatch[1])
    } else {
      setDealContext(null)
    }
  }, [location.pathname])

  async function loadFromScenario(scenarioId: string) {
    setLoading(true)
    try {
      // Load scenario
      const { data: scenario } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single()
      if (!scenario) { setDealContext(null); return }

      const s = scenario as Scenario
      const outputs = calculate(s.inputs, s.is_default)

      // Load property
      const { data: prop } = await supabase
        .from('properties')
        .select('name, address, units, year_built, status')
        .eq('id', s.property_id)
        .single()

      // Load pipeline
      const { data: pipe } = await supabase
        .from('deal_pipelines')
        .select('milestones, key_dates, loi_tracking, psa_tracking')
        .eq('property_id', s.property_id)
        .single()

      setDealContext({
        property: prop ? {
          name: prop.name,
          address: prop.address,
          units: prop.units,
          yearBuilt: prop.year_built,
          status: prop.status,
        } : null,
        scenario: { name: s.name, inputs: s.inputs },
        outputs,
        pipeline: pipe ? {
          milestones: pipe.milestones ?? [],
          keyDates: pipe.key_dates ?? null,
          loiTracking: pipe.loi_tracking ?? null,
          psaTracking: pipe.psa_tracking ?? null,
        } : null,
      })
    } catch (e) {
      console.error('useDealContext error:', e)
      setDealContext(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadFromProperty(propertyId: string) {
    setLoading(true)
    try {
      // Load property
      const { data: prop } = await supabase
        .from('properties')
        .select('name, address, units, year_built, status')
        .eq('id', propertyId)
        .single()
      if (!prop) { setDealContext(null); return }

      // Load deal scenario (default or first)
      const { data: scenarios } = await supabase
        .from('scenarios')
        .select('*')
        .eq('property_id', propertyId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)

      const s = scenarios?.[0] as Scenario | undefined
      const outputs = s ? calculate(s.inputs, s.is_default) : null

      // Load pipeline
      const { data: pipe } = await supabase
        .from('deal_pipelines')
        .select('milestones, key_dates, loi_tracking, psa_tracking')
        .eq('property_id', propertyId)
        .single()

      setDealContext({
        property: {
          name: prop.name,
          address: prop.address,
          units: prop.units,
          yearBuilt: prop.year_built,
          status: prop.status,
        },
        scenario: s ? { name: s.name, inputs: s.inputs } : null,
        outputs,
        pipeline: pipe ? {
          milestones: pipe.milestones ?? [],
          keyDates: pipe.key_dates ?? null,
          loiTracking: pipe.loi_tracking ?? null,
          psaTracking: pipe.psa_tracking ?? null,
        } : null,
      })
    } catch (e) {
      console.error('useDealContext error:', e)
      setDealContext(null)
    } finally {
      setLoading(false)
    }
  }

  return { dealContext, loading }
}
