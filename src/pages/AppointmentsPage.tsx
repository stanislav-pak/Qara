import { useCallback, useEffect, useState } from 'react'
import { AlmatyClock } from '@/components/AlmatyClock'
import type {
  ActiveStaffOption,
  AppointmentDayRow,
  AppointmentStatus,
} from '@/hooks/useAppointments'
import { useAppointments } from '@/hooks/useAppointments'
import { useTranslation } from '@/hooks/useTranslation'
import { aggregateAppointmentServicesByAppointment } from '@/lib/appointmentServiceAggregates'
import {
  datetimeLocalValueToIso,
  formatAppointmentSlot,
  formatDateInputLocal,
  formatKztDurationLine,
  isoToDatetimeLocalValue,
  localeTagFromAppLocale,
  localDayBoundsFor,
} from '@/lib/format'
import { digitsToE164Plus7 } from '@/lib/kzPhone'
import { supabase } from '@/lib/supabase'
import {
  buildBookedIntervalsByStaff,
  generateAggregateTimeSlotsOverlap,
  generateTimeSlots,
  isSlotBlockedByBookings,
  type TimeSlot as DayTimeSlot,
} from '@/lib/timeSlots'
import { useAuthStore } from '@/store/authStore'
import type { TranslationKey } from '@/locales/ru'

const CREATE_DURATION_OPTIONS: number[] = [30, 45, 60, 90, 120]

const SERVICE_OTHER = '__other__' as const

/** Режим «все мастера» в форме новой записи */
const STAFF_ALL = '__all__' as const

type ServiceOption = { id: string; name: string; duration: number }

function snapToCreateDuration(min: number): number {
  let best = CREATE_DURATION_OPTIONS[0]
  for (const c of CREATE_DURATION_OPTIONS) {
    if (Math.abs(c - min) < Math.abs(best - min)) best = c
  }
  return best
}

const STATUS_VALUES: AppointmentStatus[] = ['scheduled', 'completed', 'no_show', 'cancelled']

function normalizeAppointmentStatus(s: string): AppointmentStatus {
  return STATUS_VALUES.includes(s as AppointmentStatus) ? (s as AppointmentStatus) : 'scheduled'
}

function statusLabelKey(status: string): TranslationKey {
  switch (normalizeAppointmentStatus(status)) {
    case 'completed':
      return 'appointments.optionStatusCompleted'
    case 'cancelled':
      return 'appointments.optionStatusCancelled'
    case 'no_show':
      return 'appointments.optionStatusNoShow'
    default:
      return 'appointments.optionStatusScheduled'
  }
}

function statusBadgeClass(st: AppointmentStatus): string {
  switch (st) {
    case 'scheduled':
      return 'border-sky-500/35 bg-sky-500/[0.12] text-sky-200/95'
    case 'completed':
      return 'border-emerald-500/35 bg-emerald-500/[0.12] text-emerald-200/95'
    case 'no_show':
      return 'border-amber-500/35 bg-amber-500/[0.12] text-amber-200/95'
    case 'cancelled':
      return 'border-rose-500/35 bg-rose-500/[0.12] text-rose-200/95'
  }
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return formatDateInputLocal(a) === formatDateInputLocal(b)
}

function slotTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
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
  const [status, setStatus] = useState<AppointmentStatus>(() =>
    normalizeAppointmentStatus(row.status),
  )

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
              <option value="scheduled">{t('appointments.optionStatusScheduled')}</option>
              <option value="completed">{t('appointments.optionStatusCompleted')}</option>
              <option value="no_show">{t('appointments.optionStatusNoShow')}</option>
              <option value="cancelled">{t('appointments.optionStatusCancelled')}</option>
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
  const userId = useAuthStore((s) => s.user?.id)
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
  const [serviceList, setServiceList] = useState<ServiceOption[]>([])
  const [newServiceId, setNewServiceId] = useState('')
  const [newTitleOther, setNewTitleOther] = useState('')
  const [newClient, setNewClient] = useState('')
  const [newPhoneDigits, setNewPhoneDigits] = useState('')
  const [newDurationMin, setNewDurationMin] = useState<number>(60)
  const [newSelectedTime, setNewSelectedTime] = useState('')
  const [staffBookedIntervals, setStaffBookedIntervals] = useState<
    Map<string, { starts_at: string; ends_at: string }[]>
  >(() => new Map())
  const [staffPickerTime, setStaffPickerTime] = useState<string | null>(null)
  const [createSlots, setCreateSlots] = useState<DayTimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [formError, setFormError] = useState(false)
  const [working, setWorking] = useState(false)
  const [editing, setEditing] = useState<AppointmentDayRow | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setServiceList([])
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, duration')
        .eq('owner_id', userId)
        .eq('is_active', true)
        .order('name')
      if (cancelled) return
      if (error) {
        console.warn('[appointments] services', error)
        setServiceList([])
        return
      }
      setServiceList((data ?? []) as ServiceOption[])
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    setNewSelectedTime('')
    setStaffPickerTime(null)
    setFormError(false)
  }, [selectedDate, newDurationMin])

  useEffect(() => {
    if (!userId || activeStaff.length === 0) {
      setCreateSlots([])
      setStaffBookedIntervals(new Map())
      setSlotsLoading(false)
      return
    }
    if (!newStaffId.trim()) {
      setCreateSlots([])
      setStaffBookedIntervals(new Map())
      setSlotsLoading(false)
      return
    }

    const ownerId = userId
    const { start: dayStartIso, end: dayEndIso } = localDayBoundsFor(selectedDate)
    const staffIds = activeStaff.map((s) => s.id)
    let cancelled = false
    setSlotsLoading(true)

    ;(async () => {
      async function durationMinutesByAppointment(appointmentIds: string[]): Promise<Map<string, number>> {
        const out = new Map<string, number>()
        if (appointmentIds.length === 0) return out
        const { data: svcRows, error: svcErr } = await supabase
          .from('appointment_services')
          .select('appointment_id, price, duration, service_id')
          .in('appointment_id', appointmentIds)
        if (svcErr) {
          console.warn('[appointments] slot appointment_services', svcErr)
          return out
        }
        const lines =
          (svcRows ?? []) as {
            appointment_id: string
            price: number | null
            duration: number | null
            service_id: string | null
          }[]
        const serviceIds = [
          ...new Set(lines.map((r) => r.service_id).filter((id): id is string => Boolean(id))),
        ]
        let serviceDurationById = new Map<string, number>()
        if (serviceIds.length > 0) {
          const { data: catRows, error: catErr } = await supabase
            .from('services')
            .select('id, duration')
            .eq('owner_id', ownerId)
            .in('id', serviceIds)
          if (catErr) console.warn('[appointments] slot services', catErr)
          serviceDurationById = new Map((catRows ?? []).map((s) => [s.id, Number(s.duration ?? 0)]))
        }
        const agg = aggregateAppointmentServicesByAppointment(lines, serviceDurationById)
        for (const [aid, v] of agg) {
          out.set(aid, v.durationMinutes)
        }
        return out
      }

      if (newStaffId === STAFF_ALL) {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, staff_id, starts_at, ends_at')
          .eq('owner_id', ownerId)
          .in('staff_id', staffIds)
          .gte('starts_at', dayStartIso)
          .lte('starts_at', dayEndIso)
          .not('status', 'in', '(cancelled,no_show)')
        if (cancelled) return
        if (error) {
          console.warn('[appointments] create slots (all staff)', error)
          setCreateSlots([])
          setStaffBookedIntervals(new Map())
          setSlotsLoading(false)
          return
        }
        const apptRows = (
          (data ?? []) as {
            id: string
            staff_id: string | null
            starts_at: string | null
            ends_at: string | null
          }[]
        ).filter(
          (r) =>
            r.staff_id != null &&
            staffIds.includes(r.staff_id),
        )
        const durMap = await durationMinutesByAppointment(apptRows.map((r) => r.id))
        const bookedMap = buildBookedIntervalsByStaff(apptRows, staffIds, {
          durationMinutesByAppointmentId: durMap,
        })
        setStaffBookedIntervals(bookedMap)
        setCreateSlots(
          generateAggregateTimeSlotsOverlap(
            9,
            21,
            newDurationMin,
            staffIds,
            bookedMap,
            selectedDate,
          ),
        )
        setSlotsLoading(false)
        return
      }

      const selectedStaffId = newStaffId.trim()
      const { data, error } = await supabase
        .from('appointments')
        .select('id, staff_id, starts_at, ends_at')
        .eq('owner_id', ownerId)
        .eq('staff_id', selectedStaffId)
        .gte('starts_at', dayStartIso)
        .lte('starts_at', dayEndIso)
        .not('status', 'in', '(cancelled,no_show)')
      if (cancelled) return
      if (error) {
        console.warn('[appointments] create slots', error)
        setCreateSlots([])
        setStaffBookedIntervals(new Map())
        setSlotsLoading(false)
        return
      }
      setStaffBookedIntervals(new Map())
      const rows = (
        (data ?? []) as {
          id: string
          staff_id: string | null
          starts_at: string | null
          ends_at: string | null
        }[]
      ).filter((r) => r.staff_id === selectedStaffId)
      const durMap = await durationMinutesByAppointment(rows.map((r) => r.id))
      const withStaff = rows.map((r) => ({
        id: r.id,
        staff_id: r.staff_id as string,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
      }))
      const bookedMap = buildBookedIntervalsByStaff(withStaff, [selectedStaffId], {
        durationMinutesByAppointmentId: durMap,
      })
      const booked = bookedMap.get(selectedStaffId) ?? []
      setCreateSlots(
        generateTimeSlots(9, 21, newDurationMin, booked, 'intervalOverlap', selectedDate),
      )
      setSlotsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, newStaffId, selectedDate, newDurationMin, appointments, activeStaff])

  useEffect(() => {
    if (!staffPickerTime) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStaffPickerTime(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [staffPickerTime])

  const goToday = useCallback(() => {
    setSelectedDate(new Date())
  }, [setSelectedDate])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSelectedTime.trim() || !newServiceId) return
    if (newStaffId === STAFF_ALL || !newStaffId.trim()) return
    setFormError(false)
    setWorking(true)
    const dayStr = formatDateInputLocal(selectedDate)
    const scheduledLocal = `${dayStr}T${newSelectedTime.trim()}:00`
    const titleResolved =
      newServiceId === SERVICE_OTHER
        ? newTitleOther.trim() || 'Приём'
        : serviceList.find((s) => s.id === newServiceId)?.name.trim() || newTitleOther.trim() || 'Приём'
    const phoneE164 = digitsToE164Plus7(newPhoneDigits)
    const { error } = await createAppointment({
      staff_id: newStaffId,
      title: titleResolved,
      client_name: newClient.trim() || null,
      phone: phoneE164,
      scheduled_at: datetimeLocalValueToIso(scheduledLocal),
      duration_minutes: newDurationMin,
    })
    setWorking(false)
    if (error) {
      setFormError(true)
      return
    }
    setNewServiceId('')
    setNewTitleOther('')
    setNewClient('')
    setNewPhoneDigits('')
    setNewSelectedTime('')
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
            {t('appointments.refresh')}
          </button>
        </div>
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
              onChange={(e) => {
                setNewStaffId(e.target.value)
                setNewSelectedTime('')
                setStaffPickerTime(null)
              }}
              required
              disabled={loading || activeStaff.length === 0}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20 disabled:opacity-40"
            >
              <option value="">{t('appointments.selectStaff')}</option>
              <option value={STAFF_ALL}>{t('appointments.allStaff')}</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 space-y-2">
            <label className="block">
              <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldTitle')}</span>
              <select
                value={newServiceId}
                onChange={(e) => {
                  const v = e.target.value
                  setNewServiceId(v)
                  if (v && v !== SERVICE_OTHER) {
                    const s = serviceList.find((x) => x.id === v)
                    if (s) setNewDurationMin(snapToCreateDuration(s.duration))
                  }
                }}
                required
                disabled={loading || !userId}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20 disabled:opacity-40"
              >
                <option value="">{t('appointments.selectService')}</option>
                {serviceList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration} мин)
                  </option>
                ))}
                <option value={SERVICE_OTHER}>{t('appointments.serviceOther')}</option>
              </select>
            </label>
            {newServiceId === SERVICE_OTHER ? (
              <label className="block">
                <span className="text-xs font-medium text-zinc-500">{t('appointments.titleManualPlaceholder')}</span>
                <input
                  value={newTitleOther}
                  onChange={(e) => setNewTitleOther(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                  placeholder="Приём"
                />
              </label>
            ) : null}
          </div>
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldClient')}</span>
            <input
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              placeholder={t('appointments.fieldClientOptional')}
            />
          </label>
          <div className="sm:col-span-2">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldPhone')}</span>
            <div className="mt-1 flex overflow-hidden rounded-xl border border-white/10 bg-black/30 focus-within:border-white/20">
              <span className="flex shrink-0 items-center border-r border-white/10 bg-white/[0.04] px-3 text-sm tabular-nums text-zinc-400">
                +7
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={newPhoneDigits}
                onChange={(e) => setNewPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="7771234567"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-600">{t('appointments.phoneDigitsHint')}</p>
          </div>
          <p className="text-xs text-zinc-600 sm:col-span-2">
            {t('appointments.fieldDateTime')}:{' '}
            <span className="font-medium text-zinc-400">
              {new Intl.DateTimeFormat(tag, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(selectedDate)}
            </span>
          </p>
          <label className="sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldDuration')}</span>
            <select
              value={newDurationMin}
              onChange={(e) => setNewDurationMin(Number(e.target.value))}
              disabled={loading || activeStaff.length === 0}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20 disabled:opacity-40"
            >
              {CREATE_DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="text-xs font-medium text-zinc-500">{t('appointments.fieldTime')}</span>
            {!newStaffId.trim() ? (
              <p className="mt-2 text-sm text-zinc-600">{t('appointments.selectStaff')}</p>
            ) : slotsLoading ? (
              <div className="mt-3 flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[var(--color-accent)]" />
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {createSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => {
                      if (!slot.available) return
                      if (newStaffId === STAFF_ALL) {
                        const sm = slotTimeToMinutes(slot.time)
                        const slotEnd = sm + newDurationMin
                        const free = activeStaff.filter(
                          (s) =>
                            !isSlotBlockedByBookings(
                              sm,
                              slotEnd,
                              staffBookedIntervals.get(s.id) ?? [],
                              selectedDate,
                            ),
                        )
                        if (free.length === 0) return
                        setStaffPickerTime(slot.time)
                        return
                      }
                      setNewSelectedTime(slot.time)
                    }}
                    className={`rounded-xl py-2.5 text-sm font-medium transition-all ${
                      newSelectedTime === slot.time
                        ? 'border border-[var(--color-accent)]/60 bg-[var(--color-accent)]/20 text-white'
                        : !slot.available
                          ? 'cursor-not-allowed bg-black/40 text-zinc-600 opacity-50'
                          : 'border border-white/15 bg-white/[0.08] text-white hover:border-[var(--color-accent)]/50 hover:bg-white/[0.12]'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={
                working ||
                loading ||
                !newStaffId.trim() ||
                newStaffId === STAFF_ALL ||
                !newSelectedTime.trim() ||
                !newServiceId ||
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
                const st = normalizeAppointmentStatus(row.status)
                const open = expandedId === row.id
                return (
                  <li
                    key={row.id}
                    className={`px-2 py-2 sm:px-3 ${open ? 'bg-white/[0.02]' : ''}`}
                  >
                    <button
                      type="button"
                      disabled={working}
                      aria-expanded={open}
                      onClick={() =>
                        setExpandedId((id) => (id === row.id ? null : row.id))
                      }
                      className="flex w-full flex-col gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-40 sm:flex-row sm:items-start sm:gap-4"
                    >
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
                      <span className="shrink-0 text-right text-sm font-medium tabular-nums text-zinc-300">
                        {formatKztDurationLine(row.amount_kzt, row.duration_minutes, tag, '—')}
                      </span>
                      <span
                        className={`shrink-0 self-start rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(st)}`}
                      >
                        {t(statusLabelKey(st))}
                      </span>
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-white/[0.06] px-2 pb-3 pt-3 sm:px-3">
                        <label className="block">
                          <span className="text-xs font-medium text-zinc-500">
                            {t('appointments.fieldStatus')}
                          </span>
                          <select
                            value={st}
                            disabled={working}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const v = e.target.value as AppointmentStatus
                              if (v !== st) void runStatus(row.id, v)
                            }}
                            className="mt-1 w-full max-w-xs rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/20 disabled:opacity-40"
                          >
                            <option value="scheduled">
                              {t('appointments.optionStatusScheduled')}
                            </option>
                            <option value="completed">
                              {t('appointments.optionStatusCompleted')}
                            </option>
                            <option value="no_show">
                              {t('appointments.optionStatusNoShow')}
                            </option>
                            <option value="cancelled">
                              {t('appointments.optionStatusCancelled')}
                            </option>
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-2">
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
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {staffPickerTime ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-picker-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setStaffPickerTime(null)
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-glow)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="staff-picker-title" className="text-base font-semibold text-white">
              {t('appointments.pickStaffForSlot')} {staffPickerTime}
            </h3>
            <ul className="mt-4 max-h-[min(50vh,20rem)] space-y-2 overflow-y-auto">
              {activeStaff
                .filter((s) => {
                  const sm = slotTimeToMinutes(staffPickerTime)
                  return !isSlotBlockedByBookings(
                    sm,
                    sm + newDurationMin,
                    staffBookedIntervals.get(s.id) ?? [],
                    selectedDate,
                  )
                })
                .map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-white transition hover:border-[var(--color-accent)]/50"
                      onClick={() => {
                        const t = staffPickerTime
                        if (!t) return
                        setNewStaffId(s.id)
                        setNewSelectedTime(t)
                        setStaffPickerTime(null)
                      }}
                    >
                      {s.full_name}
                    </button>
                  </li>
                ))}
            </ul>
            <button
              type="button"
              onClick={() => setStaffPickerTime(null)}
              className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-sm text-zinc-400 transition hover:border-white/20 hover:text-white"
            >
              {t('appointments.cancel')}
            </button>
          </div>
        </div>
      ) : null}

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
