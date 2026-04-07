import { useCallback, useEffect, useState } from 'react'
import { dateInputLocalToIsoMidday, localMonthBoundsIso } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { ExpenseCategory, ExpenseRow } from '@/types/database'

const RECENT_LIMIT = 50

export type FinanceState = {
  loading: boolean
  loadError: boolean
  /** Сумма payments.total_amount за текущий календарный месяц (по created_at). */
  paymentsMonthKzt: number
  /** Сумма sales_transactions.amount_kzt за текущий месяц (по occurred_at). */
  salesMonthKzt: number
  revenueMonthKzt: number
  expensesMonthKzt: number
  profitMonthKzt: number
  recentExpenses: ExpenseRow[]
}

const initial: FinanceState = {
  loading: true,
  loadError: false,
  paymentsMonthKzt: 0,
  salesMonthKzt: 0,
  revenueMonthKzt: 0,
  expensesMonthKzt: 0,
  profitMonthKzt: 0,
  recentExpenses: [],
}

export function useFinance(): FinanceState & {
  refresh: () => Promise<void>
  createExpense: (input: {
    amount_kzt: number
    category: ExpenseCategory
    occurredDate: string
    note: string | null
  }) => Promise<{ error: Error | null }>
  updateExpense: (
    id: string,
    input: {
      amount_kzt: number
      category: ExpenseCategory
      occurredDate: string
      note: string | null
    },
  ) => Promise<{ error: Error | null }>
  deleteExpense: (id: string) => Promise<{ error: Error | null }>
} {
  const userId = useAuthStore((s) => s.user?.id)
  const [state, setState] = useState<FinanceState>(initial)

  const load = useCallback(async () => {
    if (!userId) {
      setState({ ...initial, loading: false })
      return
    }

    const { start, end } = localMonthBoundsIso()

    setState((s) => ({ ...s, loading: true, loadError: false }))

    try {
      const [payRes, salesRes, expSumRes, expListRes] = await Promise.all([
        supabase
          .from('payments')
          .select('total_amount')
          .eq('owner_id', userId)
          .gte('created_at', start)
          .lte('created_at', end),
        supabase
          .from('sales_transactions')
          .select('amount_kzt')
          .eq('owner_id', userId)
          .gte('occurred_at', start)
          .lte('occurred_at', end),
        supabase
          .from('expenses')
          .select('amount_kzt')
          .eq('owner_id', userId)
          .gte('occurred_at', start)
          .lte('occurred_at', end),
        supabase
          .from('expenses')
          .select('id, owner_id, amount_kzt, category, note, occurred_at, created_at')
          .eq('owner_id', userId)
          .order('occurred_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(RECENT_LIMIT),
      ])

      const anyErr = payRes.error || salesRes.error || expSumRes.error || expListRes.error
      if (anyErr) {
        console.warn('[finance]', anyErr)
        setState({
          ...initial,
          loading: false,
          loadError: true,
        })
        return
      }

      const paymentsMonthKzt =
        payRes.data?.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0) ?? 0
      const salesMonthKzt =
        salesRes.data?.reduce((sum, row) => sum + Number(row.amount_kzt ?? 0), 0) ?? 0
      const revenueMonthKzt = paymentsMonthKzt + salesMonthKzt
      const expensesMonthKzt =
        expSumRes.data?.reduce((sum, row) => sum + Number(row.amount_kzt ?? 0), 0) ?? 0
      const profitMonthKzt = revenueMonthKzt - expensesMonthKzt

      setState({
        loading: false,
        loadError: false,
        paymentsMonthKzt,
        salesMonthKzt,
        revenueMonthKzt,
        expensesMonthKzt,
        profitMonthKzt,
        recentExpenses: (expListRes.data ?? []) as ExpenseRow[],
      })
    } catch (e) {
      console.warn('[finance]', e)
      setState({
        ...initial,
        loading: false,
        loadError: true,
      })
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const createExpense = useCallback(
    async (input: {
      amount_kzt: number
      category: ExpenseCategory
      occurredDate: string
      note: string | null
    }): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      if (!Number.isFinite(input.amount_kzt) || input.amount_kzt <= 0) {
        return { error: new Error('invalid amount') }
      }

      const occurred_at = dateInputLocalToIsoMidday(input.occurredDate)
      const { error } = await supabase.from('expenses').insert({
        owner_id: userId,
        amount_kzt: input.amount_kzt,
        category: input.category,
        note: input.note?.trim() ? input.note.trim() : null,
        occurred_at,
      })
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  const updateExpense = useCallback(
    async (
      id: string,
      input: {
        amount_kzt: number
        category: ExpenseCategory
        occurredDate: string
        note: string | null
      },
    ): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      if (!Number.isFinite(input.amount_kzt) || input.amount_kzt <= 0) {
        return { error: new Error('invalid amount') }
      }
      const occurred_at = dateInputLocalToIsoMidday(input.occurredDate)
      const { error } = await supabase
        .from('expenses')
        .update({
          amount_kzt: input.amount_kzt,
          category: input.category,
          note: input.note?.trim() ? input.note.trim() : null,
          occurred_at,
        })
        .eq('id', id)
        .eq('owner_id', userId)
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  const deleteExpense = useCallback(
    async (id: string): Promise<{ error: Error | null }> => {
      if (!userId) return { error: new Error('no user') }
      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('owner_id', userId)
      if (error) return { error: new Error(error.message) }
      await load()
      return { error: null }
    },
    [userId, load],
  )

  return { ...state, refresh: load, createExpense, updateExpense, deleteExpense }
}
