import { Navigate, useLocation } from 'react-router-dom'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useTranslation } from '@/hooks/useTranslation'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

type Props = {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: Props) {
  const location = useLocation()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const ready = useAuthReady()

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
        <p className="text-center text-sm text-zinc-400">
          {t('protectedRoute.missingEnvPrefix')}
          <code className="text-zinc-300">.env</code>
          {t('protectedRoute.missingEnvSuffix')}
        </p>
      </div>
    )
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

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return <>{children}</>
}
