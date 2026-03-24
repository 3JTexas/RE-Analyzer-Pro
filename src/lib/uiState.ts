import { supabase } from './supabase'

export interface CompareState {
  a: string | null
  b: string | null
  c: string | null
  d: string | null
}

const EMPTY: CompareState = { a: null, b: null, c: null, d: null }

export async function loadCompareState(propertyId: string): Promise<CompareState> {
  const { data, error } = await supabase
    .from('properties')
    .select('compare_state')
    .eq('id', propertyId)
    .single()
  if (error || !data?.compare_state) return EMPTY
  return { ...EMPTY, ...data.compare_state }
}

export async function saveCompareState(propertyId: string, state: CompareState): Promise<void> {
  await supabase
    .from('properties')
    .update({ compare_state: state })
    .eq('id', propertyId)
}
