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
