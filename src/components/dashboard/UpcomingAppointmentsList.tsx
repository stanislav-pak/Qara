import type { UpcomingAppointment } from '@/hooks/useOwnerDashboard'
import { formatAppointmentSlot, formatKztDurationLine, localeTagFromAppLocale } from '@/lib/format'
import type { TranslationKey } from '@/locales/ru'
import type { Locale } from '@/store/localeStore'

type Props = {
  items: UpcomingAppointment[]
  loading: boolean
  locale: Locale
  t: (key: TranslationKey) => string
}

function statusKey(status: string): TranslationKey {
  switch (status) {
    case 'completed':
      return 'dashboard.statusCompleted'
    case 'cancelled':
      return 'dashboard.statusCancelled'
    case 'no_show':
      return 'dashboard.statusNoShow'
    default:
      return 'dashboard.statusScheduled'
  }
}

function clientStaffLine(
  client: string | null,
  staff: string | null,
  dash: string,
): string {
  const c = client?.trim() || dash
  const s = staff?.trim() || dash
  return `${c} · ${s}`
}

export function UpcomingAppointmentsList({ items, loading, locale, t }: Props) {
  const tag = localeTagFromAppLocale(locale)
  const dash = '—'

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{t('dashboard.upcomingTitle')}</h2>
        {!loading && (
          <span className="text-xs tabular-nums text-zinc-500">{items.length}</span>
        )}
      </div>

      <div className="p-2 sm:p-3">
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="space-y-2 rounded-xl border border-transparent px-3 py-3 animate-pulse"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="h-3 w-12 rounded bg-white/[0.06]" />
                  <div className="h-3.5 flex-1 rounded bg-white/[0.06]" />
                  <div className="h-5 w-24 rounded bg-white/[0.06]" />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="h-4 w-10 rounded bg-white/[0.06]" />
                  <div className="h-3 flex-1 rounded bg-white/[0.04]" />
                  <div className="h-4 w-16 rounded bg-white/[0.06]" />
                </div>
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-zinc-500">{t('dashboard.upcomingEmpty')}</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {items.map((row) => {
              const { date, time } = formatAppointmentSlot(row.scheduled_at, tag)
              const priceStr = formatKztDurationLine(row.amount_kzt, row.duration_minutes, tag, dash)

              return (
                <li key={row.id}>
                  <div className="rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.03]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500">
                        {date}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-left text-sm font-medium text-zinc-100">
                        {row.title}
                      </p>
                      <span className="shrink-0 rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        {t(statusKey(row.status))}
                      </span>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                        {time}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-left text-xs text-zinc-500">
                        {clientStaffLine(row.client_name, row.staff_name, dash)}
                      </p>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-300">
                        {priceStr}
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
  )
}
