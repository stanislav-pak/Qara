import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

/** Supabase сессиясын Zustand-пен синхрондау (persist middleware-пен үйлесімді). */
export function initAuthListener(): () => void {
  const applySession = () => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const { setUser, clear } = useAuthStore.getState()
      const u = session?.user
      if (u) {
        setUser({ id: u.id, email: u.email })
      } else {
        clear()
      }
    })
  }

  applySession()

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    const { setUser, clear } = useAuthStore.getState()
    const u = session?.user
    if (u) {
      setUser({ id: u.id, email: u.email })
    } else {
      clear()
    }
  })

  return () => subscription.unsubscribe()
}
