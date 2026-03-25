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
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 relative"
      style={{
        backgroundColor: '#0d1117',
        backgroundImage: 'linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {/* Branding */}
      <div className="flex flex-col items-center mb-10">
        <div className="bg-white rounded px-3 py-2">
          <img src={logoSrc} alt="Chai Holdings" className="h-10 w-auto" style={{ maxWidth: 160 }} />
        </div>
        <div className="text-[11px] tracking-[0.3em] uppercase font-medium text-[#c9a84c] mt-2">RE Analyzer Pro</div>
        <div className="w-16 h-px bg-[#c9a84c] opacity-40 mx-auto mt-3" />
      </div>

      {/* Login card */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-sm p-8 w-full max-w-[360px]">
        {signedUp ? (
          <div className="bg-green-500/10 border border-green-400/20 rounded-sm p-4 text-green-300 text-sm text-center">
            Account created! Check your email for a confirmation link, then come back to log in.
          </div>
        ) : (
          <>
            <h2 className="text-lg font-light text-[#e6edf3] mb-1">Welcome back</h2>
            <p className="text-xs text-[#8b949e] mb-6">Sign in to continue</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-[#8b949e] mb-1.5">Email</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] placeholder-[#484f58] text-sm px-3 py-2.5 rounded-sm focus:border-[#c9a84c] focus:ring-0 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-[#8b949e] mb-1.5">Password</label>
                <input
                  type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] placeholder-[#484f58] text-sm px-3 py-2.5 rounded-sm focus:border-[#c9a84c] focus:ring-0 focus:outline-none transition" />
              </div>
              {error && <p className="text-red-400 text-xs px-1">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-[#c9a84c] text-[#0d1117] font-semibold text-sm py-2.5 rounded-sm hover:bg-[#d4b86a] disabled:opacity-60 transition active:scale-[0.99]">
                {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <button type="button" onClick={() => setMode(m => m === 'login' ? 'signup' : 'login')}
              className="w-full text-xs text-[#484f58] hover:text-[#8b949e] py-3 transition-colors text-center">
              {mode === 'login' ? 'No account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-[10px] text-[#484f58]">Chai Holdings 2025</div>
    </div>
  )
}
