import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signedUp, setSignedUp] = useState(false)

  const logoSrc = `${import.meta.env.BASE_URL}Chai_Logo.jpeg`

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    if (mode === 'login') {
      const { error: err } = await signIn(email, password)
      if (err) { setError(err.message); setLoading(false) }
      else { navigate('/', { replace: true }) }
    } else {
      const { error: err } = await signUp(email, password)
      if (err) { setError(err.message); setLoading(false) }
      else setSignedUp(true)
    }
    setLoading(false)
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
        {signedUp ? (
          <div className="bg-green-50 border border-green-200 rounded-sm p-4 text-green-700 text-sm text-center">
            Account created! Check your email for a confirmation link, then come back to log in.
          </div>
        ) : (
          <>
            <h2 className="text-xl font-light text-gray-800 mb-1">Sign in</h2>
            <p className="text-[11px] text-gray-400 mb-7">Chai Holdings &middot; RE Analyzer Pro</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">Email</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-white border border-gray-300 text-sm text-gray-800 px-3 py-2.5 rounded-sm focus:border-[#c9a84c] focus:ring-0 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">Password</label>
                <input
                  type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-white border border-gray-300 text-sm text-gray-800 px-3 py-2.5 rounded-sm focus:border-[#c9a84c] focus:ring-0 focus:outline-none transition" />
              </div>
              {error && <p className="text-red-500 text-xs px-1">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-[#1a1a2e] text-white text-sm font-medium py-3 rounded-sm hover:bg-[#c9a84c] hover:text-[#1a1a2e] disabled:opacity-60 transition mt-2">
                {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <button type="button" onClick={() => setMode(m => m === 'login' ? 'signup' : 'login')}
              className="w-full text-xs text-gray-400 py-3 hover:text-gray-600 transition-colors text-center mt-1">
              {mode === 'login' ? 'No account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </>
        )}
      </div>

      <div className="fixed bottom-5 text-center text-[10px] text-gray-300 w-full">Chai Holdings 2025</div>
    </div>
  )
}
