import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Database } from '@/types/database'

type AppointmentRow = Database['public']['Tables']['appointments']['Row']

export type ActiveStaffFilterOption = { id: string; full_name: string }

export type AppointmentHistoryRow = {
  id: string
  scheduled_at: string
  status: string
  title: string
  client_display: string
  staff_name: string | null
  amount_kzt: number
}

const FETCH_LIMIT = 2000

/**
 * Загрузка appointments + данные clients / staff_members / суммы appointment_services
 * (эквивалент join в одном запросе к PostgREST).
 */
export function useAppointmentHistory(
  staffId: string,
  status: string,
  dateFrom: string,
  dateTo: string,
) {
  const userId = useAuthStore((s) => s.user?.id)
  const [rows, setRows] = useState<AppointmentHistoryRow[]>([])
  const [activeStaff, setActiveStaff] = useState<ActiveStaffFilterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const loadStaffOptions = useCallback(async () => {
    if (!userId) {
      setActiveStaff([])
      return
    }
    const { data, error } = await supabase
      .from('staff_members')
      .select('id, full_name')
      .eq('owner_id', userId)
      .eq('is_active', true)
      .order('full_name')
    if (error) {
      console.warn('[history] staff filter', error)
      setActiveStaff([])
      return
    }
    setActiveStaff((data ?? []) as ActiveStaffFilterOption[])
  }, [userId])

  const loadHistory = useCallback(async () => {
    if (!userId) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(false)

    let q = supabase
      .from('appointments')
      .select('*')
      .eq('owner_id', userId)
      .order('scheduled_at', { ascending: false })
      .limit(FETCH_LIMIT)

    if (staffId.trim()) {
      q = q.eq('staff_id', staffId.trim())
    }
    if (status.trim()) {
      q = q.eq('status', status.trim())
    }
    if (dateFrom.trim()) {
      const [y, m, d] = dateFrom.split('-').map(Number)
      const start = new Date(y, m - 1, d, 0, 0, 0, 0)
      q = q.gte('scheduled_at', start.toISOString())
    }
    if (dateTo.trim()) {
      const [y, m, d] = dateTo.split('-').map(Number)
      const end = new Date(y, m - 1, d, 23, 59, 59, 999)
      q = q.lte('scheduled_at', end.toISOString())
    }

    const { data: appts, error } = await q

    if (error) {
      console.warn('[history]', error)
      setRows([])
      setLoadError(true)
      setLoading(false)
      return
    }

    const list = (appts ?? []) as AppointmentRow[]
    if (list.length === 0) {
      setRows([])
      setLoadError(false)
      setLoading(false)
      return
    }

    const clientIds = [...new Set(list.map((a) => a.client_id).filter((id): id is string => Boolean(id)))]
    const staffIds = [...new Set(list.map((a) => a.staff_id).filter((id): id is string => Boolean(id)))]
    const apptIds = list.map((a) => a.id)

    const [clientsRes, staffRes, svcRes] = await Promise.all([
      clientIds.length
        ? supabase.from('clients').select('id, full_name').eq('owner_id', userId).in('id', clientIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
      staffIds.length
        ? supabase.from('staff_members').select('id, full_name').eq('owner_id', userId).in('id', staffIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
      supabase.from('appointment_services').select('appointment_id, price').in('appointment_id', apptIds),
    ])

    if (clientsRes.error) console.warn('[history] clients', clientsRes.error)
    if (staffRes.error) console.warn('[history] staff_members', staffRes.error)
    if (svcRes.error) console.warn('[history] appointment_services', svcRes.error)

    const clientMap = new Map((clientsRes.data ?? []).map((c) => [c.id, c.full_name]))
    const staffMap = new Map((staffRes.data ?? []).map((s) => [s.id, s.full_name]))

    const amountByAppt = new Map<string, number>()
    for (const r of svcRes.data ?? []) {
      const aid = r.appointment_id
      amountByAppt.set(aid, (amountByAppt.get(aid) ?? 0) + Number(r.price ?? 0))
    }

    const enriched: AppointmentHistoryRow[] = list.map((a) => {
      const fromClient = a.client_id ? clientMap.get(a.client_id) : undefined
      const client_display = (fromClient?.trim() || a.client_name?.trim() || '—') as string
      const staff_name = a.staff_id ? staffMap.get(a.staff_id) ?? null : null

      return {
        id: a.id,
        scheduled_at: a.scheduled_at,
        status: a.status,
        title: a.title?.trim() || '—',
        client_display,
        staff_name,
        amount_kzt: amountByAppt.get(a.id) ?? 0,
      }
    })

    setRows(enriched)
    setLoadError(false)
    setLoading(false)
  }, [userId, staffId, status, dateFrom, dateTo])

  useEffect(() => {
    void loadStaffOptions()
  }, [loadStaffOptions])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  return {
    rows,
    activeStaff,
    loading,
    loadError,
    refresh: loadHistory,
    refreshStaff: loadStaffOptions,
  }
}
