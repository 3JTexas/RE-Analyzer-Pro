import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { Building2, BarChart3, Home } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { ProfileModal, getInitials } from '../ProfileModal'

export function AppShell() {
  const { user } = useAuth()
  const loc = useLocation()
  const [showProfile, setShowProfile] = useState(false)

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
            <button onClick={() => setShowProfile(true)}
              className="w-9 h-9 rounded-full bg-[#1a1a2e] flex items-center justify-center hover:bg-[#c9a84c] transition-colors"
              title="Account">
              <span className="text-xs font-semibold text-white">{getInitials(user.email ?? '')}</span>
            </button>
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
          <button onClick={() => setShowProfile(true)}
            className="w-8 h-8 rounded-full bg-[#1a1a2e] flex items-center justify-center hover:bg-[#c9a84c] transition-colors"
            title="Account">
            <span className="text-[10px] font-semibold text-white">{getInitials(user.email ?? '')}</span>
          </button>
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
    </div>
  )
}
