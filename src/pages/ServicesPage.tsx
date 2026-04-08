import { useCallback, useState } from 'react'
import { AlmatyClock } from '@/components/AlmatyClock'
import type { ServiceRow } from '@/hooks/useServices'
import { useServices } from '@/hooks/useServices'
import { useTranslation } from '@/hooks/useTranslation'
import { formatKztSpaced, localeTagFromAppLocale } from '@/lib/format'

function parsePrice(raw: string): number | null {
  const n = Number(raw.replace(',', '.').trim())
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

function parseDurationMin(raw: string): number | null {
  const n = parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

export function ServicesPage() {
  const { t, locale } = useTranslation()
  const tag = localeTagFromAppLocale(locale)
  const { services, loading, loadError, refresh, createService, updateService } = useServices()

  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newDuration, setNewDuration] = useState('')
  const [formError, setFormError] = useState(false)
  const [working, setWorking] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDuration, setEditDuration] = useState('')

  const startInlineEdit = (row: ServiceRow) => {
    setEditingId(row.id)
    setEditName(row.name)
    setEditPrice(String(Number(row.price)))
    setEditDuration(String(row.duration))
  }

  const cancelInlineEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditPrice('')
    setEditDuration('')
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const price = parsePrice(newPrice)
    const duration = parseDurationMin(newDuration)
    if (!newName.trim() || price === null || duration === null) {
      setFormError(true)
      return
    }
    setFormError(false)
    setWorking(true)
    const { error } = await createService({
      name: newName.trim(),
      price,
      duration,
    })
    setWorking(false)
    if (error) {
      setFormError(true)
      return
    }
    setNewName('')
    setNewPrice('')
    setNewDuration('')
  }

  const onSaveInline = async () => {
    if (!editingId) return
    const price = parsePrice(editPrice)
    const duration = parseDurationMin(editDuration)
    if (!editName.trim() || price === null || duration === null) {
      setFormError(true)
      return
    }
    setFormError(false)
    setWorking(true)
    const { error } = await updateService(editingId, {
      name: editName.trim(),
      price,
      duration,
    })
    setWorking(false)
    if (error) {
      setFormError(true)
      return
    }
    cancelInlineEdit()
  }

  const toggleActive = useCallback(
    async (row: ServiceRow) => {
      setFormError(false)
      setWorking(true)
      const { error } = await updateService(row.id, { is_active: !row.is_active })
      setWorking(false)
      if (error) setFormError(true)
    },
    [updateService],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{t('services.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{t('services.subtitle')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 self-start">
          <AlmatyClock />
          <button
            type="button"
            onClick={() => {
              setFormError(false)
              void refresh()
            }}
            disabled={loading || working}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            {t('services.refresh')}
          </button>
        </div>
      </div>

      {(loadError || formError) && (
        <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/90">
          {loadError && <p>{t('services.loadError')}</p>}
          {formError && <p>{t('services.formError')}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)] p-5">
        <h2 className="text-sm font-semibold text-white">{t('services.newService')}</h2>
        <form
          onSubmit={(e) => void onCreate(e)}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        >
          <label className="min-w-0 lg:col-span-2">
            <span className="text-xs font-medium text-zinc-500">{t('services.fieldName')}</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder={t('services.namePlaceholder')}
            />
          </label>
          <label className="min-w-0">
            <span className="text-xs font-medium text-zinc-500">{t('services.fieldPrice')}</span>
            <input
              type="text"
              inputMode="decimal"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder="3500"
            />
          </label>
          <label className="min-w-0">
            <span className="text-xs font-medium text-zinc-500">{t('services.fieldDuration')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder="60"
            />
          </label>
          <div className="lg:col-span-4">
            <button
              type="submit"
              disabled={
                working ||
                loading ||
                !newName.trim() ||
                parsePrice(newPrice) === null ||
                parseDurationMin(newDuration) === null
              }
              className="w-full rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-muted)] disabled:opacity-40 sm:w-auto"
            >
              {working ? t('services.saving') : t('services.submitAdd')}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">{t('services.listHeading')}</h2>
          {!loading && (
            <span className="text-xs tabular-nums text-zinc-500">{services.length}</span>
          )}
        </div>

        <div className="p-2 sm:p-3">
          {loading ? (
            <ul className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className="flex animate-pulse items-center gap-4 rounded-xl px-3 py-4"
                >
                  <div className="h-4 flex-1 rounded bg-white/[0.06]" />
                  <div className="h-6 w-20 rounded-lg bg-white/[0.06]" />
                </li>
              ))}
            </ul>
          ) : services.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-zinc-500">{t('services.empty')}</p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {services.map((row) => {
                const isEditing = editingId === row.id
                const priceNum = Number(row.price)
                const priceLabel = formatKztSpaced(priceNum, tag)

                return (
                  <li key={row.id} className="px-2 py-1 sm:px-3">
                    <div className="flex flex-col gap-3 rounded-xl px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        {isEditing ? (
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20 sm:col-span-1"
                            />
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                              aria-label={t('services.fieldPrice')}
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editDuration}
                              onChange={(e) => setEditDuration(e.target.value.replace(/\D/g, ''))}
                              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                              aria-label={t('services.fieldDuration')}
                            />
                          </div>
                        ) : (
                          <>
                            <p className="font-medium text-zinc-100">{row.name}</p>
                            <p className="text-xs text-zinc-500">
                              <span className="tabular-nums text-zinc-400">{priceLabel}</span>
                              <span className="mx-2 text-zinc-600">·</span>
                              <span className="tabular-nums">
                                {row.duration} {t('services.durationMin')}
                              </span>
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {!isEditing && (
                          <span
                            className={[
                              'shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                              row.is_active
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90'
                                : 'border-white/[0.08] bg-black/20 text-zinc-500',
                            ].join(' ')}
                          >
                            {row.is_active ? t('services.statusActive') : t('services.statusInactive')}
                          </span>
                        )}
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={working}
                              onClick={() => void onSaveInline()}
                              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                            >
                              {t('services.actionSave')}
                            </button>
                            <button
                              type="button"
                              disabled={working}
                              onClick={cancelInlineEdit}
                              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.05] disabled:opacity-40"
                            >
                              {t('services.actionCancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={working || editingId !== null}
                              onClick={() => void toggleActive(row)}
                              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                            >
                              {row.is_active
                                ? t('services.actionDeactivate')
                                : t('services.actionActivate')}
                            </button>
                            <button
                              type="button"
                              disabled={working || editingId !== null}
                              onClick={() => startInlineEdit(row)}
                              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                            >
                              {t('services.actionEdit')}
                            </button>
                          </>
                        )}
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
