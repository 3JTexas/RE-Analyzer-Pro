import { useState, useRef, useCallback } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { Building2, BarChart3, Home, User, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { ProfileModal, getInitials } from '../ProfileModal'
import { SettingsModal } from '../SettingsModal'

function AvatarMenu({ size, textSize, onProfile, onSettings, onSignOut }: {
  size: string; textSize: string; onProfile: () => void; onSettings: () => void; onSignOut: () => void
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
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
            <button onClick={() => { setOpen(false); onProfile() }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
              <User size={14} className="text-gray-400" /> Profile
            </button>
            <button onClick={() => { setOpen(false); onSettings() }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
              <Settings size={14} className="text-gray-400" /> Settings
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { setOpen(false); onSignOut() }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-colors">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const loc = useLocation()
  const [showProfile, setShowProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const nav = [
    { to: '/',           icon: Building2, label: 'Properties' },
    { to: '/demo',       icon: BarChart3, label: 'Quick Model' },
  ]

  const logoSrc = `${import.meta.env.BASE_URL}Chai_Logo.jpeg`
  const bldgSrc = `${import.meta.env.BASE_URL}BLDG%20Background.jpeg`

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden', backgroundColor: '#f8f7f4', display: 'flex', flexDirection: 'column' }}>

      {/* Full-bleed building backdrop — first child, paints immediately */}
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
          opacity: 0.5,
          filter: 'grayscale(100%)',
        }}
      />

      {/* Top nav — md+ */}
      <header className="hidden md:flex items-center justify-between bg-white border-b border-gray-200 h-20 px-6 min-w-0" style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <div className="flex items-center min-w-0">
          <Link to="/">
            <img src={logoSrc} alt="Chai Holdings" className="h-14 w-auto" />
          </Link>
          <div className="w-px h-5 border-l border-gray-200 mx-4" />
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400">RE Analyzer Pro</span>
        </div>
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="p-1.5 text-gray-400 hover:text-[#c9a84c] transition-colors" title="Dashboard">
            <Home size={16} />
          </Link>
          {user && (
            <AvatarMenu size="w-9 h-9" textSize="text-xs" onProfile={() => setShowProfile(true)} onSettings={() => setShowSettings(true)} onSignOut={signOut} />
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
          <AvatarMenu size="w-8 h-8" textSize="text-[10px]" onProfile={() => setShowProfile(true)} onSettings={() => setShowSettings(true)} onSignOut={signOut} />
        )}
      </header>

      {/* Scrollable content area — fills remaining height */}
      <main style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, backgroundColor: 'transparent' }}>
        <Outlet />
      </main>

      {/* Bottom nav — mobile */}
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
    </div>
  )
}
