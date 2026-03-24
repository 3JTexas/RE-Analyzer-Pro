import { Link, useLocation, Outlet } from 'react-router-dom'
import { Building2, BarChart3, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function AppShell() {
  const { user, signOut } = useAuth()
  const loc = useLocation()

  const nav = [
    { to: '/',           icon: Building2, label: 'Properties' },
    { to: '/demo',       icon: BarChart3, label: 'Quick Model' },
  ]

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-3xl mx-auto relative shadow-xl">

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-navy text-white flex-shrink-0">
        <div>
          <div className="text-sm font-bold tracking-tight">Deal Analyzer</div>
          <div className="text-[10px] text-blue-300">Multifamily underwriting</div>
        </div>
        {user && (
          <button onClick={signOut} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <LogOut size={16} />
          </button>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="flex border-t border-gray-200 bg-white flex-shrink-0 pb-safe">
        {nav.map(({ to, icon: Icon, label }) => {
          const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to))
          return (
            <Link key={to} to={to}
              className={`flex-1 flex flex-col items-center py-2.5 text-[10px] font-medium transition-colors
                ${active ? 'text-navy' : 'text-gray-400 hover:text-gray-600'}`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className="mb-0.5" />
              {label}
            </Link>
          )
        })}
      </nav>

    </div>
  )
}
