/** Слоты дня с шагом 30 мин (как в онлайн-бронировании). */
export type TimeSlot = {
  time: string
  available: boolean
}

/**
 * Генерирует слоты с startHour по endHour, шаг 30 мин.
 * duration — длительность новой записи в минутах; занятость считается по пересечению интервалов.
 */
export function generateTimeSlots(
  startHour: number,
  endHour: number,
  duration: number,
  bookedSlots: { starts_at: string; ends_at: string }[],
): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const slotStart = h * 60 + m
      const slotEnd = slotStart + duration
      if (slotEnd > endHour * 60) break
      const isBooked = bookedSlots.some((booked) => {
        const bStart = new Date(booked.starts_at)
        const bEnd = new Date(booked.ends_at)
        const bStartMin = bStart.getHours() * 60 + bStart.getMinutes()
        const bEndMin = bEnd.getHours() * 60 + bEnd.getMinutes()
        return slotStart < bEndMin && slotEnd > bStartMin
      })
      slots.push({ time: timeStr, available: !isBooked })
    }
  }
  return slots
}
