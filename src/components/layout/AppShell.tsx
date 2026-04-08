import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useTranslation } from '@/hooks/useTranslation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TranslationKey } from '@/locales/ru'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-white/10 text-white'
      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
  ].join(' ')

const navClassMobile = ({ isActive }: { isActive: boolean }) =>
  [
    'block w-full rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors',
    isActive ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/5 hover:text-white',
  ].join(' ')

const NAV_ITEMS: { to: string; labelKey: TranslationKey; end?: boolean }[] = [
  { to: '/dashboard', labelKey: 'shell.navDashboard', end: true },
  { to: '/appointments', labelKey: 'shell.navCalendar' },
  { to: '/history', labelKey: 'shell.navHistory' },
  { to: '/finance', labelKey: 'shell.navFinance' },
  { to: '/staff', labelKey: 'shell.navStaff' },
  { to: '/services', labelKey: 'shell.navServices' },
  { to: '/book', labelKey: 'shell.navBooking' },
]

function IconMenu() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function AppShell() {
  const { t } = useTranslation()
  const email = useAuthStore((s) => s.user?.email)
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[var(--color-surface)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/dashboard" className="flex min-w-0 shrink items-baseline gap-2 font-semibold tracking-tight">
            <span className="truncate text-white">Qara</span>
            <span className="hidden text-xs font-normal text-zinc-500 sm:inline">ERP / POS</span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex xl:gap-2" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass} end={item.end}>
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              aria-label={menuOpen ? t('shell.ariaCloseMenu') : t('shell.ariaOpenMenu')}
            >
              {menuOpen ? <IconClose /> : <IconMenu />}
            </button>
            <LanguageSwitcher compact />
            <span className="hidden max-w-[140px] truncate text-xs text-zinc-500 sm:inline" title={email ?? ''}>
              {email ?? ''}
            </span>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-white sm:px-3"
            >
              {t('shell.signOut')}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-x-0 top-14 bottom-0 z-40 bg-black/55 lg:hidden"
              aria-hidden
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
            />
            <div
              id="mobile-nav-menu"
              className="relative z-50 border-t border-white/[0.08] bg-[var(--color-surface)]/95 backdrop-blur-xl lg:hidden"
            >
              <nav className="mx-auto flex max-w-6xl flex-col gap-0.5 px-4 py-3" aria-label="Main">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={navClassMobile}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </nav>
            </div>
          </>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
