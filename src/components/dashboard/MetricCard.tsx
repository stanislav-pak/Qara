import type { ReactNode } from 'react'

type Props = {
  label: string
  value: string
  hint: string
  icon: ReactNode
  loading?: boolean
}

export function MetricCard({ label, value, hint, icon, loading }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)] p-5 transition-colors hover:border-white/[0.12]">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red-500/[0.06] blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</p>
          {loading ? (
            <div className="mt-3 h-9 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
          ) : (
            <p className="mt-2 truncate text-2xl font-semibold tabular-nums tracking-tight text-white sm:text-3xl">
              {value}
            </p>
          )}
          <p className="mt-1.5 text-xs text-zinc-600">{hint}</p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-black/30 text-red-500/90"
          aria-hidden
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
