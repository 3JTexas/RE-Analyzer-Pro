import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
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
    <div className="flex flex-col items-center justify-center h-screen bg-navy px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Deal Analyzer</h1>
          <p className="text-blue-300 text-sm mt-1">Multifamily investment underwriting</p>
        </div>
        {signedUp ? (
          <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-4 text-green-200 text-sm text-center">
            Account created! Check your email for a confirmation link, then come back to log in.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email" required placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/10 text-white placeholder-blue-300 rounded-xl px-4 py-3 text-sm
                border border-white/10 focus:outline-none focus:border-white/30" />
            <input
              type="password" required placeholder="Password" minLength={6}
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/10 text-white placeholder-blue-300 rounded-xl px-4 py-3 text-sm
                border border-white/10 focus:outline-none focus:border-white/30" />
            {error && <p className="text-red-400 text-xs px-1">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-brand-orange text-white font-semibold py-3 rounded-xl text-sm
                hover:bg-orange-600 disabled:opacity-60 transition-colors">
              {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
            <button type="button" onClick={() => setMode(m => m === 'login' ? 'signup' : 'login')}
              className="w-full text-blue-300 text-xs py-2 hover:text-white transition-colors">
              {mode === 'login' ? 'No account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}