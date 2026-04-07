import { useCallback, useState, type FormEvent } from 'react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { useFinance } from '@/hooks/useFinance'
import { useTranslation } from '@/hooks/useTranslation'
import { formatDateInputLocal, formatHistoryDateTime, formatKzt, localeTagFromAppLocale } from '@/lib/format'
import type { ExpenseCategory } from '@/types/database'
import type { TranslationKey } from '@/locales/ru'

function IconTrendUp() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  )
}

function IconTrendDown() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6l7.5 7.5 4.306-4.307a11.95 11.95 0 015.814 5.519l2.74 1.22m0 0l-5.94 2.28m5.94-2.28l-2.28-5.941" />
    </svg>
  )
}

function IconScale() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v17.25m0 0l-3.75-3.75M12 20.25l3.75-3.75M4.5 4.5h15"
      />
    </svg>
  )
}

function categoryLabelKey(cat: string): TranslationKey {
  switch (cat) {
    case 'salary':
      return 'finance.categorySalary'
    case 'rent':
      return 'finance.categoryRent'
    case 'supplies':
      return 'finance.categorySupplies'
    case 'other':
      return 'finance.categoryOther'
    default:
      return 'finance.categoryOther'
  }
}

const CATEGORY_OPTIONS: ExpenseCategory[] = ['salary', 'rent', 'supplies', 'other']

export function FinancePage() {
  const { t, locale } = useTranslation()
  const tag = localeTagFromAppLocale(locale)

  const {
    loading,
    loadError,
    revenueMonthKzt,
    expensesMonthKzt,
    profitMonthKzt,
    recentExpenses,
    refresh,
    createExpense,
  } = useFinance()

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('supplies')
  const [occurredDate, setOccurredDate] = useState(() => formatDateInputLocal(new Date()))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(false)

  const revenueStr = formatKzt(revenueMonthKzt, tag)
  const expensesStr = formatKzt(expensesMonthKzt, tag)
  const profitStr = formatKzt(profitMonthKzt, tag)

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setFormError(false)
      const raw = amount.replace(/\s/g, '').replace(',', '.')
      const n = Number(raw)
      if (!Number.isFinite(n) || n <= 0) {
        setFormError(true)
        return
      }
      setSaving(true)
      const { error } = await createExpense({
        amount_kzt: n,
        category,
        occurredDate,
        note: note.trim() || null,
      })
      setSaving(false)
      if (error) {
        setFormError(true)
        return
      }
      setAmount('')
      setNote('')
      setOccurredDate(formatDateInputLocal(new Date()))
    },
    [amount, category, occurredDate, note, createExpense],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{t('finance.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{t('finance.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="self-start rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          {t('finance.refresh')}
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/90">
          {t('finance.loadError')}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label={t('finance.metricRevenue')}
          value={loading ? '—' : revenueStr}
          hint={t('finance.hintRevenue')}
          icon={<IconTrendUp />}
          loading={loading}
        />
        <MetricCard
          label={t('finance.metricExpenses')}
          value={loading ? '—' : expensesStr}
          hint={t('finance.hintExpenses')}
          icon={<IconTrendDown />}
          loading={loading}
        />
        <MetricCard
          label={t('finance.metricProfit')}
          value={loading ? '—' : profitStr}
          hint={t('finance.hintProfit')}
          icon={<IconScale />}
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)] p-5">
          <h2 className="text-sm font-semibold text-white">{t('finance.formHeading')}</h2>
          <form className="mt-4 space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <label className="block min-w-0">
              <span className="text-xs font-medium text-zinc-500">{t('finance.fieldAmount')}</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
                autoComplete="off"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-medium text-zinc-500">{t('finance.fieldCategory')}</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {t(categoryLabelKey(c))}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-medium text-zinc-500">{t('finance.fieldDate')}</span>
              <input
                type="date"
                value={occurredDate}
                onChange={(e) => setOccurredDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-medium text-zinc-500">{t('finance.fieldNote')}</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
                placeholder={t('finance.notePlaceholder')}
              />
            </label>
            {formError && (
              <p className="text-xs text-red-400/90">{t('finance.formError')}</p>
            )}
            <button
              type="submit"
              disabled={saving || loading}
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.1] disabled:opacity-40 sm:w-auto"
            >
              {saving ? t('finance.saving') : t('finance.submitExpense')}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">{t('finance.listHeading')}</h2>
            {!loading && (
              <span className="text-xs tabular-nums text-zinc-500">{recentExpenses.length}</span>
            )}
          </div>
          <div className="p-2 sm:p-3">
            {loading ? (
              <ul className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li
                    key={i}
                    className="flex animate-pulse flex-col gap-2 rounded-xl px-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="h-4 w-36 rounded bg-white/[0.06]" />
                    <div className="h-6 w-24 rounded bg-white/[0.06]" />
                  </li>
                ))}
              </ul>
            ) : recentExpenses.length === 0 ? (
              <p className="px-3 py-12 text-center text-sm text-zinc-500">{t('finance.empty')}</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {recentExpenses.map((row) => {
                  const when = formatHistoryDateTime(row.occurred_at, tag)
                  const amt = formatKzt(row.amount_kzt, tag)
                  return (
                    <li key={row.id} className="px-2 py-1 sm:px-3">
                      <div className="flex flex-col gap-2 rounded-xl px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-medium tabular-nums text-white">{when}</p>
                          <p className="text-xs font-medium text-zinc-400">{t(categoryLabelKey(row.category))}</p>
                          {row.note?.trim() ? (
                            <p className="text-xs text-zinc-500">{row.note.trim()}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-200">{amt}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
