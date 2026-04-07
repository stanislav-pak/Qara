import { useCallback, useEffect, useState } from 'react'
import { localDayBoundsFor } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Database } from '@/types/database'

export type AppointmentRow = Database['public']['Tables']['appointments']['Row']

export type AppointmentDayRow = AppointmentRow & {
  staff_name: string | null
}

export type ActiveStaffOption = { id: string; full_name: string }

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export function useAppointments() {
  const userId = useAuthStore((s) => s.user?.id)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [appointments, setAppointments] = useState<AppointmentDayRow[]>([])
  const [activeStaff, setActiveStaff] = useState<ActiveStaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    if (!userId) {
      setAppointments([])
      setActiveStaff([])
      setLoading(false)
      return
    }

    const { start, end } = localDayBoundsFor(selectedDate)
    setLoading(true)
    setLoadError(false)

    const [apptRes, staffRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('*')
        .eq('owner_id', userId)
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('staff_members')
        .select('id, full_name')
        .eq('owner_id', userId)
        .eq('is_active', true)
        .order('full_name'),
    ])

    if (staffRes.error) {
      console.warn('[appointments] staff list', staffRes.error)
    }
    const staffList = (staffRes.data ?? []) as ActiveStaffOption[]
    setActiveStaff(staffList)
    const staffById = new Map(staffList.map((s) => [s.id, s.full_name]))

    if (apptRes.error) {
      console.warn('[appointments]', apptRes.error)
      setAppointments([])
      setLoadError(true)
    } else {
      const rows = (apptRes.data ?? []) as AppointmentRow[]
      setAppointments(
        rows.map((a) => ({
          ...a,
          staff_name: a.staff_id ? staffById.get(a.staff_id) ?? null : null,
        })),
      )
      setLoadError(false)
    }
    setLoading(false)
  }, [userId, selectedDate])

  useEffect(() => {
    void load()
  }, [load])

  const goPrevDay = useCallback(() => {
    setSelectedDate((d) => {
      const n = new Date(d)
      n.setDate(n.getDate() - 1)
      return n
    })
  }, [])

  const goNextDay = useCallback(() => {
    setSelectedDate((d) => {
      const n = new Date(d)
      n.setDate(n.getDate() + 1)
      return n
    })
  }, [])

  const createAppointment = useCallback(
    async (input: {
      staff_id: string
      title: string
      client_name: string | null
      scheduled_at: string
    }): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      if (!input.staff_id?.trim()) return { error: new Error('staff required') }
      const { error } = await supabase.from('appointments').insert({
        owner_id: userId,
        staff_id: input.staff_id.trim(),
        title: input.title.trim() || 'Приём',
        client_name: input.client_name?.trim() || null,
        scheduled_at: input.scheduled_at,
        starts_at: input.scheduled_at,
        status: 'scheduled',
      })
      if (error) return { error: new Error(error.message) }
      const staffName = activeStaff.find((s) => s.id === input.staff_id.trim())?.full_name ?? null
      const d = new Date(input.scheduled_at)
      const date = Number.isNaN(d.getTime()) ? input.scheduled_at : d.toISOString().slice(0, 10)
      const time = Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(11, 16)
      await fetch('https://n8n35164.hostkey.in/webhook/appointment-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: input.client_name?.trim() || '',
          phone: null,
          service: input.title.trim() || 'Приём',
          staff: staffName,
          date,
          time,
        }),
      })
      await load()
      return { error: null }
    },
    [userId, load, activeStaff],
  )

  const updateAppointment = useCallback(
    async (
      id: string,
      patch: Partial<{
        staff_id: string | null
        title: string
        client_name: string | null
        scheduled_at: string
        starts_at: string | null
        status: AppointmentStatus
      }>,
    ): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      const body: Database['public']['Tables']['appointments']['Update'] = { ...patch }
      if (patch.scheduled_at !== undefined) {
        body.starts_at = patch.scheduled_at
      }
      const { error } = await supabase.from('appointments').update(body).eq('id', id).eq('owner_id', userId)
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  const deleteAppointment = useCallback(
    async (id: string): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      const { error } = await supabase.from('appointments').delete().eq('id', id).eq('owner_id', userId)
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  return {
    selectedDate,
    setSelectedDate,
    goPrevDay,
    goNextDay,
    appointments,
    activeStaff,
    loading,
    loadError,
    refresh: load,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  }
}
