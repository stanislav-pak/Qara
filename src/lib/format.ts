/** Күннің басы/соңы жергілікті уақыт бойынша (ISO). */
export function localDayBoundsIso(): { start: string; end: string } {
  return localDayBoundsFor(new Date())
}

/** Белгілі бір күн үшін [00:00 .. 23:59:59.999] жергілікті уақыт. */
export function localDayBoundsFor(day: Date): { start: string; end: string } {
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(day)
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function formatKzt(amount: number, localeTag: string): string {
  return new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: 'KZT',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(Math.round(amount))
}

/** «3 500 ₸» — с пробелом-разделителем тысяч и символом тенге. */
export function formatKztSpaced(amount: number, localeTag: string): string {
  const n = Math.round(amount)
  const formatted = new Intl.NumberFormat(localeTag, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(n)
  return `${formatted.replace(/\u00a0/g, ' ')} ₸`
}

export function formatLocaleDateLong(date: Date, localeTag: string): string {
  return new Intl.DateTimeFormat(localeTag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export function formatAppointmentSlot(iso: string, localeTag: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'short' }).format(d),
    time: new Intl.DateTimeFormat(localeTag, { hour: '2-digit', minute: '2-digit' }).format(d),
  }
}

/** KZ/RU мобильный: +7 777 123 45 67. Пустое или нестандартное — null или исходная строка без лишних пробелов. */
export function formatKzPhoneDisplay(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  let d = trimmed.replace(/\D/g, '')
  if (d.length === 0) return trimmed
  if (d.startsWith('8') && d.length === 11) d = `7${d.slice(1)}`
  if (d.length === 10) d = `7${d}`
  if (d.length === 11 && d.startsWith('7')) {
    const rest = d.slice(1)
    return `+7 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 8)} ${rest.slice(8, 10)}`
  }
  return trimmed
}

/** Дата и время для списка истории записей. */
export function formatHistoryDateTime(iso: string, localeTag: string): string {
  return new Intl.DateTimeFormat(localeTag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function localeTagFromAppLocale(locale: 'ru' | 'kk'): string {
  return locale === 'kk' ? 'kk-KZ' : 'ru-RU'
}

/** `<input type="date" />` үшін жергілікті күн мәнін (YYYY-MM-DD). */
export function formatDateInputLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** `<input type="datetime-local" />` үшін ISO → жергілікті мән. */
export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local мәнін Supabase timestamptz үшін ISO-ға. */
export function datetimeLocalValueToIso(value: string): string {
  return new Date(value).toISOString()
}

/** Жаңа жазба үшін әдепкі уақыт: таңдалған күнде 10:00, бүгін болса және өткен болса — ~+30 мин. */
export function defaultDatetimeLocalForSelectedDay(selectedDate: Date): string {
  const proposed = new Date(selectedDate)
  proposed.setHours(10, 0, 0, 0)
  const now = new Date()
  const isToday = formatDateInputLocal(now) === formatDateInputLocal(selectedDate)
  if (isToday && proposed <= now) {
    const t = new Date(now)
    t.setMinutes(t.getMinutes() + 30, 0, 0)
    return isoToDatetimeLocalValue(t.toISOString())
  }
  return isoToDatetimeLocalValue(proposed.toISOString())
}
