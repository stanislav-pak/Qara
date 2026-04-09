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

/** Пересечение интервалов в минутах от полуночи (локальное время), как в BookingPage. */
export function isSlotBlockedByBookings(
  slotStartMin: number,
  slotEndMin: number,
  booked: { starts_at: string; ends_at: string }[],
): boolean {
  return booked.some((bookedRow) => {
    const bStart = new Date(bookedRow.starts_at)
    const bEnd = new Date(bookedRow.ends_at)
    const bStartMin = bStart.getHours() * 60 + bStart.getMinutes()
    const bEndMin = bEnd.getHours() * 60 + bEnd.getMinutes()
    return slotStartMin < bEndMin && slotEndMin > bStartMin
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
        isBooked = isSlotBlockedByBookings(slotStart, slotEnd, bookedSlots)
      }
      slots.push({ time: timeStr, available: !isBooked })
    }
  }
  return slots
}

/** Режим «все мастера»: слот доступен, если хотя бы у одного мастера нет пересечения с его записями (длительность новой записи учитывается). */
export function generateAggregateTimeSlotsOverlap(
  startHour: number,
  endHour: number,
  duration: number,
  staffIds: string[],
  bookedByStaff: Map<string, { starts_at: string; ends_at: string }[]>,
): TimeSlot[] {
  const slots: TimeSlot[] = []
  if (staffIds.length === 0) return []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const slotStart = h * 60 + m
      const slotEnd = slotStart + duration
      if (slotEnd > endHour * 60) break
      const anyFree = staffIds.some((id) => {
        const list = bookedByStaff.get(id) ?? []
        return !isSlotBlockedByBookings(slotStart, slotEnd, list)
      })
      slots.push({ time: timeStr, available: anyFree })
    }
  }
  return slots
}

/** Интервалы записей по staff_id (ends_at подставляется, если в БД пусто). */
export function buildBookedIntervalsByStaff(
  rows: { staff_id: string | null; starts_at: string | null; ends_at: string | null }[],
  staffIds: string[],
): Map<string, { starts_at: string; ends_at: string }[]> {
  const map = new Map<string, { starts_at: string; ends_at: string }[]>()
  for (const id of staffIds) {
    map.set(id, [])
  }
  for (const row of rows) {
    if (!row.staff_id || !row.starts_at) continue
    if (!map.has(row.staff_id)) continue
    const starts = row.starts_at
    const ends =
      row.ends_at ??
      new Date(new Date(starts).getTime() + 60 * 60 * 1000).toISOString()
    map.get(row.staff_id)!.push({ starts_at: starts, ends_at: ends })
  }
  return map
}
