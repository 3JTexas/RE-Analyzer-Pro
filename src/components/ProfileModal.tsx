import { useState } from 'react'
import { X, LogOut, KeyRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface Props {
  onClose: () => void
}

export function ProfileModal({ onClose }: Props) {
  const { user, signOut, resetPassword } = useAuth()
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const [sending, setSending] = useState(false)

  if (!user) return null

  const email = user.email ?? ''
  const initials = getInitials(email)
  const createdAt = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const handleResetPassword = async () => {
    setSending(true)
    setResetError('')
    const { error } = await resetPassword(email)
    if (error) setResetError(error.message)
    else setResetSent(true)
    setSending(false)
  }

  const handleSignOut = () => {
    onClose()
    signOut()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24" onClick={onClose}>
      <div className="bg-white w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Account</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Profile info */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-[#1a1a2e] flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-semibold text-white">{initials}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{email}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Member since {createdAt}</div>
            </div>
          </div>

          {/* Password reset */}
          <div className="mb-4">
            <label className="block text-[9px] uppercase tracking-wide text-gray-400 font-medium mb-2">Password</label>
            {resetSent ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-xs text-center">
                Reset link sent to {email}
              </div>
            ) : (
              <button onClick={handleResetPassword} disabled={sending}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors disabled:opacity-50">
                <KeyRound size={14} />
                {sending ? 'Sending...' : 'Send password reset email'}
              </button>
            )}
            {resetError && <p className="text-red-500 text-[11px] mt-1.5">{resetError}</p>}
          </div>
        </div>

        {/* Sign out */}
        <div className="px-5 py-3 border-t border-gray-100">
          <button onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export function getInitials(email: string): string {
  const local = email.split('@')[0] ?? ''
  // Try to split on . or _ for first/last name
  const parts = local.split(/[._]/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}
