import { useAuth } from './useAuth'

const ADMIN_EMAILS = new Set([
  'andrew@chaiholdings.com',
])

export function useIsAdmin(): boolean {
  const { user } = useAuth()
  if (!user?.email) return false
  return ADMIN_EMAILS.has(user.email.toLowerCase())
}
