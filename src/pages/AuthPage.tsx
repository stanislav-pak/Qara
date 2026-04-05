import { type FormEvent, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useTranslation } from '@/hooks/useTranslation'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

type Mode = 'login' | 'register'

export function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const ready = useAuthReady()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!isSupabaseConfigured) {
      setError(t('auth.errorMissingEnv'))
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signErr) throw signErr
        navigate(from, { replace: true })
      } else {
        const { error: signErr } = await supabase.auth.signUp({ email, password })
        if (signErr) throw signErr
        setMessage(t('auth.verifyEmailMessage'))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.errorGeneric')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-red-500"
          aria-hidden
        />
      </div>
    )
  }

  if (user) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-8">
        <LanguageSwitcher />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgb(232 33 39 / 0.15), transparent 45%)',
        }}
      />

      <div className="relative w-full max-w-[400px]">
        <div className="mb-10 text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-2xl font-semibold tracking-tight text-white">Qara</span>
            <span className="text-xs text-zinc-500">{t('auth.brandTagline')}</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-glow)] sm:p-8">
          <div className="mb-6 flex rounded-xl bg-black/40 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setPasswordVisible(false)
                setError(null)
                setMessage(null)
              }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('auth.loginTab')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setPasswordVisible(false)
                setError(null)
                setMessage(null)
              }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t('auth.registerTab')}
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-zinc-400">
                {t('auth.emailLabel')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-0 transition-[border,box-shadow] placeholder:text-zinc-600 focus:border-red-500/50 focus:shadow-[0_0_0_3px_rgb(232_33_39_/_0.15)]"
                placeholder="you@company.kz"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-zinc-400">
                {t('auth.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-4 pr-12 text-sm text-white outline-none transition-[border,box-shadow] placeholder:text-zinc-600 focus:border-red-500/50 focus:shadow-[0_0_0_3px_rgb(232_33_39_/_0.15)]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                  aria-label={passwordVisible ? t('auth.passwordHide') : t('auth.passwordShow')}
                >
                  {passwordVisible ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-red-600 to-red-700 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:from-red-500 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t('auth.wait')}
                </span>
              ) : mode === 'login' ? (
                t('auth.submitLogin')
              ) : (
                t('auth.submitRegister')
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">{t('auth.footerModules')}</p>
      </div>
    </div>
  )
}
