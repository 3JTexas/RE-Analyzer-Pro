import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { SellingProperty, Exchange1031Link } from '../types/selling'

export function useSellingProperties() {
  const [properties, setProperties] = useState<SellingProperty[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('selling_properties')
      .select('*')
      .order('created_at', { ascending: false })
    setProperties((data as SellingProperty[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (name: string, address?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('selling_properties')
      .insert({ user_id: user.id, name, address: address || null })
      .select()
      .single()
    if (error) { console.error('Create selling property failed:', error); return null }
    await fetch()
    return data as SellingProperty
  }

  const update = async (id: string, updates: Partial<SellingProperty>) => {
    const { error } = await supabase
      .from('selling_properties')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) console.error('Update selling property failed:', error)
    await fetch()
  }

  const remove = async (id: string) => {
    // Delete 1031 links first
    await supabase.from('exchange_1031_links').delete().eq('selling_property_id', id)
    await supabase.from('selling_properties').delete().eq('id', id)
    await fetch()
  }

  return { properties, loading, create, update, remove, refresh: fetch }
}

// Hook for 1031 exchange links
// If propertyId is provided, filters by that property. Otherwise returns all user's links.
export function use1031Links(propertyId?: string, direction: 'buying' | 'selling' = 'buying') {
  const [links, setLinks] = useState<Exchange1031Link[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    let query = supabase.from('exchange_1031_links').select('*')
    if (propertyId) {
      const col = direction === 'buying' ? 'buying_property_id' : 'selling_property_id'
      query = query.eq(col, propertyId)
    }
    const { data } = await query
    setLinks((data as Exchange1031Link[]) ?? [])
    setLoading(false)
  }, [propertyId, direction])

  useEffect(() => { fetch() }, [fetch])

  const createLink = async (sellingPropertyId: string, buyingPropertyId: string, allocatedAmount: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('exchange_1031_links').insert({
      selling_property_id: sellingPropertyId,
      buying_property_id: buyingPropertyId,
      user_id: user.id,
      allocated_amount: allocatedAmount,
    })
    await fetch()
  }

  const updateLink = async (linkId: string, updates: { allocated_amount?: number; notes?: string }) => {
    await supabase.from('exchange_1031_links').update(updates).eq('id', linkId)
    await fetch()
  }

  const removeLink = async (linkId: string) => {
    await supabase.from('exchange_1031_links').delete().eq('id', linkId)
    await fetch()
  }

  return { links, loading, createLink, updateLink, removeLink, refresh: fetch }
}

// Fetch selling property details for linked properties (used on buy side)
export async function getLinkedSellingProperties(buyingPropertyId: string): Promise<(Exchange1031Link & { selling_property: SellingProperty })[]> {
  const { data } = await supabase
    .from('exchange_1031_links')
    .select('*, selling_property:selling_properties(*)')
    .eq('buying_property_id', buyingPropertyId)
  return (data ?? []) as any
}
