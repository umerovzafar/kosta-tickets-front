import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import {
  DEFAULT_CURRENCY,
  EXPENSE_CATEGORIES,
  CATEGORY_META,
  WEEKDAYS_SHORT,
} from './constants'
import {
  buildMonthGrid,
  toDateKey,
  formatAmount,
  generateId,
  isDateInRange,
} from './utils'
import { loadExpensesFromStorage, saveExpensesToStorage } from './lib/storage'
import { useExpensesReports } from './hooks/useExpensesReports'
import { useExpensesServerData } from './hooks/useExpensesServerData'
import type { ExpenseItem, ReportViewMode } from './types'
import type { ExpensesContextValue } from './ExpensesContext.types'

const ExpensesContext = createContext<ExpensesContextValue | null>(null)

const EXPENSES_OFFLINE = import.meta.env.VITE_EXPENSES_OFFLINE === 'true'

export function useExpenses() {
  const ctx = useContext(ExpensesContext)
  if (!ctx) throw new Error('useExpenses must be used within ExpensesProvider')
  return ctx
}

type ExpensesProviderProps = {
  children: ReactNode
  isMobile: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function ExpensesProvider({ children, isMobile, isCollapsed, onToggleCollapse }: ExpensesProviderProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() =>
    EXPENSES_OFFLINE ? loadExpensesFromStorage() : [],
  )
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toDateKey(new Date()))
  const [reportViewMode, setReportViewMode] = useState<ReportViewMode>('day')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formDate, setFormDate] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [periodRange, setPeriodRange] = useState(() => {
    const today = new Date()
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { start: toDateKey(first), end: toDateKey(last) }
  })
  const todayKey = useMemo(() => toDateKey(new Date()), [])

  const { refetch: refetchExpensesApi, ...server } = useExpensesServerData(
    currentMonth,
    selectedDate,
    !EXPENSES_OFFLINE,
  )

  useEffect(() => {
    if (EXPENSES_OFFLINE) return
    if (!selectedDate) return
    setExpenses((prev) => {
      const withoutServerForDate = prev.filter(
        (e) => !(e.date === selectedDate && e.id.startsWith('er-')),
      )
      return [...withoutServerForDate, ...server.dayItems]
    })
  }, [EXPENSES_OFFLINE, selectedDate, server.dayItems])

  const reports = useExpensesReports(expenses, selectedDate, periodRange)

  useEffect(() => {
    if (!EXPENSES_OFFLINE) return
    saveExpensesToStorage(expenses)
  }, [expenses])

  useEffect(() => {
    if (!isMobile) setIsMobileOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (isMobile && isMobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, isMobileOpen])

  useEffect(() => {
    if (!isMobile || !isMobileOpen) return
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileOpen(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [isMobile, isMobileOpen])

  const monthDays = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])
  const monthLabel = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  const expensesByDay = EXPENSES_OFFLINE ? reports.expensesByDay : server.expensesByDay

  const addExpense = useCallback((item: Omit<ExpenseItem, 'id'>) => {
    const newItem: ExpenseItem = {
      ...item,
      id: generateId(),
      currency: item.currency || DEFAULT_CURRENCY,
    }
    setExpenses((prev) => [...prev, newItem])
  }, [])

  const reloadExpenses = useCallback(() => {
    if (EXPENSES_OFFLINE) setExpenses(loadExpensesFromStorage())
    else refetchExpensesApi()
  }, [refetchExpensesApi])

  const updateExpense = useCallback((id: string, patch: Partial<ExpenseItem>) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const openFormForDate = useCallback((date: string) => {
    setSelectedDate(date)
    setFormDate(date)
    setEditingExpense(null)
    setIsFormOpen(true)
  }, [])

  const openFormForEdit = useCallback((expense: ExpenseItem) => {
    setSelectedDate(expense.date)
    setFormDate(expense.date)
    setEditingExpense(expense)
    setIsFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setIsFormOpen(false)
    setFormDate(null)
    setEditingExpense(null)
  }, [])

  const isDateInRangeFn = useCallback(
    (dateKey: string) => {
      if (!dateRange) return false
      return isDateInRange(dateKey, dateRange.start, dateRange.end)
    },
    [dateRange],
  )

  const value = useMemo<ExpensesContextValue>(
    () => ({
      isCollapsed,
      isMobileOpen,
      isMobile,
      onToggleCollapse,
      onCloseMobile: () => setIsMobileOpen(false),
      onOpenMobile: () => setIsMobileOpen(true),
      currentMonth,
      setCurrentMonth,
      monthDays,
      monthLabel,
      selectedDate,
      setSelectedDate,
      todayKey,
      expenses,
      expensesOfflineMode: EXPENSES_OFFLINE,
      refetchExpensesApi,
      expensesApiLoading: server.loading,
      expensesApiError: server.error,
      addExpense,
      reloadExpenses,
      updateExpense,
      reportViewMode,
      setReportViewMode,
      dayReport: reports.dayReport,
      weekReport: reports.weekReport,
      monthReport: reports.monthReport,
      periodReport: reports.periodReport,
      periodRange,
      setPeriodRange,
      expensesByDay,
      isFormOpen,
      openFormForDate,
      openFormForEdit,
      closeForm,
      formDate,
      editingExpense,
      dateRange,
      setDateRange,
      isDateInRange: isDateInRangeFn,
      EXPENSE_CATEGORIES,
      CATEGORY_META,
      WEEKDAYS_SHORT,
      formatAmount,
    }),
    [
      isCollapsed,
      isMobileOpen,
      isMobile,
      onToggleCollapse,
      currentMonth,
      monthDays,
      monthLabel,
      selectedDate,
      todayKey,
      expenses,
      refetchExpensesApi,
      server.loading,
      server.error,
      addExpense,
      reloadExpenses,
      updateExpense,
      reportViewMode,
      reports,
      periodRange,
      isFormOpen,
      openFormForDate,
      openFormForEdit,
      closeForm,
      formDate,
      editingExpense,
      dateRange,
      isDateInRangeFn,
      expensesByDay,
    ],
  )

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>
}
