import type { ExpenseItem, DaySummary, WeekSummary, PeriodSummary, ExpenseRequestStatus } from './types'

/** Статус по строке календаря; без поля — считаем согласованные (до введения согласования) */
export function getExpenseApprovalStatus(e: ExpenseItem): ExpenseRequestStatus {
  return e.approvalStatus ?? 'approved'
}

/** Учитывается в сумме по дню в календаре (только согласовано) */
export function isExpenseApprovedForCalendar(e: ExpenseItem): boolean {
  return getExpenseApprovalStatus(e) === 'approved'
}

/** Согласованные операции не редактируются (см. заявки на расходы) */
export function isExpenseEditable(e: ExpenseItem): boolean {
  return getExpenseApprovalStatus(e) !== 'approved'
}

export function buildMonthGrid(baseDate: Date): Date[] {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const firstWeekday = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month, 1 - firstWeekday)
  const days: Date[] = []
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  return days
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isDateInRange(dateKey: string, start: string, end: string): boolean {
  const [s, e] = [start, end].sort()
  return dateKey >= s && dateKey <= e
}

export function getDatesInRange(start: string, end: string): string[] {
  const [s, e] = [start, end].sort()
  const result: string[] = []
  const d = new Date(s + 'T00:00:00')
  const last = new Date(e + 'T00:00:00')
  while (d <= last) {
    result.push(toDateKey(d))
    d.setDate(d.getDate() + 1)
  }
  return result
}

export function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toDateKey(d)
}

export function getWeekDates(mondayStr: string): string[] {
  const result: string[] = []
  const start = new Date(mondayStr + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    result.push(toDateKey(d))
  }
  return result
}

export function getMonthDates(year: number, month: number): string[] {
  const result: string[] = []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const d = new Date(first)
  while (d <= last) {
    result.push(toDateKey(d))
    d.setDate(d.getDate() + 1)
  }
  return result
}

export function groupExpensesByDay(expenses: ExpenseItem[]): Record<string, ExpenseItem[]> {
  const byDay: Record<string, ExpenseItem[]> = {}
  for (const e of expenses) {
    (byDay[e.date] ??= []).push(e)
  }
  return byDay
}

export function buildDaySummary(date: string, expenses: ExpenseItem[]): DaySummary {
  const dayExpenses = expenses.filter((e) => e.date === date)
  const total = dayExpenses.reduce((s, e) => s + e.amount, 0)
  return { date, total, count: dayExpenses.length, expenses: dayExpenses }
}

export function buildWeekSummary(weekStart: string, expenses: ExpenseItem[]): WeekSummary {
  const dates = getWeekDates(weekStart)
  const days: DaySummary[] = dates.map((d) => buildDaySummary(d, expenses))
  const total = days.reduce((s, d) => s + d.total, 0)
  const count = days.reduce((s, d) => s + d.count, 0)
  return { weekStart, total, count, days }
}

export function buildPeriodSummary(start: string, end: string, expenses: ExpenseItem[]): PeriodSummary {
  const dates = getDatesInRange(start, end)
  const periodExpenses = expenses.filter((e) => dates.includes(e.date))
  const byCategory: Record<string, number> = {}
  for (const e of periodExpenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
  }
  const byDay: DaySummary[] = dates.map((d) => buildDaySummary(d, expenses))
  const total = periodExpenses.reduce((s, e) => s + e.amount, 0)
  return { start, end, total, count: periodExpenses.length, byCategory, byDay }
}

export function formatAmount(n: number, currency = 'UZS'): string {
  return `${n.toLocaleString('ru-RU')} ${currency}`
}

/** Сумма с валютой для заявок и отчётов (Intl). */
export function formatMoneyAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'UZS',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString('ru-RU')} ${currency}`
  }
}

export function generateId(): string {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
