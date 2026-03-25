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

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] max-w-3xl mx-auto relative shadow-xl">

      {/* Top nav bar — hidden on mobile, visible md+ */}
      <header className="hidden md:flex items-center justify-between bg-[#0d1117] border-b border-[#30363d] h-14 px-6 flex-shrink-0">
        <div className="flex items-center">
          <Link to="/">
            <div className="bg-white rounded-sm px-2 py-1">
              <img src={logoSrc} alt="Chai Holdings" className="h-7 w-auto" />
            </div>
          </Link>
          <div className="w-px h-6 bg-[#30363d] mx-4" />
          <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#8b949e]">RE Analyzer Pro</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 text-[#8b949e] hover:text-[#c9a84c] transition-colors" title="Dashboard">
            <Home size={16} />
          </Link>
          <div className="w-px h-4 bg-[#30363d]" />
          {user && (
            <>
              <span className="text-[11px] text-[#8b949e] truncate max-w-[160px]">{user.email}</span>
              <button onClick={signOut} className="p-1.5 text-[#8b949e] hover:text-red-400 transition-colors" title="Sign out">
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile top bar — visible below md */}
      <header className="flex md:hidden items-center justify-between bg-[#0d1117] border-b border-[#30363d] h-12 px-4 flex-shrink-0">
        <Link to="/">
          <div className="bg-white rounded-sm px-1.5 py-0.5">
            <img src={logoSrc} alt="Chai Holdings" className="h-5 w-auto" />
          </div>
        </Link>
        <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#8b949e]">RE Analyzer Pro</span>
        {user && (
          <button onClick={signOut} className="p-1.5 text-[#8b949e] hover:text-red-400 transition-colors">
            <LogOut size={14} />
          </button>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="flex md:hidden border-t border-[#30363d] bg-[#161b22] flex-shrink-0 pb-safe">
        {nav.map(({ to, icon: Icon, label }) => {
          const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to))
          return (
            <Link key={to} to={to}
              className={`flex-1 flex flex-col items-center py-2.5 text-[10px] font-medium transition-colors
                ${active ? 'text-[#c9a84c]' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className="mb-0.5" />
              {label}
            </Link>
          )
        })}
      </nav>

    </div>
  )
}
