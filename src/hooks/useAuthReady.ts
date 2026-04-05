import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Бірінші auth сессия тексерілгенше күту (жылжуды болдырмау). */
export function useAuthReady() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().finally(() => {
      setReady(true)
    })
  }, [])

  return ready
}
