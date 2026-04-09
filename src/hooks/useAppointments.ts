import { useCallback, useEffect, useState } from 'react'
import { aggregateAppointmentServicesByAppointment } from '@/lib/appointmentServiceAggregates'
import { localDayBoundsFor } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Database } from '@/types/database'

export type AppointmentRow = Database['public']['Tables']['appointments']['Row']

export type AppointmentDayRow = AppointmentRow & {
  staff_name: string | null
  /** Сумма appointment_services.price по записи. */
  amount_kzt: number
  /** Сумма длительностей: services.duration по service_id, иначе duration в строке. */
  duration_minutes: number
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
      const apptIds = rows.map((a) => a.id)
      let aggByAppt = new Map<string, { amountKzt: number; durationMinutes: number }>()

      if (apptIds.length > 0) {
        const { data: svcRows, error: svcErr } = await supabase
          .from('appointment_services')
          .select('appointment_id, price, duration, service_id')
          .in('appointment_id', apptIds)
        if (svcErr) {
          console.warn('[appointments] appointment_services', svcErr)
        } else {
          const lines =
            (svcRows ?? []) as {
              appointment_id: string
              price: number | null
              duration: number | null
              service_id: string | null
            }[]
          const serviceIds = [
            ...new Set(lines.map((r) => r.service_id).filter((id): id is string => Boolean(id))),
          ]
          let serviceDurationById = new Map<string, number>()
          if (serviceIds.length > 0) {
            const { data: catRows, error: catErr } = await supabase
              .from('services')
              .select('id, duration')
              .eq('owner_id', userId)
              .in('id', serviceIds)
            if (catErr) console.warn('[appointments] services durations', catErr)
            serviceDurationById = new Map((catRows ?? []).map((s) => [s.id, Number(s.duration ?? 0)]))
          }
          aggByAppt = aggregateAppointmentServicesByAppointment(lines, serviceDurationById)
        }
      }

      setAppointments(
        rows.map((a) => {
          const agg = aggByAppt.get(a.id)
          return {
            ...a,
            staff_name: a.staff_member_id ? staffById.get(a.staff_member_id) ?? null : null,
            amount_kzt: agg?.amountKzt ?? 0,
            duration_minutes: agg?.durationMinutes ?? 0,
          }
        }),
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
      staff_member_id: string
      title: string
      client_name: string | null
      phone: string | null
      scheduled_at: string
      /** Длина записи в минутах; конец интервала пишется в ends_at (слоты / пересечения). */
      duration_minutes?: number
    }): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      if (!input.staff_member_id?.trim()) return { error: new Error('staff required') }
      const durationMin = Math.max(1, input.duration_minutes ?? 60)
      const startMs = new Date(input.scheduled_at).getTime()
      const endsIso = Number.isNaN(startMs)
        ? null
        : new Date(startMs + durationMin * 60 * 1000).toISOString()
      const { error } = await supabase.from('appointments').insert({
        owner_id: userId,
        staff_member_id: input.staff_member_id.trim(),
        title: input.title.trim() || 'Приём',
        client_name: input.client_name?.trim() || null,
        scheduled_at: input.scheduled_at,
        starts_at: input.scheduled_at,
        ends_at: endsIso,
        status: 'scheduled',
      })
      if (error) return { error: new Error(error.message) }
      const staffName = activeStaff.find((s) => s.id === input.staff_member_id.trim())?.full_name ?? null
      const d = new Date(input.scheduled_at)
      const date = Number.isNaN(d.getTime()) ? input.scheduled_at : d.toISOString().slice(0, 10)
      const time = Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(11, 16)
      void fetch('https://n8n35164.hostkey.in/webhook/appointment-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: input.client_name?.trim() || '',
          phone: input.phone?.trim() || '',
          service: input.title.trim() || 'Приём',
          staff: staffName ?? '',
          date,
          time,
        }),
      }).catch((err) => console.error('Webhook error:', err))
      await load()
      return { error: null }
    },
    [userId, load, activeStaff],
  )

  const updateAppointment = useCallback(
    async (
      id: string,
      patch: Partial<{
        staff_member_id: string | null
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
