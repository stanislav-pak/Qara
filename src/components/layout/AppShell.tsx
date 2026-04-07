import { Link, NavLink, Outlet } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useTranslation } from '@/hooks/useTranslation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-white/10 text-white'
      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
  ].join(' ')

export function AppShell() {
  const { t } = useTranslation()
  const email = useAuthStore((s) => s.user?.email)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[var(--color-surface)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/dashboard" className="flex items-baseline gap-2 font-semibold tracking-tight">
            <span className="text-white">Qara</span>
            <span className="text-xs font-normal text-zinc-500">ERP / POS</span>
          </Link>
          <nav className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
            <NavLink to="/dashboard" className={navClass} end>
              {t('shell.navDashboard')}
            </NavLink>
            <NavLink to="/appointments" className={navClass}>
              {t('shell.navCalendar')}
            </NavLink>
            <NavLink to="/history" className={navClass}>
              {t('shell.navHistory')}
            </NavLink>
            <NavLink to="/finance" className={navClass}>
              {t('shell.navFinance')}
            </NavLink>
            <NavLink to="/staff" className={navClass}>
              {t('shell.navStaff')}
            </NavLink>
            <NavLink to="/services" className={navClass}>
              {t('shell.navServices')}
            </NavLink>
            <NavLink to="/book" className={navClass}>
              {t('shell.navBooking')}
            </NavLink>
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher compact />
            <span className="hidden max-w-[140px] truncate text-xs text-zinc-500 sm:inline" title={email ?? ''}>
              {email ?? ''}
            </span>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
            >
              {t('shell.signOut')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
