/** Күннің басы/соңы Алматы уақыты бойынша (ISO +05:00). */
export function localDayBoundsIso(): { start: string; end: string } {
  return localDayBoundsFor(new Date())
}

/** Ағымдағы ай (немесе reference) — [00:00 1-ші күн .. 23:59:59.999 соңғы күн] жергілікті уақыт. */
export function localMonthBoundsIso(reference: Date = new Date()): { start: string; end: string } {
  const y = reference.getFullYear()
  const m = reference.getMonth()
  const start = new Date(y, m, 1, 0, 0, 0, 0)
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** `<input type="date" />` мәнінен occurred_at үшін ISO (тұрақты уақыт — түс локалды). */
export function dateInputLocalToIsoMidday(value: string): string {
  const [ys, ms, ds] = value.split('-')
  const y = Number(ys)
  const mo = Number(ms)
  const d = Number(ds)
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return new Date().toISOString()
  }
  return new Date(y, mo - 1, d, 12, 0, 0, 0).toISOString()
}

/** Белгілі бір күн үшін [00:00 .. 23:59:59] Алматы уақыты бойынша (UTC+5), ISO offset +05:00. */
export function localDayBoundsFor(date: Date): { start: string; end: string } {
  const almatyOffset = 5 * 60 * 60 * 1000
  const localDate = new Date(date.getTime() + almatyOffset)
  const ymd = localDate.toISOString().slice(0, 10)
  return {
    start: `${ymd}T00:00:00+05:00`,
    end: `${ymd}T23:59:59+05:00`,
  }
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

/** «2 000 ₸ · 30 мин» — цена и суммарная длительность услуг записи. */
export function formatKztDurationLine(
  amountKzt: number,
  durationMinutes: number,
  localeTag: string,
  emptyDash = '—',
): string {
  const pricePart = amountKzt > 0 ? formatKztSpaced(amountKzt, localeTag) : emptyDash
  const durPart = durationMinutes > 0 ? `${durationMinutes} мин` : null
  if (durPart) return `${pricePart} · ${durPart}`
  return pricePart
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

/** Алматы (Asia/Almaty, UTC+5): DD.MM.YYYY HH:mm:ss */
export function formatAlmatyClock(d: Date): string {
  const s = d.toLocaleString('sv-SE', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = s.split(' ')
  const datePart = parts[0] ?? ''
  const timePart = parts[1] ?? ''
  const [y, mo, day] = datePart.split('-')
  if (!y || !mo || !day) return s
  return `${day}.${mo}.${y} ${timePart}`
}
