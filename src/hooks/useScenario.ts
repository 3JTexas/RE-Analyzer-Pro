import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Property, Scenario, ModelInputs } from '../types'

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('properties')
      .select('*, scenarios(id, name, method, is_default, created_at, updated_at)')
      .order('created_at', { ascending: false })
    setProperties((data as Property[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const createProperty = async (name: string, address?: string, yearBuilt?: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('properties')
      .insert({ name, address, user_id: user.id, ...(yearBuilt ? { year_built: yearBuilt } : {}) })
      .select()
      .single()
    if (!error) await fetch()
    return data as Property | null
  }

  const deleteProperty = async (id: string) => {
    await supabase.from('properties').delete().eq('id', id)
    await fetch()
  }

  return { properties, loading, createProperty, deleteProperty, refresh: fetch }
}

export function useScenario(scenarioId?: string) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [loading, setLoading] = useState(!!scenarioId)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!scenarioId) return
    setLoading(true)
    supabase.from('scenarios').select('*').eq('id', scenarioId).single()
      .then(({ data }) => {
        setScenario(data as Scenario)
        setLoading(false)
      })
  }, [scenarioId])

  const save = useCallback(async (
    name: string,
    method: 'om' | 'physical',
    inputs: ModelInputs,
    propertyId?: string
  ) => {
    setSaving(true)
    try {
      if (scenario?.id) {
        const { data } = await supabase
          .from('scenarios')
          .update({ name, method, inputs, updated_at: new Date().toISOString() })
          .eq('id', scenario.id)
          .select().single()
        setScenario(data as Scenario)
      } else if (propertyId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null
        const { data } = await supabase
          .from('scenarios')
          .insert({ name, method, inputs, property_id: propertyId, user_id: user.id })
          .select().single()
        setScenario(data as Scenario)
        return data as Scenario
      }
    } finally {
      setSaving(false)
    }
    return scenario
  }, [scenario])

  const createScenario = async (
    propertyId: string,
    name: string,
    method: 'om' | 'physical',
    inputs: ModelInputs,
    isDefault: boolean = false
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('scenarios')
      .insert({ name, method, inputs, property_id: propertyId, user_id: user.id, is_default: isDefault })
      .select().single()
    return data as Scenario
  }

  const deleteScenario = async (id: string) => {
    await supabase.from('scenarios').delete().eq('id', id)
  }

  return { scenario, loading, saving, save, createScenario, deleteScenario }
}

export async function getScenariosForProperty(propertyId: string): Promise<Scenario[]> {
  const { data } = await supabase
    .from('scenarios')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true })
  return (data as Scenario[]) ?? []
}
