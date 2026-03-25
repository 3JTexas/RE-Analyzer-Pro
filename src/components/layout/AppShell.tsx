import { Link, useLocation, Outlet } from 'react-router-dom'
import { Building2, BarChart3, LogOut, Home } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const SKYLINE_SVG = `<svg viewBox="0 0 1400 600" xmlns="http://www.w3.org/2000/svg" fill="#1a1a2e">
  <rect x="50" y="280" width="90" height="320"/><rect x="55" y="290" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="75" y="290" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="95" y="290" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="115" y="290" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="55" y="314" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="75" y="314" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="95" y="314" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="115" y="314" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="55" y="338" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="75" y="338" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="95" y="338" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="115" y="338" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="55" y="362" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="75" y="362" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="95" y="362" width="10" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="115" y="362" width="10" height="14" fill="#f8f7f4" opacity="0.5"/>
  <rect x="180" y="180" width="110" height="420"/><rect x="188" y="190" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="210" y="190" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="232" y="190" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="254" y="190" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="188" y="218" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="210" y="218" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="232" y="218" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="254" y="218" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="188" y="246" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="210" y="246" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="232" y="246" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="254" y="246" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="188" y="274" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="210" y="274" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="232" y="274" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="254" y="274" width="12" height="16" fill="#f8f7f4" opacity="0.5"/>
  <rect x="340" y="340" width="80" height="260"/><rect x="348" y="350" width="9" height="12" fill="#f8f7f4" opacity="0.5"/><rect x="364" y="350" width="9" height="12" fill="#f8f7f4" opacity="0.5"/><rect x="380" y="350" width="9" height="12" fill="#f8f7f4" opacity="0.5"/><rect x="396" y="350" width="9" height="12" fill="#f8f7f4" opacity="0.5"/><rect x="348" y="372" width="9" height="12" fill="#f8f7f4" opacity="0.5"/><rect x="364" y="372" width="9" height="12" fill="#f8f7f4" opacity="0.5"/><rect x="380" y="372" width="9" height="12" fill="#f8f7f4" opacity="0.5"/><rect x="396" y="372" width="9" height="12" fill="#f8f7f4" opacity="0.5"/>
  <rect x="470" y="100" width="140" height="500"/><rect x="480" y="112" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="504" y="112" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="528" y="112" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="552" y="112" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="576" y="112" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="480" y="142" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="504" y="142" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="528" y="142" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="552" y="142" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="576" y="142" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="480" y="172" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="504" y="172" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="528" y="172" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="552" y="172" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="576" y="172" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="480" y="202" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="504" y="202" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="528" y="202" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="552" y="202" width="14" height="18" fill="#f8f7f4" opacity="0.5"/><rect x="576" y="202" width="14" height="18" fill="#f8f7f4" opacity="0.5"/>
  <rect x="660" y="220" width="100" height="380"/><rect x="668" y="230" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="688" y="230" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="708" y="230" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="728" y="230" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="668" y="256" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="688" y="256" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="708" y="256" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="728" y="256" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="668" y="282" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="688" y="282" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="708" y="282" width="11" height="14" fill="#f8f7f4" opacity="0.5"/><rect x="728" y="282" width="11" height="14" fill="#f8f7f4" opacity="0.5"/>
  <rect x="810" y="160" width="120" height="440"/><rect x="820" y="172" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="844" y="172" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="868" y="172" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="892" y="172" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="820" y="200" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="844" y="200" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="868" y="200" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="892" y="200" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="820" y="228" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="844" y="228" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="868" y="228" width="12" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="892" y="228" width="12" height="16" fill="#f8f7f4" opacity="0.5"/>
  <rect x="980" y="300" width="90" height="300"/><rect x="988" y="310" width="10" height="13" fill="#f8f7f4" opacity="0.5"/><rect x="1006" y="310" width="10" height="13" fill="#f8f7f4" opacity="0.5"/><rect x="1024" y="310" width="10" height="13" fill="#f8f7f4" opacity="0.5"/><rect x="1042" y="310" width="10" height="13" fill="#f8f7f4" opacity="0.5"/><rect x="988" y="333" width="10" height="13" fill="#f8f7f4" opacity="0.5"/><rect x="1006" y="333" width="10" height="13" fill="#f8f7f4" opacity="0.5"/><rect x="1024" y="333" width="10" height="13" fill="#f8f7f4" opacity="0.5"/><rect x="1042" y="333" width="10" height="13" fill="#f8f7f4" opacity="0.5"/>
  <rect x="1120" y="240" width="130" height="360"/><rect x="1130" y="252" width="13" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="1154" y="252" width="13" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="1178" y="252" width="13" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="1202" y="252" width="13" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="1226" y="252" width="13" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="1130" y="280" width="13" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="1154" y="280" width="13" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="1178" y="280" width="13" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="1202" y="280" width="13" height="16" fill="#f8f7f4" opacity="0.5"/><rect x="1226" y="280" width="13" height="16" fill="#f8f7f4" opacity="0.5"/>
</svg>`

export function AppShell() {
  const { user, signOut } = useAuth()
  const loc = useLocation()

  const nav = [
    { to: '/',           icon: Building2, label: 'Properties' },
    { to: '/demo',       icon: BarChart3, label: 'Quick Model' },
  ]

  const logoSrc = `${import.meta.env.BASE_URL}Chai_Logo.jpeg`

  return (
    <div className="flex flex-col h-screen bg-[#f8f7f4] max-w-3xl mx-auto relative shadow-xl">

      {/* Fixed architectural watermark */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          opacity: 0.06,
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(SKYLINE_SVG)}")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center bottom',
          backgroundSize: 'cover',
        }}
      />

      {/* Top nav — md+ */}
      <header className="hidden md:flex items-center justify-between bg-white border-b border-gray-200 h-14 px-6 flex-shrink-0 relative z-10">
        <div className="flex items-center">
          <Link to="/">
            <img src={logoSrc} alt="Chai Holdings" className="h-7 w-auto" />
          </Link>
          <div className="w-px h-5 border-l border-gray-200 mx-4" />
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-gray-400">RE Analyzer Pro</span>
        </div>
        <div className="flex items-center gap-4">
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
      <header className="flex md:hidden items-center justify-between bg-white border-b border-gray-200 h-12 px-4 flex-shrink-0 relative z-10">
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
      <main className="flex-1 overflow-hidden relative z-[1]">
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
