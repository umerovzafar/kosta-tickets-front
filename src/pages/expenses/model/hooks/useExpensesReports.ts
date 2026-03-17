import { useMemo } from 'react'
import type { ExpenseItem } from '../types'
import type { DaySummary, WeekSummary, MonthSummary, PeriodSummary } from '../types'
import {
  buildDaySummary,
  buildWeekSummary,
  buildPeriodSummary,
  getWeekMonday,
  getMonthDates,
} from '../utils'

export function useExpensesReports(
  expenses: ExpenseItem[],
  selectedDate: string | null,
  periodRange: { start: string; end: string }
) {
  const expensesByDay = useMemo(() => {
    const byDay: Record<string, { total: number; count: number }> = {}
    for (const e of expenses) {
      if (!byDay[e.date]) byDay[e.date] = { total: 0, count: 0 }
      byDay[e.date].total += e.amount
      byDay[e.date].count += 1
    }
    return byDay
  }, [expenses])

  const dayReport = useMemo((): DaySummary | null => {
    if (!selectedDate) return null
    return buildDaySummary(selectedDate, expenses)
  }, [selectedDate, expenses])

  const weekReport = useMemo((): WeekSummary | null => {
    if (!selectedDate) return null
    const monday = getWeekMonday(selectedDate)
    return buildWeekSummary(monday, expenses)
  }, [selectedDate, expenses])

  const monthReport = useMemo((): MonthSummary | null => {
    if (!selectedDate) return null
    const [y, m] = selectedDate.split('-').map(Number)
    const dates = getMonthDates(y, m - 1)
    const monthExpenses = expenses.filter((e) => dates.includes(e.date))
    const total = monthExpenses.reduce((s, e) => s + e.amount, 0)
    const byCategory: Record<string, number> = {}
    for (const e of monthExpenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
    }
    const mondays = new Set<string>()
    for (const d of dates) {
      mondays.add(getWeekMonday(d))
    }
    const byWeek: WeekSummary[] = Array.from(mondays)
      .sort()
      .map((ws) => buildWeekSummary(ws, monthExpenses))
    return {
      year: y,
      month: m - 1,
      total,
      count: monthExpenses.length,
      byCategory,
      byWeek,
    }
  }, [selectedDate, expenses])

  const periodReport = useMemo((): PeriodSummary | null => {
    return buildPeriodSummary(periodRange.start, periodRange.end, expenses)
  }, [periodRange, expenses])

  return {
    expensesByDay,
    dayReport,
    weekReport,
    monthReport,
    periodReport,
  }
}
