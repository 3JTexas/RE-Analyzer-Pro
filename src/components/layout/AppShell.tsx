import { useState, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { Building2, BarChart3, Home, User, LogOut, Settings, Lightbulb, ClipboardList, GitCompare } from 'lucide-react'
import { ChatBubble } from '../chat/ChatBubble'
import { DevChatPanel } from '../chat/DevChatPanel'
import { useAuth } from '../../hooks/useAuth'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { ProfileModal, getInitials } from '../ProfileModal'
import { SettingsModal } from '../SettingsModal'
import { FeatureSuggestionModal } from '../FeatureSuggestionModal'

function AvatarMenu({ size, textSize, onProfile, onSettings, onSuggestFeature, onSignOut }: {
  size: string; textSize: string; onProfile: () => void; onSettings: () => void; onSuggestFeature: () => void; onSignOut: () => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 1000)
  }, [])
  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }, [])
  if (!user) return null
  return (
    <div className="relative" onMouseLeave={startClose} onMouseEnter={cancelClose}>
      <button onClick={() => setOpen(v => !v)}
        className={`${size} rounded-full bg-[#1a1a2e] flex items-center justify-center hover:bg-[#c9a84c] transition-colors`}
        title="Account">
        <span className={`${textSize} font-semibold text-white`}>{getInitials(user.email ?? '')}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
          <button onClick={() => { setOpen(false); onProfile() }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
            <User size={14} className="text-gray-400" /> Profile
          </button>
          <button onClick={() => { setOpen(false); onSettings() }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
            <Settings size={14} className="text-gray-400" /> Settings
          </button>
          <button onClick={() => { setOpen(false); onSuggestFeature() }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-[#c9a84c] hover:bg-[#c9a84c]/5 transition-colors">
            <Lightbulb size={14} /> Suggest a Feature
          </button>
          <Link to="/admin/features" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
            <ClipboardList size={14} className="text-gray-400" /> Feature Requests
          </Link>
          <div className="border-t border-gray-100 my-1" />
          <button onClick={() => { setOpen(false); onSignOut() }}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const isAdmin = useIsAdmin()
  const loc = useLocation()
  const navigate = useNavigate()

  const goHome = () => {
    if (loc.pathname === '/') {
      // Already on Properties — full reload to close any open setup flows / overlays
      window.location.href = '/'
    } else {
      navigate('/')
    }
  }
  const [showProfile, setShowProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showFeatureSuggestion, setShowFeatureSuggestion] = useState(false)

  const nav = [
    { to: '/',           icon: Building2,  label: 'Properties' },
    { to: '/compare',    icon: GitCompare, label: 'Compare' },
    { to: '/demo',       icon: BarChart3,  label: 'Quick Model' },
  ]

  const logoSrc = `${import.meta.env.BASE_URL}Chai_Logo.jpeg`
  const bldgSrc = `${import.meta.env.BASE_URL}BLDG%20Background.jpeg`

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden', backgroundColor: '#f8f7f4', display: 'flex', flexDirection: 'column' }}>

      {/* Full-bleed building backdrop */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: `url(${bldgSrc})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
          opacity: 0.08,
          filter: 'grayscale(100%)',
        }}
      />

      {/* Desktop header */}
      <header className="hidden md:flex items-center justify-between bg-white/95 backdrop-blur-sm border-b border-gray-100 h-16 px-10" style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <div className="flex items-center min-w-0">
          <Link to="/">
            <img src={logoSrc} alt="Chai Holdings" className="h-10 w-auto" />
          </Link>
          <div className="w-px h-5 border-l border-gray-200 mx-4" />
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400">RE Analyzer Pro</span>
          {/* Desktop nav links */}
          <nav className="flex items-center gap-1 ml-8">
            {nav.map(({ to, icon: Icon, label }) => {
              const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to))
              return (
                <Link key={to} to={to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${active ? 'bg-[#c9a84c]/10 text-[#c9a84c]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                  <Icon size={14} strokeWidth={active ? 2.5 : 1.5} />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={goHome} className="p-1.5 text-gray-400 hover:text-[#c9a84c] transition-colors" title="Home">
            <Home size={16} />
          </button>
          {user && (
            <AvatarMenu size="w-9 h-9" textSize="text-xs" onProfile={() => setShowProfile(true)} onSettings={() => setShowSettings(true)} onSuggestFeature={() => setShowFeatureSuggestion(true)} onSignOut={signOut} />
          )}
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="flex md:hidden items-center justify-between bg-white border-b border-gray-200 h-14 px-4 min-w-0" style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <Link to="/">
          <img src={logoSrc} alt="Chai Holdings" className="h-10 w-auto" />
        </Link>
        <span className="text-[9px] font-medium tracking-[0.12em] uppercase text-gray-400">RE Analyzer Pro</span>
        {user && (
          <AvatarMenu size="w-8 h-8" textSize="text-[10px]" onProfile={() => setShowProfile(true)} onSettings={() => setShowSettings(true)} onSuggestFeature={() => setShowFeatureSuggestion(true)} onSignOut={signOut} />
        )}
      </header>

      {/* Scrollable content area */}
      <main style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, backgroundColor: 'transparent' }}>
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="flex md:hidden border-t border-gray-200 bg-white pb-safe" style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
        {nav.map(({ to, icon: Icon, label }) => {
          const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to))
          return (
            <Link key={to} to={to}
              className={`flex-1 flex flex-col items-center py-2.5 text-[10px] font-medium transition-colors
                ${active ? 'text-[#c9a84c]' : 'text-gray-400 hover:text-gray-600'}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className="mb-0.5" />
              {label}
            </Link>
          )
        })}
      </nav>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showFeatureSuggestion && <FeatureSuggestionModal onClose={() => setShowFeatureSuggestion(false)} />}
      <ChatBubble />
      {isAdmin && <DevChatPanel />}
    </div>
  )
}
