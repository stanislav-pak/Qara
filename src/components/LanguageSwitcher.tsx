import { useTranslation } from '@/hooks/useTranslation'

type Props = {
  className?: string
  compact?: boolean
}

export function LanguageSwitcher({ className = '', compact = false }: Props) {
  const { t, locale, setLocale } = useTranslation()

  const btn = (code: 'ru' | 'kk', label: string) => (
    <button
      type="button"
      onClick={() => setLocale(code)}
      className={[
        'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
        locale === code
          ? 'bg-white/15 text-white'
          : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
      ].join(' ')}
      aria-pressed={locale === code}
    >
      {label}
    </button>
  )

  return (
    <div
      className={[
        'inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-0.5',
        className,
      ].join(' ')}
      role="group"
      aria-label={t('language.switch')}
    >
      {!compact && (
        <span className="hidden pl-2 text-[10px] uppercase tracking-wide text-zinc-600 sm:inline">
          {t('language.switch')}
        </span>
      )}
      {btn('ru', t('language.ru'))}
      {btn('kk', t('language.kk'))}
    </div>
  )
}
