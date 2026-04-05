import { useCallback, useState } from 'react'
import { useAppointmentHistory } from '@/hooks/useAppointmentHistory'
import { useTranslation } from '@/hooks/useTranslation'
import { formatHistoryDateTime, formatKztSpaced, localeTagFromAppLocale } from '@/lib/format'
import type { TranslationKey } from '@/locales/ru'

function statusKey(status: string): TranslationKey {
  switch (status) {
    case 'completed':
      return 'dashboard.statusCompleted'
    case 'cancelled':
      return 'dashboard.statusCancelled'
    case 'no_show':
      return 'dashboard.statusNoShow'
    case 'pending':
      return 'history.statusPending'
    default:
      return 'dashboard.statusScheduled'
  }
}

export function HistoryPage() {
  const { t, locale } = useTranslation()
  const tag = localeTagFromAppLocale(locale)

  const [staffFilter, setStaffFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { rows, activeStaff, loading, loadError, refresh, refreshStaff } = useAppointmentHistory(
    staffFilter,
    statusFilter,
    dateFrom,
    dateTo,
  )

  const onRefresh = useCallback(() => {
    void refresh()
    void refreshStaff()
  }, [refresh, refreshStaff])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{t('history.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{t('history.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={loading}
          className="self-start rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          {t('history.refresh')}
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/90">
          {t('history.loadError')}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)] p-5">
        <h2 className="text-sm font-semibold text-white">{t('history.filtersHeading')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block min-w-0">
            <span className="text-xs font-medium text-zinc-500">{t('history.filterStaff')}</span>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="">{t('history.filterStaffAll')}</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-medium text-zinc-500">{t('history.filterStatus')}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="">{t('history.filterStatusAll')}</option>
              <option value="scheduled">{t('dashboard.statusScheduled')}</option>
              <option value="completed">{t('dashboard.statusCompleted')}</option>
              <option value="cancelled">{t('dashboard.statusCancelled')}</option>
              <option value="no_show">{t('dashboard.statusNoShow')}</option>
              <option value="pending">{t('history.statusPending')}</option>
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-medium text-zinc-500">{t('history.filterDateFrom')}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]"
            />
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-medium text-zinc-500">{t('history.filterDateTo')}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">{t('history.listHeading')}</h2>
          {!loading && (
            <span className="text-xs tabular-nums text-zinc-500">{rows.length}</span>
          )}
        </div>

        <div className="p-2 sm:p-3">
          {loading ? (
            <ul className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <li
                  key={i}
                  className="flex animate-pulse flex-col gap-2 rounded-xl px-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="h-4 w-40 rounded bg-white/[0.06]" />
                  <div className="h-3 flex-1 rounded bg-white/[0.04]" />
                  <div className="h-6 w-16 rounded bg-white/[0.06]" />
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-zinc-500">{t('history.empty')}</p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {rows.map((row) => {
                const when = formatHistoryDateTime(row.scheduled_at, tag)
                const amountStr =
                  row.amount_kzt > 0 ? formatKztSpaced(row.amount_kzt, tag) : '—'
                return (
                  <li key={row.id} className="px-2 py-1 sm:px-3">
                    <div className="flex flex-col gap-3 rounded-xl px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium tabular-nums text-white">{when}</p>
                        <p className="text-xs text-zinc-400">
                          <span className="text-zinc-300">{row.client_display}</span>
                          <span className="text-zinc-600"> · </span>
                          <span>{row.staff_name?.trim() || '—'}</span>
                        </p>
                        <p className="text-xs text-zinc-500">{row.title}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                        <span className="text-sm font-medium tabular-nums text-zinc-200">{amountStr}</span>
                        <span
                          className={[
                            'shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                            row.status === 'completed'
                              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90'
                              : row.status === 'cancelled'
                                ? 'border-white/[0.08] bg-black/20 text-zinc-500'
                                : 'border-white/[0.08] bg-black/20 text-zinc-400',
                          ].join(' ')}
                        >
                          {t(statusKey(row.status))}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
