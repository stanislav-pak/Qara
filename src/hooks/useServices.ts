import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Database } from '@/types/database'

export type ServiceRow = Database['public']['Tables']['services']['Row']

const DEFAULT_CATEGORY = 'general'

export function useServices() {
  const userId = useAuthStore((s) => s.user?.id)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    if (!userId) {
      setServices([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(false)

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('owner_id', userId)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      console.warn('[services]', error)
      setServices([])
      setLoadError(true)
    } else {
      setServices((data ?? []) as ServiceRow[])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const createService = useCallback(
    async (input: {
      name: string
      price: number
      duration: number
    }): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      const name = input.name.trim()
      if (!name) return { error: new Error('empty name') }
      if (!Number.isFinite(input.price) || input.price < 0) {
        return { error: new Error('invalid price') }
      }
      if (!Number.isFinite(input.duration) || input.duration < 1) {
        return { error: new Error('invalid duration') }
      }

      const { error } = await supabase.from('services').insert({
        owner_id: userId,
        name,
        price: input.price,
        duration: Math.round(input.duration),
        category: DEFAULT_CATEGORY,
        is_active: true,
      })
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  const updateService = useCallback(
    async (
      id: string,
      patch: Partial<{ name: string; price: number; duration: number; is_active: boolean }>,
    ): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      const { error } = await supabase.from('services').update(patch).eq('id', id).eq('owner_id', userId)
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  return {
    services,
    loading,
    loadError,
    refresh: load,
    createService,
    updateService,
  }
}
