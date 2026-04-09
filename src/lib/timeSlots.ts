/** Слоты дня с шагом 30 мин (как в онлайн-бронировании). */
export type TimeSlot = {
  time: string
  available: boolean
}

/**
 * `intervalOverlap` — слот занят, если интервал [slot, slot+duration) пересекается с [starts_at, ends_at] (онлайн-бронь).
 * `exactStart` — слот занят только если локальное время starts_at существующей записи совпадает с началом слота.
 */
export type TimeSlotConflictMode = 'intervalOverlap' | 'exactStart'

/**
 * Пересечение [slotStartMin, slotEndMin) с [starts_at, ends_at) по локальному дню referenceDay.
 * Сравнение по меткам времени, без обрезки до часов/минут (корректно при длительности из БД).
 */
export function isSlotBlockedByBookings(
  slotStartMin: number,
  slotEndMin: number,
  booked: { starts_at: string; ends_at: string }[],
  referenceDay: Date,
): boolean {
  const day0 = new Date(referenceDay)
  day0.setHours(0, 0, 0, 0)
  const dayMs = day0.getTime()
  const slotStartMs = dayMs + slotStartMin * 60 * 1000
  const slotEndMs = dayMs + slotEndMin * 60 * 1000

  return booked.some((bookedRow) => {
    const bStartMs = new Date(bookedRow.starts_at).getTime()
    const bEndMs = new Date(bookedRow.ends_at).getTime()
    return slotStartMs < bEndMs && slotEndMs > bStartMs
  })
}

/**
 * Генерирует слоты с startHour по endHour, шаг 30 мин.
 * duration — длительность новой записи в минутах; при intervalOverlap — проверка пересечений с записями.
 */
export function generateTimeSlots(
  startHour: number,
  endHour: number,
  duration: number,
  bookedSlots: { starts_at: string; ends_at: string }[],
  conflictMode: TimeSlotConflictMode = 'intervalOverlap',
  /** Локальный календарный день слотов (сетка 9–21 привязана к этому дню). */
  referenceDay: Date = new Date(),
): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const slotStart = h * 60 + m
      const slotEnd = slotStart + duration
      if (slotEnd > endHour * 60) break

      let isBooked: boolean
      if (conflictMode === 'exactStart') {
        isBooked = bookedSlots.some((booked) => {
          const sd = new Date(booked.starts_at)
          return sd.getHours() === h && sd.getMinutes() === m
        })
      } else {
        isBooked = isSlotBlockedByBookings(slotStart, slotEnd, bookedSlots, referenceDay)
      }
      slots.push({ time: timeStr, available: !isBooked })
    }
  }
  return slots
}

/**
 * Режим «все мастера»:
 * — яркий слот (available): хотя бы у одного мастера нет пересечения с его записями;
 * — тусклый: у каждого мастера есть пересечение (все заняты одновременно).
 */
export function generateAggregateTimeSlotsOverlap(
  startHour: number,
  endHour: number,
  duration: number,
  staffIds: string[],
  bookedByStaff: Map<string, { starts_at: string; ends_at: string }[]>,
  referenceDay: Date,
): TimeSlot[] {
  const slots: TimeSlot[] = []
  if (staffIds.length === 0) return []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const slotStart = h * 60 + m
      const slotEnd = slotStart + duration
      if (slotEnd > endHour * 60) break
      const allStaffBusy = staffIds.every((id) => {
        const list = bookedByStaff.get(id) ?? []
        return isSlotBlockedByBookings(slotStart, slotEnd, list, referenceDay)
      })
      slots.push({ time: timeStr, available: !allStaffBusy })
    }
  }
  return slots
}

export type BuildBookedIntervalsOptions = {
  /** Суммарные минуты по записи из appointment_services + services; иначе ends_at / +1 ч. */
  durationMinutesByAppointmentId?: Map<string, number>
}

/** Интервалы записей по staff_id: конец = starts_at + duration (приоритет) или валидный ends_at. */
export function buildBookedIntervalsByStaff(
  rows: {
    id: string
    staff_id: string | null
    starts_at: string | null
    ends_at: string | null
  }[],
  staffIds: string[],
  options?: BuildBookedIntervalsOptions,
): Map<string, { starts_at: string; ends_at: string }[]> {
  const map = new Map<string, { starts_at: string; ends_at: string }[]>()
  for (const id of staffIds) {
    map.set(id, [])
  }
  const durMap = options?.durationMinutesByAppointmentId
  for (const row of rows) {
    if (!row.staff_id || !row.starts_at) continue
    if (!map.has(row.staff_id)) continue
    const starts = row.starts_at
    const startMs = new Date(starts).getTime()
    let endsIso: string
    const customDur = durMap?.get(row.id)
    if (customDur != null && customDur > 0) {
      endsIso = new Date(startMs + customDur * 60 * 1000).toISOString()
    } else {
      const endMsRaw = row.ends_at ? new Date(row.ends_at).getTime() : NaN
      if (Number.isFinite(endMsRaw) && endMsRaw > startMs) {
        endsIso = new Date(endMsRaw).toISOString()
      } else {
        endsIso = new Date(startMs + 60 * 60 * 1000).toISOString()
      }
    }
    map.get(row.staff_id)!.push({ starts_at: starts, ends_at: endsIso })
  }
  return map
}
