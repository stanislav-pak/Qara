import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Database } from '@/types/database'

export type StaffMemberRow = Database['public']['Tables']['staff_members']['Row']

export function useStaffMembers() {
  const userId = useAuthStore((s) => s.user?.id)
  const [staff, setStaff] = useState<StaffMemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    if (!userId) {
      setStaff([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(false)

    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('owner_id', userId)
      .order('is_active', { ascending: false })
      .order('full_name', { ascending: true })

    if (error) {
      console.warn('[staff]', error)
      setStaff([])
      setLoadError(true)
    } else {
      setStaff((data ?? []) as StaffMemberRow[])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const createMember = useCallback(
    async (input: {
      full_name: string
      specialty?: string
      is_active?: boolean
    }): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      const name = input.full_name.trim()
      if (!name) return { error: new Error('empty name') }

      const { error } = await supabase.from('staff_members').insert({
        owner_id: userId,
        full_name: name,
        specialty: input.specialty?.trim() ?? '',
        is_active: input.is_active ?? true,
      })
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  const updateMember = useCallback(
    async (
      id: string,
      patch: Partial<{ full_name: string; specialty: string; is_active: boolean }>,
    ): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      const { error } = await supabase.from('staff_members').update(patch).eq('id', id).eq('owner_id', userId)
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  return {
    staff,
    loading,
    loadError,
    refresh: load,
    createMember,
    updateMember,
  }
}
