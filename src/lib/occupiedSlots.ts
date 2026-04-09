import type { SupabaseClient } from '@supabase/supabase-js'
import { aggregateAppointmentServicesByAppointment } from '@/lib/appointmentServiceAggregates'
import { localDayBoundsFor } from '@/lib/format'

/**
 * Имя колонки FK мастера в `public.appointments` (→ staff_members.id).
 * Должно совпадать с типом в `src/types/database.ts` (`staff_id`).
 */
export const APPOINTMENT_STAFF_FK = 'staff_id' as const

export type OccupiedInterval = { startMs: number; endMs: number }

export type TimeSlot = { time: string; available: boolean }

export type CalendarStaffMode =
  | { kind: 'single'; staffMemberId: string }
  | { kind: 'all'; staffMemberIds: string[] }

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Достаёт id мастера из строки ответа с учётом APPOINTMENT_STAFF_FK. */
export function readAppointmentStaffId(row: Record<string, unknown>): string | null {
  const v = row[APPOINTMENT_STAFF_FK]
  return typeof v === 'string' ? v : null
}

/** Суммарные минуты по записи из строк `appointment_services` (см. aggregateAppointmentServicesByAppointment). */
export async function fetchDurationMinutesByAppointmentIds(
  supabase: SupabaseClient,
  ownerId: string,
  appointmentIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (appointmentIds.length === 0) return out
  const { data: svcRows, error: svcErr } = await supabase
    .from('appointment_services')
    .select('appointment_id, price, duration, service_id')
    .in('appointment_id', appointmentIds)
  if (svcErr) {
    console.warn('[occupiedSlots] appointment_services', svcErr)
    return out
  }
  const lines =
    (svcRows ?? []) as {
      appointment_id: string
      price: number | null
      duration: number | null
      service_id: string | null
    }[]
  const serviceIds = [...new Set(lines.map((r) => r.service_id).filter((id): id is string => Boolean(id)))]
  let serviceDurationById = new Map<string, number>()
  if (serviceIds.length > 0) {
    const { data: catRows, error: catErr } = await supabase
      .from('services')
      .select('id, duration')
      .eq('owner_id', ownerId)
      .in('id', serviceIds)
    if (catErr) console.warn('[occupiedSlots] services', catErr)
    serviceDurationById = new Map((catRows ?? []).map((s) => [s.id, Number(s.duration ?? 0)]))
  }
  const agg = aggregateAppointmentServicesByAppointment(lines, serviceDurationById)
  for (const [aid, v] of agg) {
    out.set(aid, v.durationMinutes)
  }
  return out
}

/**
 * Занятый интервал: [starts_at, starts_at + duration_minutes).
 * Если duration неизвестна (0), подставляется +60 мин от starts_at.
 */
export function appointmentRowsToOccupiedIntervals(
  rows: { id: string; starts_at: string | null }[],
  durationMinutesByAppointmentId: Map<string, number>,
): OccupiedInterval[] {
  const out: OccupiedInterval[] = []
  for (const row of rows) {
    if (!row.starts_at) continue
    const startMs = new Date(row.starts_at).getTime()
    const dur = durationMinutesByAppointmentId.get(row.id) ?? 0
    const endMs = dur > 0 ? startMs + dur * 60 * 1000 : startMs + 60 * 60 * 1000
    if (endMs <= startMs) continue
    out.push({ startMs, endMs })
  }
  return out
}

function groupIntervalsByStaff(
  rows: Record<string, unknown>[],
  staffIds: string[],
  durationByAppt: Map<string, number>,
): Map<string, OccupiedInterval[]> {
  const map = new Map<string, OccupiedInterval[]>()
  for (const id of staffIds) {
    map.set(id, [])
  }
  for (const raw of rows) {
    const staffId = readAppointmentStaffId(raw)
    const id = typeof raw.id === 'string' ? raw.id : null
    const startsAt = typeof raw.starts_at === 'string' ? raw.starts_at : null
    if (!staffId || !id || !startsAt || !map.has(staffId)) continue
    const [interval] = appointmentRowsToOccupiedIntervals(
      [{ id, starts_at: startsAt }],
      durationByAppt,
    )
    if (interval) map.get(staffId)!.push(interval)
  }
  return map
}

export function slotRangeMsOnLocalDay(
  slotStartMinFromMidnight: number,
  newBookingDurationMinutes: number,
  referenceDay: Date,
): { slotStartMs: number; slotEndMs: number } {
  const day0 = new Date(referenceDay)
  day0.setHours(0, 0, 0, 0)
  const dayMs = day0.getTime()
  const slotStartMs = dayMs + slotStartMinFromMidnight * 60 * 1000
  const slotEndMs = slotStartMs + newBookingDurationMinutes * 60 * 1000
  return { slotStartMs, slotEndMs }
}

/** Пересечение [slotStart, slotEnd) с хотя бы одним занятым интервалом. */
export function isProposedSlotOverlapping(
  slotStartMs: number,
  slotEndMs: number,
  occupied: OccupiedInterval[],
): boolean {
  return occupied.some((o) => slotStartMs < o.endMs && slotEndMs > o.startMs)
}

