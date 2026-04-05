import { useCallback, useEffect, useState } from 'react'
import { localDayBoundsIso } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export type UpcomingAppointment = {
  id: string
  title: string
  client_name: string | null
  scheduled_at: string
  status: string
  /** Имя мастера из staff_members. */
  staff_name: string | null
  /** Сумма цен услуг записи (appointment_services.price). */
  amount_kzt: number
}

export type OwnerDashboardState = {
  loading: boolean
  appointmentsToday: number
  revenueTodayKzt: number
  activeStaff: number
  /** Записи за скользящие 7 суток (starts_at ≥ now−7d, без отменённых; без starts_at не попадают). */
  appointmentsWeek: number
  /** Сумма appointment_services.price по этим записям. */
  revenueWeekKzt: number
  /** Записи за скользящие 30 суток. */
  appointmentsMonth: number
  revenueMonthKzt: number
  upcoming: UpcomingAppointment[]
  loadError: boolean
}

const MS_DAY = 24 * 60 * 60 * 1000

const initial: OwnerDashboardState = {
  loading: true,
  appointmentsToday: 0,
  revenueTodayKzt: 0,
  activeStaff: 0,
  appointmentsWeek: 0,
  revenueWeekKzt: 0,
  appointmentsMonth: 0,
  revenueMonthKzt: 0,
  upcoming: [],
  loadError: false,
}

