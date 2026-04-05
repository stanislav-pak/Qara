/** Первые два символа имени (графемы), верхний регистр — напр. «Барбер1» → «БА». */
export function staffInitialsFromName(fullName: string): string {
  const t = fullName.trim()
  if (!t) return '?'
  const chars = [...t].slice(0, 2)
  return chars.join('').toUpperCase()
}

/** Детерминированный цвет фона аватара из строки имени (HSL, тёмный фон + белый текст). */
export function staffAvatarBackgroundColor(fullName: string): string {
  const s = fullName.trim() || ' '
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  const hue = h % 360
  return `hsl(${hue} 52% 36%)`
}
