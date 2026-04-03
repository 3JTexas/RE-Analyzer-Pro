import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  const logoSrc = `${import.meta.env.BASE_URL}Chai_Logo.jpeg`

  useEffect(() => {
    // Supabase auto-detects the token from the URL hash on auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/', { replace: true }), 2000)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f7f4] px-6 relative">
      {/* Branding */}
      <div className="flex flex-col items-center mb-8">
        <img src={logoSrc} alt="Chai Holdings" className="h-10 w-auto" style={{ maxWidth: 140 }} />
        <div className="text-[10px] tracking-[0.28em] uppercase font-medium text-gray-500 mt-3">RE Analyzer Pro</div>
        <div className="w-10 h-[2px] bg-[#c9a84c] mx-auto mt-3" />
      </div>

      {/* Card */}
      <div className="bg-white border border-gray-200 rounded-sm p-8 w-full max-w-[400px]">
        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-sm p-4 text-green-700 text-sm text-center">
            Password updated! Redirecting&hellip;
          </div>
        ) : !sessionReady ? (
          <p className="text-sm text-gray-500 text-center">Verifying reset link&hellip;</p>
        ) : (
          <>
            <h2 className="text-xl font-light text-gray-800 mb-1">Set new password</h2>
            <p className="text-[11px] text-gray-400 mb-7">Enter your new password below</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">New password</label>
                <input
                  type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-white border border-gray-300 text-sm text-gray-800 px-3 py-2.5 rounded-sm focus:border-[#c9a84c] focus:ring-0 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">Confirm password</label>
                <input
                  type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-white border border-gray-300 text-sm text-gray-800 px-3 py-2.5 rounded-sm focus:border-[#c9a84c] focus:ring-0 focus:outline-none transition" />
              </div>
              {error && <p className="text-red-500 text-xs px-1">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-[#1a1a2e] text-white text-sm font-medium py-3 rounded-sm hover:bg-[#c9a84c] hover:text-[#1a1a2e] disabled:opacity-60 transition mt-2">
                {loading ? '...' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="fixed bottom-5 text-center text-[10px] text-gray-300 w-full">Chai Holdings 2026</div>
    </div>
  )
}
