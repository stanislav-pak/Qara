import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RevenueChartDay } from '@/hooks/useOwnerDashboard'
import { formatKzt } from '@/lib/format'
import type { TranslationKey } from '@/locales/ru'

const BAR_FILL = '#e82127'
const GRID_STROKE = 'rgba(255,255,255,0.06)'
const AXIS_TICK = '#71717a'

type Props = {
  data: RevenueChartDay[]
  loading: boolean
  localeTag: string
  t: (key: TranslationKey) => string
}

function formatAxisKzt(n: number, localeTag: string): string {
  const v = Math.round(n)
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000)}M`
  if (v >= 10_000) return `${Math.round(v / 1000)}k`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return formatKzt(v, localeTag)
}

export function RevenueChart30d({ data, loading, localeTag, t }: Props) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)] p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">{t('dashboard.revenueChartTitle')}</h2>
          <p className="mt-1 text-xs text-zinc-600">{t('dashboard.revenueChartHint')}</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
          {t('dashboard.revenueChartYAxis')}
        </span>
      </div>

      <div className="relative mt-6 h-[280px] w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-white/[0.05] bg-black/20">
            <div className="h-40 w-full max-w-md animate-pulse rounded-lg bg-white/[0.06]" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="dateKey"
                tick={{ fill: AXIS_TICK, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: GRID_STROKE }}
                tickFormatter={(v: string) =>
                  new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'short' }).format(
                    new Date(`${v}T12:00:00`),
                  )
                }
                interval={4}
              />
              <YAxis
                tick={{ fill: AXIS_TICK, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v: number) => formatAxisKzt(v, localeTag)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length || label == null) return null
                  const row = payload[0]?.payload as RevenueChartDay | undefined
                  const amount = row?.totalKzt ?? 0
                  const dateLabel = new Intl.DateTimeFormat(localeTag, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  }).format(new Date(`${String(label)}T12:00:00`))
                  return (
                    <div className="rounded-xl border border-white/[0.12] bg-[var(--color-surface-elevated)] px-3 py-2 shadow-lg shadow-black/40">
                      <p className="text-[11px] font-medium text-zinc-400">{dateLabel}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                        {formatKzt(amount, localeTag)}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="totalKzt" fill={BAR_FILL} radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
