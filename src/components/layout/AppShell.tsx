import { Link, useLocation, Outlet } from 'react-router-dom'
import { Building2, BarChart3, LogOut, Home } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function AppShell() {
  const { user, signOut } = useAuth()
  const loc = useLocation()

  const nav = [
    { to: '/',           icon: Building2, label: 'Properties' },
    { to: '/demo',       icon: BarChart3, label: 'Quick Model' },
  ]

  const logoSrc = `${import.meta.env.BASE_URL}Chai_Logo.jpeg`
  const bldgSrc = `${import.meta.env.BASE_URL}BLDG%20Background.jpeg`

  return (
    <div className="flex flex-col h-screen bg-[#f8f7f4] w-full max-w-3xl mx-auto relative shadow-xl overflow-x-hidden">

      {/* Fixed building photo watermark */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: `url(${bldgSrc})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
          opacity: 0.07,
          filter: 'grayscale(100%)',
        }}
      />

      {/* Top nav — md+ */}
      <header className="hidden md:flex items-center justify-between bg-white border-b border-gray-200 h-14 px-6 flex-shrink-0 relative z-10 min-w-0">
        <div className="flex items-center min-w-0">
          <Link to="/">
            <img src={logoSrc} alt="Chai Holdings" className="h-7 w-auto" />
          </Link>
          <div className="w-px h-5 border-l border-gray-200 mx-4" />
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400">RE Analyzer Pro</span>
        </div>
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="p-1.5 text-gray-400 hover:text-[#c9a84c] transition-colors" title="Dashboard">
            <Home size={16} />
          </Link>
          {user && (
            <>
              <span className="text-[11px] text-gray-400 truncate max-w-[160px]">{user.email}</span>
              <button onClick={signOut} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors" title="Sign out">
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="flex md:hidden items-center justify-between bg-white border-b border-gray-200 h-12 px-4 flex-shrink-0 relative z-10 min-w-0">
        <Link to="/">
          <img src={logoSrc} alt="Chai Holdings" className="h-5 w-auto" />
        </Link>
        <span className="text-[9px] font-medium tracking-[0.12em] uppercase text-gray-400">RE Analyzer Pro</span>
        {user && (
          <button onClick={signOut} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors">
            <LogOut size={14} />
          </button>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-hidden relative z-[1] min-w-0">
        <Outlet />
      </main>

      {/* Bottom nav — mobile */}
      <nav className="flex md:hidden border-t border-gray-200 bg-white flex-shrink-0 pb-safe relative z-10">
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
    </div>
  )
}