function buildGrid(
  startHour: number,
  endHour: number,
  slotStepMinutes: number,
  newBookingDurationMinutes: number,
  referenceDay: Date,
  isUnavailable: (slotStartMs: number, slotEndMs: number) => boolean,
): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += slotStepMinutes) {
      const fromMid = h * 60 + m
      if (fromMid + newBookingDurationMinutes > endHour * 60) break
      const timeStr = `${pad2(h)}:${pad2(m)}`
      const { slotStartMs, slotEndMs } = slotRangeMsOnLocalDay(fromMid, newBookingDurationMinutes, referenceDay)
      const unavailable = isUnavailable(slotStartMs, slotEndMs)
      slots.push({ time: timeStr, available: !unavailable })
    }
  }
  return slots
}

/**
 * Загрузка записей за выбранный календарный день и построение сетки слотов.
 *
 * — single: только записи выбранного мастера; тусклый слот = пересечение с его занятыми интервалами.
 * — all: записи всех переданных мастеров; тусклый слот только если у КАЖДОГО мастера есть пересечение
 *   (все заняты); яркий — если хотя бы у одного нет пересечения.
 */
export async function loadDayCreationTimeSlots(
  supabase: SupabaseClient,
  args: {
    ownerId: string
    selectedDate: Date
    newBookingDurationMinutes: number
    staffMode: CalendarStaffMode
    startHour?: number
    endHour?: number
    slotStepMinutes?: number
  },
): Promise<{
  slots: TimeSlot[]
  /** Для режима «все мастера» — выбор свободного мастера в модалке */
  occupiedIntervalsByStaffId: Map<string, OccupiedInterval[]>
}> {
  const startHour = args.startHour ?? 9
  const endHour = args.endHour ?? 21
  const slotStep = args.slotStepMinutes ?? 30
  const { start: dayStartIso, end: dayEndIso } = localDayBoundsFor(args.selectedDate)

  /** Все записи за календарный день по салону (без фильтра по мастеру — иначе в БД уходит .eq(staff) и приходит только часть строк). Фильтр по мастеру — ниже, при расчёте занятости. */
  const { data, error } = await supabase
    .from('appointments')
    .select(`id, starts_at, ${APPOINTMENT_STAFF_FK}`)
    .eq('owner_id', args.ownerId)
    .gte('starts_at', dayStartIso)
    .lte('starts_at', dayEndIso)
    .not('status', 'in', '(cancelled,no_show)')

  if (error) {
    console.warn('[occupiedSlots] appointments', error)
    return { slots: [], occupiedIntervalsByStaffId: new Map() }
  }

  const rawRows = (data ?? []) as Record<string, unknown>[]
  console.log('[occupiedSlots] Supabase appointments for day', {
    dayStartIso,
    dayEndIso,
    staffMode: args.staffMode,
    /** В БД колонка `staff_id`, не `staff_member_id`. */
    filter: 'none (all appointments for day; staff applied in memory)',
    rowCount: rawRows.length,
    rows: rawRows.map((r) => ({
      id: r.id,
      starts_at: r.starts_at,
      [APPOINTMENT_STAFF_FK]: r[APPOINTMENT_STAFF_FK],
    })),
  })
  const ids = rawRows.map((r) => (typeof r.id === 'string' ? r.id : '')).filter(Boolean)
  const durationByAppt = await fetchDurationMinutesByAppointmentIds(supabase, args.ownerId, ids)
  console.log('[occupiedSlots] durationMinutes by appointment_id (from appointment_services aggregate)', {
    ...Object.fromEntries(durationByAppt),
  })

  if (args.staffMode.kind === 'single') {
    const sid = args.staffMode.staffMemberId
    const rows = rawRows
      .filter((r) => readAppointmentStaffId(r) === sid)
      .map((r) => ({
        id: r.id as string,
        starts_at: typeof r.starts_at === 'string' ? r.starts_at : null,
      }))
    const occupied = appointmentRowsToOccupiedIntervals(rows, durationByAppt)
    const byStaff = new Map<string, OccupiedInterval[]>([[sid, occupied]])

    const slots = buildGrid(
      startHour,
      endHour,
      slotStep,
      args.newBookingDurationMinutes,
      args.selectedDate,
      (slotStartMs, slotEndMs) => isProposedSlotOverlapping(slotStartMs, slotEndMs, occupied),
    )

    return { slots, occupiedIntervalsByStaffId: byStaff }
  }

  const staffIds = args.staffMode.staffMemberIds
  const byStaff = groupIntervalsByStaff(rawRows, staffIds, durationByAppt)

  const slots = buildGrid(
    startHour,
    endHour,
    slotStep,
    args.newBookingDurationMinutes,
    args.selectedDate,
    (slotStartMs, slotEndMs) => {
      const allBusy = staffIds.every((id) => {
        const occ = byStaff.get(id) ?? []
        return isProposedSlotOverlapping(slotStartMs, slotEndMs, occ)
      })
      return allBusy
    },
  )

  return { slots, occupiedIntervalsByStaffId: byStaff }
}

/**
 * Онлайн-бронь: один мастер, дата из строки YYYY-MM-DD.
 */
export async function loadOnlineBookingTimeSlots(
  supabase: SupabaseClient,
  args: {
    ownerId: string
    staffMemberId: string
    selectedDateYmd: string
    newBookingDurationMinutes: number
  },
): Promise<TimeSlot[]> {
  const [y, mo, d] = args.selectedDateYmd.split('-').map(Number)
  const referenceDay = new Date(y, mo - 1, d)
  const { slots } = await loadDayCreationTimeSlots(supabase, {
    ownerId: args.ownerId,
    selectedDate: referenceDay,
    newBookingDurationMinutes: args.newBookingDurationMinutes,
    staffMode: { kind: 'single', staffMemberId: args.staffMemberId },
  })
  return slots
}