export function useOwnerDashboard(): OwnerDashboardState & { refresh: () => void } {
  const userId = useAuthStore((s) => s.user?.id)
  const [state, setState] = useState<OwnerDashboardState>(initial)

  const load = useCallback(async () => {
    if (!userId) {
      setState({ ...initial, loading: false })
      return
    }

    setState((s) => ({ ...s, loading: true, loadError: false }))
    const { start, end } = localDayBoundsIso()
    const nowIso = new Date().toISOString()
    const weekAgoIso = new Date(Date.now() - 7 * MS_DAY).toISOString()
    const monthAgoIso = new Date(Date.now() - 30 * MS_DAY).toISOString()

    try {
      const [apptRes, salesRes, staffRes, upcomingRes, weekApptRes, monthApptRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', userId)
          .gte('scheduled_at', start)
          .lte('scheduled_at', end)
          .neq('status', 'cancelled'),
        supabase
          .from('sales_transactions')
          .select('amount_kzt')
          .eq('owner_id', userId)
          .gte('occurred_at', start)
          .lte('occurred_at', end),
        supabase
          .from('staff_members')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', userId)
          .eq('is_active', true),
        supabase
          .from('appointments')
          .select('id, title, client_name, scheduled_at, status, staff_id')
          .eq('owner_id', userId)
          .gte('scheduled_at', nowIso)
          .neq('status', 'cancelled')
          .order('scheduled_at', { ascending: true })
          .limit(12),
        supabase
          .from('appointments')
          .select('id')
          .eq('owner_id', userId)
          .not('starts_at', 'is', null)
          .gte('starts_at', weekAgoIso)
          .neq('status', 'cancelled'),
        supabase
          .from('appointments')
          .select('id')
          .eq('owner_id', userId)
          .not('starts_at', 'is', null)
          .gte('starts_at', monthAgoIso)
          .neq('status', 'cancelled'),
      ])

      const anyErr =
        apptRes.error ||
        salesRes.error ||
        staffRes.error ||
        upcomingRes.error ||
        weekApptRes.error ||
        monthApptRes.error
      if (anyErr) {
        console.warn('[dashboard]', anyErr)
        setState({
          loading: false,
          appointmentsToday: 0,
          revenueTodayKzt: 0,
          activeStaff: 0,
          appointmentsWeek: 0,
          revenueWeekKzt: 0,
          appointmentsMonth: 0,
          revenueMonthKzt: 0,
          upcoming: [],
          loadError: true,
        })
        return
      }

      const revenue =
        salesRes.data?.reduce((sum, row) => sum + Number(row.amount_kzt ?? 0), 0) ?? 0

      const baseUpcoming = (upcomingRes.data ?? []) as {
        id: string
        title: string
        client_name: string | null
        scheduled_at: string
        status: string
        staff_id: string | null
      }[]

      let upcoming: UpcomingAppointment[] = baseUpcoming.map((r) => ({
        id: r.id,
        title: r.title,
        client_name: r.client_name,
        scheduled_at: r.scheduled_at,
        status: r.status,
        staff_name: null,
        amount_kzt: 0,
      }))

      if (baseUpcoming.length > 0) {
        const apptIds = baseUpcoming.map((r) => r.id)
        const staffIds = [
          ...new Set(baseUpcoming.map((r) => r.staff_id).filter((id): id is string => Boolean(id))),
        ]

        const staffQuery =
          staffIds.length > 0
            ? supabase
                .from('staff_members')
                .select('id, full_name')
                .eq('owner_id', userId)
                .in('id', staffIds)
            : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null })

        const [staffPick, svcPick] = await Promise.all([
          staffQuery,
          supabase.from('appointment_services').select('appointment_id, price').in('appointment_id', apptIds),
        ])

        if (staffPick.error) console.warn('[dashboard] staff names', staffPick.error)
        if (svcPick.error) console.warn('[dashboard] appointment_services', svcPick.error)

        const staffMap = new Map((staffPick.data ?? []).map((s) => [s.id, s.full_name]))
        const amountByAppt = new Map<string, number>()
        for (const row of svcPick.data ?? []) {
          const aid = row.appointment_id
          amountByAppt.set(aid, (amountByAppt.get(aid) ?? 0) + Number(row.price ?? 0))
        }

        upcoming = baseUpcoming.map((r) => ({
          id: r.id,
          title: r.title,
          client_name: r.client_name,
          scheduled_at: r.scheduled_at,
          status: r.status,
          staff_name: r.staff_id ? staffMap.get(r.staff_id) ?? null : null,
          amount_kzt: amountByAppt.get(r.id) ?? 0,
        }))
      }

      const weekIds = (weekApptRes.data ?? []).map((r) => r.id)
      const monthIds = (monthApptRes.data ?? []).map((r) => r.id)
      const appointmentsWeek = weekIds.length
      const appointmentsMonth = monthIds.length
      const unionIds = [...new Set([...weekIds, ...monthIds])]

      let revenueWeekKzt = 0
      let revenueMonthKzt = 0
      if (unionIds.length > 0) {
        const { data: svcRows, error: svcErr } = await supabase
          .from('appointment_services')
          .select('appointment_id, price')
          .in('appointment_id', unionIds)
        if (svcErr) {
          console.warn('[dashboard] period appointment_services', svcErr)
          setState({
            loading: false,
            appointmentsToday: apptRes.count ?? 0,
            revenueTodayKzt: revenue,
            activeStaff: staffRes.count ?? 0,
            appointmentsWeek,
            revenueWeekKzt: 0,
            appointmentsMonth,
            revenueMonthKzt: 0,
            upcoming,
            loadError: true,
          })
          return
        }
        const weekSet = new Set(weekIds)
        const monthSet = new Set(monthIds)
        for (const row of svcRows ?? []) {
          const aid = row.appointment_id
          if (!aid) continue
          const p = Number(row.price ?? 0)
          if (weekSet.has(aid)) revenueWeekKzt += p
          if (monthSet.has(aid)) revenueMonthKzt += p
        }
      }

      setState({
        loading: false,
        appointmentsToday: apptRes.count ?? 0,
        revenueTodayKzt: revenue,
        activeStaff: staffRes.count ?? 0,
        appointmentsWeek,
        revenueWeekKzt,
        appointmentsMonth,
        revenueMonthKzt,
        upcoming,
        loadError: false,
      })
    } catch (e) {
      console.warn('[dashboard]', e)
      setState({
        loading: false,
        appointmentsToday: 0,
        revenueTodayKzt: 0,
        activeStaff: 0,
        appointmentsWeek: 0,
        revenueWeekKzt: 0,
        appointmentsMonth: 0,
        revenueMonthKzt: 0,
        upcoming: [],
        loadError: true,
      })
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, refresh: load }
}
