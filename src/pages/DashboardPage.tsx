import { useTranslation } from '@/hooks/useTranslation'
import { useOwnerDashboard } from '@/hooks/useOwnerDashboard'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { UpcomingAppointmentsList } from '@/components/dashboard/UpcomingAppointmentsList'
import { formatKzt, formatLocaleDateLong, localeTagFromAppLocale } from '@/lib/format'

function IconCalendar() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
      />
    </svg>
  )
}

function IconCurrency() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  )
}

export function DashboardPage() {
  const { t, locale } = useTranslation()
  const {
    loading,
    appointmentsToday,
    revenueTodayKzt,
    activeStaff,
    upcoming,
    loadError,
    refresh,
  } = useOwnerDashboard()

  const tag = localeTagFromAppLocale(locale)
  const today = new Date()
  const dateLine = formatLocaleDateLong(today, tag)

  const revenueStr = formatKzt(revenueTodayKzt, tag)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t('dashboard.subtitle')}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">{dateLine}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="self-start rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          {t('dashboard.refresh')}
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/90">
          {t('dashboard.schemaBanner')}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t('dashboard.metricAppointmentsToday')}
          value={String(appointmentsToday)}
          hint={t('dashboard.hintAppointmentsToday')}
          icon={<IconCalendar />}
          loading={loading}
        />
        <MetricCard
          label={t('dashboard.metricRevenueToday')}
          value={loading ? '—' : revenueStr}
          hint={t('dashboard.hintRevenueToday')}
          icon={<IconCurrency />}
          loading={loading}
        />
        <MetricCard
          label={t('dashboard.metricActiveStaff')}
          value={String(activeStaff)}
          hint={t('dashboard.hintActiveStaff')}
          icon={<IconUsers />}
          loading={loading}
        />
      </div>

      <UpcomingAppointmentsList items={upcoming} loading={loading} locale={locale} t={t} />
    </div>
  )
}
