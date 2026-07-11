import type { Route } from './+types/app-shell'
import {
  IconBox,
  IconFileText,
  IconLayoutDashboard,
  IconSettings,
} from '@tabler/icons-react'
import { data, NavLink, Outlet, redirect, useLocation } from 'react-router'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = new URL(request.url)
    return redirect(`/login?next=${encodeURIComponent(url.pathname)}`, { headers })
  }

  return data({ user: { id: user.id, email: user.email } }, { headers })
}

const navItems = [
  { to: '/dashboard', label: '统计', icon: IconLayoutDashboard },
  { to: '/assets', label: '资产', icon: IconBox },
  { to: '/plans', label: '计划', icon: IconFileText },
  { to: '/settings', label: '设置', icon: IconSettings },
]

export default function AppShell() {
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <nav
        className="hidden md:flex fixed top-0 left-0 z-50 h-screen w-[220px] flex-col border-r px-3 py-6"
        style={{
          background: 'var(--color-surface-soft)',
          borderColor: 'var(--color-hairline)',
        }}
      >
        <div
          className="mb-6 px-2 font-[family-name:var(--font-display)] text-[22px]"
          style={{ color: 'var(--color-primary)' }}
        >
          Holdly
        </div>

        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/assets' || item.to === '/plans' || item.to === '/settings'}
            className={({ isActive }) =>
              `flex h-11 items-center gap-2.5 rounded-md px-3 text-[15px] transition-colors ${
                isActive
                  ? 'font-medium'
                  : ''
              }`}
            style={({ isActive }) => ({
              color: isActive ? 'var(--color-primary)' : 'var(--color-body)',
              background: isActive ? 'var(--color-primary-muted)' : 'transparent',
            })}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:ml-[220px] md:pb-6">
        <div className={`mx-auto max-w-[640px] px-4 md:px-8 ${location.pathname === '/dashboard' ? 'md:max-w-[960px]' : 'md:max-w-[800px]'}`}>
          <Outlet />
        </div>
      </main>

      {/* Mobile Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-start justify-around border-t pt-2 md:hidden"
        style={{
          height: 'var(--tab-bar-height)',
          background: 'var(--color-canvas)',
          borderColor: 'var(--color-hairline)',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
        }}
      >
        {navItems.slice(0, 2).map(item => (
          <TabItem key={item.to} {...item} locationPath={location.pathname} />
        ))}

        {navItems.slice(2).map(item => (
          <TabItem key={item.to} {...item} locationPath={location.pathname} />
        ))}
      </nav>
    </div>
  )
}

function TabItem({
  to,
  label,
  icon: Icon,
  locationPath,
}: {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  locationPath: string
}) {
  const isActive = locationPath.startsWith(to)
  return (
    <NavLink
      to={to}
      className="flex min-w-[48px] flex-col items-center gap-0.5 px-2 py-1 text-[10px] transition-colors"
      style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-muted)' }}
    >
      <Icon size={22} />
      <span className="font-medium" style={{ color: 'inherit' }}>
        {label}
      </span>
    </NavLink>
  )
}
