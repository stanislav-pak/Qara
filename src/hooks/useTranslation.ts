import { kk } from '@/locales/kk'
import { ru, type TranslationKey } from '@/locales/ru'
import { useLocaleStore } from '@/store/localeStore'

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const dict = locale === 'kk' ? kk : ru

  function t(key: TranslationKey): string {
    return dict[key] ?? ru[key]
  }

  return { t, locale, setLocale }
}

export type { TranslationKey }
