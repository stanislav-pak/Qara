import { useCallback, useEffect, useState } from 'react'
import { aggregateAppointmentServicesByAppointment } from '@/lib/appointmentServiceAggregates'
import { formatDateInputLocal, localDayBoundsIso } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export type RevenueChartDay = {
  /** Локальная дата YYYY-MM-DD. */
  dateKey: string
  totalKzt: number
}

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
  /** Сумма длительностей: services.duration по service_id, иначе duration в строке. */
  duration_minutes: number
}

export type OwnerDashboardState = {
  loading: boolean
  appointmentsToday: number
  revenueTodayKzt: number
  activeStaff: number
  /** Прошедшие записи за 7 суток (starts_at в окне и < сейчас, без отменённых). */
  appointmentsWeek: number
  /** Сумма appointment_services.price по этим записям. */
  revenueWeekKzt: number
  /** Прошедшие записи за 30 суток (starts_at в окне и < сейчас). */
  appointmentsMonth: number
  revenueMonthKzt: number
  /** Выручка по календарным дням: услуги (starts_at) + sales_transactions (occurred_at). */
  revenueChart30d: RevenueChartDay[]
  upcoming: UpcomingAppointment[]
  loadError: boolean
}

const MS_DAY = 24 * 60 * 60 * 1000

function buildRevenueChart30d(
  chartAppts: { id: string; starts_at: string }[],
  svcRows: { appointment_id: string; price: number | null }[] | null | undefined,
  salesRows: { occurred_at: string; amount_kzt: number | null }[] | null | undefined,
  chartStart: Date,
): RevenueChartDay[] {
  const byDay = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(chartStart)
    d.setDate(chartStart.getDate() + i)
    byDay.set(formatDateInputLocal(d), 0)
  }
  const startsById = new Map(chartAppts.map((a) => [a.id, a.starts_at]))
  for (const row of svcRows ?? []) {
    const iso = startsById.get(row.appointment_id)
    if (!iso) continue
    const day = formatDateInputLocal(new Date(iso))
    if (!byDay.has(day)) continue
    byDay.set(day, (byDay.get(day) ?? 0) + Number(row.price ?? 0))
  }
  for (const row of salesRows ?? []) {
    const day = formatDateInputLocal(new Date(row.occurred_at))
    if (!byDay.has(day)) continue
    byDay.set(day, (byDay.get(day) ?? 0) + Number(row.amount_kzt ?? 0))
  }
  const out: RevenueChartDay[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(chartStart)
    d.setDate(chartStart.getDate() + i)
    const key = formatDateInputLocal(d)
    out.push({ dateKey: key, totalKzt: byDay.get(key) ?? 0 })
  }
  return out
}

