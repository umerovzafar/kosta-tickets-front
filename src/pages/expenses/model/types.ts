export type ExpenseCategory =
  | 'Транспорт'
  | 'Питание'
  | 'Командировка'
  | 'Офис'
  | 'ПО и сервисы'
  | 'Представительские'
  | 'Прочее'

export type ExpenseItem = {
  id: string
  date: string
  category: ExpenseCategory
  amount: number
  currency: string
  title?: string
  description: string
  receiptPhoto?: string
}

export type ReportViewMode = 'day' | 'week' | 'month' | 'period'

export type PeriodSummary = {
  start: string
  end: string
  total: number
  count: number
  byCategory: Record<string, number>
  byDay: DaySummary[]
}

export type DaySummary = {
  date: string
  total: number
  count: number
  expenses: ExpenseItem[]
}

export type WeekSummary = {
  weekStart: string
  total: number
  count: number
  days: DaySummary[]
}

export type MonthSummary = {
  year: number
  month: number
  total: number
  count: number
  byCategory: Record<string, number>
  byWeek: WeekSummary[]
}
