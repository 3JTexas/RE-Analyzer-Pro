import { supabase } from '../lib/supabase'
import type { ModelInputs } from '../types'

export function useUserDefaults() {
  const loadDefaults = async (): Promise<Partial<ModelInputs>> => {
    const { data } = await supabase
      .from('user_defaults')
      .select('defaults')
      .single()
    return (data?.defaults as Partial<ModelInputs>) ?? {}
  }

  const saveDefaults = async (defaults: Partial<ModelInputs>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('user_defaults')
      .upsert({ user_id: user.id, defaults }, { onConflict: 'user_id' })
    return { error: error?.message ?? null }
  }

  return { loadDefaults, saveDefaults }
}
