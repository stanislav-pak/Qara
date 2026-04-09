/** Слоты дня с шагом 30 мин (как в онлайн-бронировании). */
export type TimeSlot = {
  time: string
  available: boolean
}

/**
 * `intervalOverlap` — слот занят, если интервал [slot, slot+duration) пересекается с [starts_at, ends_at] (онлайн-бронь).
 * `exactStart` — слот занят только если локальное время starts_at существующей записи совпадает с началом слота (календарь админки).
 */
export type TimeSlotConflictMode = 'intervalOverlap' | 'exactStart'

/**
 * Генерирует слоты с startHour по endHour, шаг 30 мин.
 * duration — длительность новой записи в минутах; при intervalOverlap — проверка пересечений.
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
        isBooked = bookedSlots.some((booked) => {
          const bStart = new Date(booked.starts_at)
          const bEnd = new Date(booked.ends_at)
          const bStartMin = bStart.getHours() * 60 + bStart.getMinutes()
          const bEndMin = bEnd.getHours() * 60 + bEnd.getMinutes()
          return slotStart < bEndMin && slotEnd > bStartMin
        })
      }
      slots.push({ time: timeStr, available: !isBooked })
    }
  }
  return slots
}

/** По каждому мастеру занятость = точное совпадение HH:MM со starts_at; слот доступен, если хотя бы у одного мастера время свободно. */
export function generateAggregateTimeSlotsExactStart(
  startHour: number,
  endHour: number,
  duration: number,
  staffIds: string[],
  bookedStartTimeByStaffId: Map<string, Set<string>>,
): TimeSlot[] {
  const slots: TimeSlot[] = []
  if (staffIds.length === 0) return []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const slotStart = h * 60 + m
      const slotEnd = slotStart + duration
      if (slotEnd > endHour * 60) break
      const anyFree = staffIds.some((id) => !bookedStartTimeByStaffId.get(id)?.has(timeStr))
      slots.push({ time: timeStr, available: anyFree })
    }
  }
  return slots
}

/** Локальные времена начала записей (HH:MM) по staff_id для exactStart. */
export function buildBookedStartTimesByStaff(
  rows: { staff_id: string | null; starts_at: string | null }[],
  staffIds: string[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const id of staffIds) {
    map.set(id, new Set())
  }
  for (const row of rows) {
    if (!row.staff_id || !row.starts_at) continue
    if (!map.has(row.staff_id)) continue
    const d = new Date(row.starts_at)
    const key = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    map.get(row.staff_id)!.add(key)
  }
  return map
}
