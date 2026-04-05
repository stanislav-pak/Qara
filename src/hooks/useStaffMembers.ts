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
      patch: Partial<{
        full_name: string
        specialty: string
        is_active: boolean
        avatar_url: string | null
      }>,
    ): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      const { error } = await supabase.from('staff_members').update(patch).eq('id', id).eq('owner_id', userId)
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  const uploadStaffAvatar = useCallback(
    async (staffId: string, file: File): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowed.includes(file.type)) {
        return { error: new Error('unsupported image type') }
      }
      if (file.size > 2 * 1024 * 1024) {
        return { error: new Error('file too large') }
      }
      const path = `${userId}/${staffId}`
      const { error: upErr } = await supabase.storage
        .from('staff-avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) return { error: new Error(upErr.message) }
      const { data: pub } = supabase.storage.from('staff-avatars').getPublicUrl(path)
      const base = pub.publicUrl
      const bust = base.includes('?') ? '&' : '?'
      const publicUrl = `${base}${bust}v=${Date.now()}`
      return updateMember(staffId, { avatar_url: publicUrl })
    },
    [userId, updateMember],
  )

  return {
    staff,
    loading,
    loadError,
    refresh: load,
    createMember,
    updateMember,
    uploadStaffAvatar,
  }
}
