import type { ExpenseItem, ReportViewMode, DaySummary, WeekSummary, MonthSummary, PeriodSummary } from './types'
import type { EXPENSE_CATEGORIES, CATEGORY_META, WEEKDAYS_SHORT } from './constants'

export type ExpensesContextValue = {
  isCollapsed: boolean
  isMobileOpen: boolean
  isMobile: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
  onOpenMobile: () => void

  currentMonth: Date
  setCurrentMonth: (d: Date | ((prev: Date) => Date)) => void
  monthDays: Date[]
  monthLabel: string
  selectedDate: string | null
  setSelectedDate: (d: string | null) => void
  todayKey: string

  expenses: ExpenseItem[]
  addExpense: (item: Omit<ExpenseItem, 'id'>) => void
  removeExpense: (id: string) => void
  updateExpense: (id: string, patch: Partial<ExpenseItem>) => void

  reportViewMode: ReportViewMode
  setReportViewMode: (m: ReportViewMode) => void

  dayReport: DaySummary | null
  weekReport: WeekSummary | null
  monthReport: MonthSummary | null
  periodReport: PeriodSummary | null

  periodRange: { start: string; end: string }
  setPeriodRange: (range: { start: string; end: string }) => void

  expensesByDay: Record<string, { total: number; count: number }>

  isFormOpen: boolean
  openFormForDate: (date: string) => void
  openFormForEdit: (expense: ExpenseItem) => void
  closeForm: () => void
  formDate: string | null
  editingExpense: ExpenseItem | null

  dayComments: Record<string, string>
  setDayComment: (date: string, comment: string) => void

  dateRange: { start: string; end: string } | null
  setDateRange: (range: { start: string; end: string } | null) => void
  isDateInRange: (dateKey: string) => boolean

  isCommentModalOpen: boolean
  commentModalDate: string | null
  openCommentModal: (date: string) => void
  closeCommentModal: () => void

  EXPENSE_CATEGORIES: typeof EXPENSE_CATEGORIES
  CATEGORY_META: typeof CATEGORY_META
  WEEKDAYS_SHORT: typeof WEEKDAYS_SHORT
  formatAmount: (n: number, currency?: string) => string
}
