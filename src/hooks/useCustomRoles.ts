import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface CustomRole {
  id: string
  label: string
}

export function useCustomRoles() {
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('user_defaults').select('defaults').single().then(({ data }) => {
      const roles = (data?.defaults as any)?.customDealTeamRoles ?? []
      setCustomRoles(roles)
      setLoaded(true)
    })
  }, [])

  const persist = useCallback(async (roles: CustomRole[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Read current defaults, merge custom roles in
    const { data } = await supabase.from('user_defaults').select('defaults').single()
    const current = (data?.defaults as any) ?? {}
    await supabase.from('user_defaults').upsert({
      user_id: user.id,
      defaults: { ...current, customDealTeamRoles: roles },
    }, { onConflict: 'user_id' })
  }, [])

  const addRole = useCallback(async (label: string) => {
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!id || customRoles.some(r => r.id === id)) return null
    const role: CustomRole = { id, label: label.trim() }
    const updated = [...customRoles, role]
    setCustomRoles(updated)
    await persist(updated)
    return role
  }, [customRoles, persist])

  const removeRole = useCallback(async (id: string) => {
    const updated = customRoles.filter(r => r.id !== id)
    setCustomRoles(updated)
    await persist(updated)
  }, [customRoles, persist])

  return { customRoles, loaded, addRole, removeRole }
}
