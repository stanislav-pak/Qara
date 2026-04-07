import { useCallback, useEffect, useState } from 'react'
import type {
  ActiveStaffOption,
  AppointmentDayRow,
  AppointmentStatus,
} from '@/hooks/useAppointments'
import { useAppointments } from '@/hooks/useAppointments'
import { useTranslation } from '@/hooks/useTranslation'
import {
  datetimeLocalValueToIso,
  defaultDatetimeLocalForSelectedDay,
  formatAppointmentSlot,
  formatDateInputLocal,
  isoToDatetimeLocalValue,
  localeTagFromAppLocale,
} from '@/lib/format'
import type { TranslationKey } from '@/locales/ru'
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

function isSameLocalDay(a: Date, b: Date): boolean {
  return formatDateInputLocal(a) === formatDateInputLocal(b)
}

type EditModalProps = {
  row: AppointmentDayRow
  staffOptions: ActiveStaffOption[]
  t: (key: TranslationKey) => string
  working: boolean
  onClose: () => void
  onSave: (patch: {
    staff_id: string
    title: string
    client_name: string | null
    scheduled_at: string
    status: AppointmentStatus
  }) => Promise<void>
}

function AppointmentEditModal({ row, staffOptions, t, working, onClose, onSave }: EditModalProps) {
  const staffSelectOptions =
    row.staff_id && !staffOptions.some((s) => s.id === row.staff_id)
      ? [{ id: row.staff_id, full_name: row.staff_name?.trim() || '—' }, ...staffOptions]
      : staffOptions

  const [staffId, setStaffId] = useState(row.staff_id ?? '')
  const [title, setTitle] = useState(row.title)
  const [client, setClient] = useState(row.client_name ?? '')
  const [when, setWhen] = useState(() => isoToDatetimeLocalValue(row.scheduled_at))
  const [status, setStatus] = useState<AppointmentStatus>(row.status as AppointmentStatus)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffId.trim()) return
    await onSave({
      staff_id: staffId.trim(),
      title: title.trim() || 'Приём',
      client_name: client.trim() || null,
      scheduled_at: datetimeLocalValueToIso(when),
      status,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appt-edit-title"
      onMouseDown={(e) => {
        if (!working && e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-glow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="appt-edit-title" className="text-lg font-semibold text-white">
          {t('appointments.editHeading')}
        </h2>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldStaff')}</span>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="">{t('appointments.selectStaff')}</option>
              {staffSelectOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldTitle')}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-zinc-600 focus:border-white/20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldClient')}</span>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder={t('appointments.fieldClientOptional')}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldDateTime')}</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldStatus')}</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="scheduled">{t('dashboard.statusScheduled')}</option>
              <option value="completed">{t('dashboard.statusCompleted')}</option>
              <option value="cancelled">{t('dashboard.statusCancelled')}</option>
              <option value="no_show">{t('dashboard.statusNoShow')}</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            {t('appointments.cancel')}
          </button>
          <button
            type="submit"
            disabled={working || !staffId.trim()}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent-muted)] disabled:opacity-40"
          >
            {working ? t('appointments.creating') : t('appointments.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

export function AppointmentsPage() {
  const { t, locale } = useTranslation()
  const tag = localeTagFromAppLocale(locale)
  const {
    selectedDate,
    setSelectedDate,
    goPrevDay,
    goNextDay,
    appointments,
    activeStaff,
    loading,
    loadError,
    refresh,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  } = useAppointments()

  const [newStaffId, setNewStaffId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newClient, setNewClient] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newWhen, setNewWhen] = useState(() => defaultDatetimeLocalForSelectedDay(new Date()))
  const [formError, setFormError] = useState(false)
  const [working, setWorking] = useState(false)
  const [editing, setEditing] = useState<AppointmentDayRow | null>(null)

  useEffect(() => {
    setNewWhen(defaultDatetimeLocalForSelectedDay(selectedDate))
    setFormError(false)
  }, [selectedDate])

  const goToday = useCallback(() => {
    setSelectedDate(new Date())
  }, [setSelectedDate])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(false)
    setWorking(true)
    const { error } = await createAppointment({
      staff_id: newStaffId,
      title: newTitle,
      client_name: newClient.trim() || null,
      phone: newPhone.trim() || null,
      scheduled_at: datetimeLocalValueToIso(newWhen),
    })
    setWorking(false)
    if (error) {
      setFormError(true)
      return
    }
    setNewTitle('')
    setNewClient('')
    setNewPhone('')
    setNewWhen(defaultDatetimeLocalForSelectedDay(selectedDate))
  }

  const onSaveEdit = async (patch: Parameters<EditModalProps['onSave']>[0]) => {
    if (!editing) return
    setFormError(false)
    setWorking(true)
    const { error } = await updateAppointment(editing.id, patch)
    setWorking(false)
    if (error) {
      setFormError(true)
      return
    }
    setEditing(null)
  }

  const runStatus = async (id: string, status: AppointmentStatus) => {
    setWorking(true)
    setFormError(false)
    const { error } = await updateAppointment(id, { status })
    setWorking(false)
    if (error) setFormError(true)
  }

  const onDelete = async (id: string) => {
    if (!window.confirm(t('appointments.confirmDelete'))) return
    setWorking(true)
    setFormError(false)
    const { error } = await deleteAppointment(id)
    setWorking(false)
    if (error) setFormError(true)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{t('appointments.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{t('appointments.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(false)
            void refresh()
          }}
          disabled={loading || working}
          className="self-start rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          {t('appointments.refresh')}
        </button>
      </div>

      {(loadError || formError) && (
        <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/90">
          {loadError && <p>{t('appointments.loadError')}</p>}
          {formError && <p>{t('appointments.formError')}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevDay}
            disabled={working}
            aria-label={t('appointments.prevDay')}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04] disabled:opacity-40"
          >
            ‹
          </button>
          <input
            type="date"
            value={formatDateInputLocal(selectedDate)}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              const [y, m, d] = v.split('-').map(Number)
              setSelectedDate(new Date(y, m - 1, d))
            }}
            aria-label={t('appointments.pickDate')}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          />
          <button
            type="button"
            onClick={goNextDay}
            disabled={working}
            aria-label={t('appointments.nextDay')}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04] disabled:opacity-40"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={goToday}
          disabled={working || isSameLocalDay(selectedDate, new Date())}
          className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white disabled:opacity-30"
        >
          {t('appointments.today')}
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)] p-5">
        <h2 className="text-sm font-semibold text-white">{t('appointments.newRecord')}</h2>
        {!loading && activeStaff.length === 0 && (
          <p className="mt-3 text-sm text-amber-200/90">{t('appointments.noActiveStaff')}</p>
        )}
        <form onSubmit={(e) => void onCreate(e)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2 lg:col-span-4">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldStaff')}</span>
            <select
              value={newStaffId}
              onChange={(e) => setNewStaffId(e.target.value)}
              required
              disabled={loading || activeStaff.length === 0}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20 disabled:opacity-40"
            >
              <option value="">{t('appointments.selectStaff')}</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldTitle')}</span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder="Приём"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldClient')}</span>
            <input
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder={t('appointments.fieldClientOptional')}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldPhone')}</span>
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder="+7 777 123 45 67"
            />
          </label>
          <label className="sm:col-span-2 lg:col-span-3">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldDateTime')}</span>
            <input
              type="datetime-local"
              value={newWhen}
              onChange={(e) => setNewWhen(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              disabled={
                working ||
                loading ||
                !newStaffId.trim() ||
                activeStaff.length === 0
              }
              className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-muted)] disabled:opacity-40"
            >
              {working ? t('appointments.creating') : t('appointments.submitCreate')}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">
            {new Intl.DateTimeFormat(tag, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(selectedDate)}
          </h2>
        </div>

        <div className="p-2 sm:p-3">
          {loading ? (
            <ul className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <li
                  key={i}
                  className="flex animate-pulse gap-4 rounded-xl border border-transparent px-3 py-4"
                >
                  <div className="h-10 w-16 rounded-lg bg-white/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/5 rounded bg-white/[0.06]" />
                    <div className="h-3 w-4/5 rounded bg-white/[0.04]" />
                  </div>
                </li>
              ))}
            </ul>
          ) : appointments.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-zinc-500">{t('appointments.emptyDay')}</p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {appointments.map((row) => {
                const { date, time } = formatAppointmentSlot(row.scheduled_at, tag)
                const st = row.status as AppointmentStatus
                return (
                  <li key={row.id} className="px-2 py-2 sm:px-3">
                    <div className="flex flex-col gap-3 rounded-xl px-2 py-3 sm:flex-row sm:items-start sm:gap-4">
                      <div className="flex shrink-0 items-baseline gap-2 tabular-nums sm:w-[108px] sm:flex-col sm:gap-0">
                        <span className="text-xs font-medium text-zinc-500">{date}</span>
                        <span className="text-base font-semibold text-white">{time}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-100">{row.title}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {row.client_name?.trim() || '—'}
                          <span className="text-zinc-600">
                            {' · '}
                            {row.staff_name?.trim() || '—'}
                          </span>
                        </p>
                      </div>
                      <span className="shrink-0 self-start rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        {t(statusKey(st))}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 px-2 pb-1">
                      {st === 'scheduled' && (
                        <>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => void runStatus(row.id, 'completed')}
                            className="rounded-lg border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-200/90 transition hover:bg-emerald-500/10 disabled:opacity-40"
                          >
                            {t('appointments.actionComplete')}
                          </button>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => void runStatus(row.id, 'no_show')}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                          >
                            {t('appointments.actionNoShow')}
                          </button>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => void runStatus(row.id, 'cancelled')}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-400 transition hover:border-rose-500/30 hover:text-rose-200/90 disabled:opacity-40"
                          >
                            {t('appointments.actionCancel')}
                          </button>
                        </>
                      )}
                      {st !== 'scheduled' && (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => void runStatus(row.id, 'scheduled')}
                          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                        >
                          {t('appointments.actionRestore')}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => setEditing(row)}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                      >
                        {t('appointments.actionEdit')}
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void onDelete(row.id)}
                        className="rounded-lg border border-transparent px-2.5 py-1 text-xs font-medium text-rose-300/80 transition hover:bg-rose-500/10 disabled:opacity-40"
                      >
                        {t('appointments.actionDelete')}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <AppointmentEditModal
          key={editing.id}
          row={editing}
          staffOptions={activeStaff}
          t={t}
          working={working}
          onClose={() => !working && setEditing(null)}
          onSave={onSaveEdit}
        />
      )}
    </div>
  )
}
