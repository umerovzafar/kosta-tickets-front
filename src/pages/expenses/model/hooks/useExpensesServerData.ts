import { useState, useEffect, useCallback } from 'react'
import { fetchExpenseCalendar, fetchExpensesByDate } from '@entities/expenses'
import type { ExpenseItem } from '../types'
import { expenseRequestOutToExpenseItem } from '../lib/mapExpenseApi'

function toDayKey(dateField: string): string {
  return dateField.slice(0, 10)
}

function toAmount(v: string | number): number {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function useExpensesServerData(
  currentMonth: Date,
  selectedDate: string | null,
  enabled: boolean,
) {
  const [expensesByDay, setExpensesByDay] = useState<Record<string, { total: number; count: number }>>({})
  const [dayItems, setDayItems] = useState<ExpenseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const y = currentMonth.getFullYear()
  const m = currentMonth.getMonth() + 1

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchExpenseCalendar(y, m)
      .then((cal) => {
        if (cancelled) return
        const rec: Record<string, { total: number; count: number }> = {}
        for (const d of cal.days) {
          const key = toDayKey(d.date)
          rec[key] = { total: toAmount(d.total_amount), count: d.count }
        }
        setExpensesByDay(rec)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Ошибка загрузки календаря')
          setExpensesByDay({})
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, y, m, refreshKey])

  useEffect(() => {
    if (!enabled || !selectedDate) {
      setDayItems([])
      return
    }
    let cancelled = false
    fetchExpensesByDate(selectedDate)
      .then((r) => {
        if (cancelled) return
        setDayItems(r.items.map(expenseRequestOutToExpenseItem))
      })
      .catch(() => {
        if (!cancelled) setDayItems([])
      })
    return () => {
      cancelled = true
    }
  }, [enabled, selectedDate, refreshKey])

  return { expensesByDay, dayItems, loading, error, refetch }
}
