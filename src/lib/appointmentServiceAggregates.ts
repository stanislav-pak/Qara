/** Строки appointment_services для суммирования цены и длительности по записи. */
export type AppointmentServiceLine = {
  appointment_id: string
  price: number | null
  /** Минуты в строке записи (снимок при бронировании). */
  duration: number | null
  service_id: string | null
}

/**
 * Суммы по записи: цена — сумма price; длительность — для строк с service_id берётся
 * duration из каталога services, иначе — поле duration строки.
 */
export function aggregateAppointmentServicesByAppointment(
  rows: AppointmentServiceLine[],
  serviceDurationById: Map<string, number>,
): Map<string, { amountKzt: number; durationMinutes: number }> {
  const out = new Map<string, { amountKzt: number; durationMinutes: number }>()
  for (const row of rows) {
    const aid = row.appointment_id
    if (!aid) continue
    const amt = Number(row.price ?? 0)
    const sid = row.service_id
    let durMin = 0
    if (sid && serviceDurationById.has(sid)) {
      durMin = Math.max(0, Math.round(Number(serviceDurationById.get(sid) ?? 0)))
    } else {
      durMin = Math.max(0, Math.round(Number(row.duration ?? 0)))
    }
    const prev = out.get(aid) ?? { amountKzt: 0, durationMinutes: 0 }
    prev.amountKzt += amt
    prev.durationMinutes += durMin
    out.set(aid, prev)
  }
  return out
}