const initial: OwnerDashboardState = {
  loading: true,
  appointmentsToday: 0,
  revenueTodayKzt: 0,
  activeStaff: 0,
  appointmentsWeek: 0,
  revenueWeekKzt: 0,
  appointmentsMonth: 0,
  revenueMonthKzt: 0,
  revenueChart30d: [],
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
    const nowUtc = new Date().toISOString()
    /** Порог «прошло» для недели/месяца по бизнес-логике (см. UTC+5). */
    const nowKZ = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
    const weekAgoIso = new Date(Date.now() - 7 * MS_DAY).toISOString()
    const monthAgoIso = new Date(Date.now() - 30 * MS_DAY).toISOString()

    const chartAnchor = new Date()
    const chartStart = new Date(
      chartAnchor.getFullYear(),
      chartAnchor.getMonth(),
      chartAnchor.getDate() - 29,
      0,
      0,
      0,
      0,
    )
    const chartEnd = new Date(
      chartAnchor.getFullYear(),
      chartAnchor.getMonth(),
      chartAnchor.getDate(),
      23,
      59,
      59,
      999,
    )
    const chartStartIso = chartStart.toISOString()
    const chartEndIso = chartEnd.toISOString()

    try {
      const [apptRes, salesRes, staffRes, upcomingRes, weekApptRes, monthApptRes, chartApptRes, chartSalesRes] =
        await Promise.all([
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
          .gte('scheduled_at', nowUtc)
          .neq('status', 'cancelled')
          .order('scheduled_at', { ascending: true })
          .limit(12),
        supabase
          .from('appointments')
          .select('id')
          .eq('owner_id', userId)
          .not('starts_at', 'is', null)
          .gte('starts_at', weekAgoIso)
          .lt('starts_at', nowKZ)
          .neq('status', 'cancelled'),
        supabase
          .from('appointments')
          .select('id')
          .eq('owner_id', userId)
          .not('starts_at', 'is', null)
          .gte('starts_at', monthAgoIso)
          .lt('starts_at', nowKZ)
          .neq('status', 'cancelled'),
        supabase
          .from('appointments')
          .select('id, starts_at')
          .eq('owner_id', userId)
          .gte('starts_at', chartStartIso)
          .lte('starts_at', chartEndIso)
          .neq('status', 'cancelled')
          .not('starts_at', 'is', null),
        supabase
          .from('sales_transactions')
          .select('occurred_at, amount_kzt')
          .eq('owner_id', userId)
          .gte('occurred_at', chartStartIso)
          .lte('occurred_at', chartEndIso),
      ])

      const anyErr =
        apptRes.error ||
        salesRes.error ||
        staffRes.error ||
        upcomingRes.error ||
        weekApptRes.error ||
        monthApptRes.error ||
        chartApptRes.error ||
        chartSalesRes.error
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
          revenueChart30d: [],
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
        duration_minutes: 0,
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
          supabase
            .from('appointment_services')
            .select('appointment_id, price, duration, service_id')
            .in('appointment_id', apptIds),
        ])

        if (staffPick.error) console.warn('[dashboard] staff names', staffPick.error)
        if (svcPick.error) console.warn('[dashboard] appointment_services', svcPick.error)

        const staffMap = new Map((staffPick.data ?? []).map((s) => [s.id, s.full_name]))

        const svcLines = (svcPick.data ?? []) as {
          appointment_id: string
          price: number | null
          duration: number | null
          service_id: string | null
        }[]
        const serviceIds = [...new Set(svcLines.map((r) => r.service_id).filter((id): id is string => Boolean(id)))]
        let serviceDurationById = new Map<string, number>()
        if (serviceIds.length > 0) {
          const { data: catRows, error: catErr } = await supabase
            .from('services')
            .select('id, duration')
            .eq('owner_id', userId)
            .in('id', serviceIds)
          if (catErr) console.warn('[dashboard] services durations', catErr)
          serviceDurationById = new Map((catRows ?? []).map((s) => [s.id, Number(s.duration ?? 0)]))
        }

        const aggByAppt = aggregateAppointmentServicesByAppointment(svcLines, serviceDurationById)

        upcoming = baseUpcoming.map((r) => {
          const agg = aggByAppt.get(r.id)
          return {
            id: r.id,
            title: r.title,
            client_name: r.client_name,
            scheduled_at: r.scheduled_at,
            status: r.status,
            staff_name: r.staff_id ? staffMap.get(r.staff_id) ?? null : null,
            amount_kzt: agg?.amountKzt ?? 0,
            duration_minutes: agg?.durationMinutes ?? 0,
          }
        })
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
            revenueChart30d: [],
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

      const chartAppts = (chartApptRes.data ?? []) as { id: string; starts_at: string }[]
      const chartIds = chartAppts.map((a) => a.id)
      let revenueChart30d: RevenueChartDay[] = []
      if (chartIds.length > 0) {
        const { data: chartSvcRows, error: chartSvcErr } = await supabase
          .from('appointment_services')
          .select('appointment_id, price')
          .in('appointment_id', chartIds)
        if (chartSvcErr) {
          console.warn('[dashboard] chart appointment_services', chartSvcErr)
          revenueChart30d = buildRevenueChart30d(
            chartAppts,
            [],
            chartSalesRes.data ?? [],
            chartStart,
          )
        } else {
          revenueChart30d = buildRevenueChart30d(
            chartAppts,
            chartSvcRows,
            chartSalesRes.data ?? [],
            chartStart,
          )
        }
      } else {
        revenueChart30d = buildRevenueChart30d(
          [],
          [],
          chartSalesRes.data ?? [],
          chartStart,
        )
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
        revenueChart30d,
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
        revenueChart30d: [],
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
