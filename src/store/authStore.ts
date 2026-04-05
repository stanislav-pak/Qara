import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/safe-storage'

export type AuthUserSnapshot = { id: string; email: string | undefined } | null

type AuthState = {
  user: AuthUserSnapshot
  setUser: (user: AuthUserSnapshot) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clear: () => set({ user: null }),
    }),
    {
      name: 'qara-auth',
      partialize: (state) => ({ user: state.user }),
      storage: createJSONStorage(() => safeLocalStorage),
    },
  ),
)
