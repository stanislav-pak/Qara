import { useEffect } from 'react'
import { useLocaleStore } from '@/store/localeStore'

/** <html lang> синхрондау (i18n + screen readers). */
export function DocumentLang() {
  const locale = useLocaleStore((s) => s.locale)

  useEffect(() => {
    document.documentElement.lang = locale === 'kk' ? 'kk' : 'ru'
  }, [locale])

  return null
}
