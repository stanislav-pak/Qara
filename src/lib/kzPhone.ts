/** KZ/RU mobile: 10 digits after +7; stored as +7XXXXXXXXXX. */
export function digitsToE164Plus7(digits: string): string | null {
  const d = digits.replace(/\D/g, '').slice(0, 10)
  return d.length === 10 ? `+7${d}` : null
}
