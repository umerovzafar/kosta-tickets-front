import { useMemo, useState } from 'react'
import { AnimatedLink } from '@shared/ui'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { useExpenses } from '../model/ExpensesContext'
import { getMonthDates } from '../model/utils'
import { routes } from '@shared/config'
import type { ExpenseCategory } from '../model/types'
import { ExpensesReportFilters } from './ExpensesReportFilters'
import { ExpensesReportCharts } from './ExpensesReportCharts'
import { ExpensesReportTable } from './ExpensesReportTable'
import './ExpensesReportPage.css'

function formatWeekRange(weekStart: string) {
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function ExpensesReportPageView() {
  const {
    isCollapsed,
    isMobileOpen,
    isMobile,
    onToggleCollapse,
    onCloseMobile,
    onOpenMobile,
    reportViewMode,
    setReportViewMode,
    selectedDate,
    setSelectedDate,
    periodRange,
    setPeriodRange,
    dayReport,
    weekReport,
    monthReport,
    periodReport,
    formatAmount,
    CATEGORY_META,
    expenses,
  } = useExpenses()

  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('')

  const report = reportViewMode === 'day' ? dayReport : reportViewMode === 'week' ? weekReport : reportViewMode === 'month' ? monthReport : periodReport
  const total = report?.total ?? 0
  const count = report?.count ?? 0

  const pieData = useMemo(() => {
    const byCat = reportViewMode === 'month' && monthReport
      ? monthReport.byCategory
      : reportViewMode === 'period' && periodReport
        ? periodReport.byCategory
        : reportViewMode === 'week' && weekReport
          ? weekReport.days.reduce<Record<string, number>>((acc, d) => {
              for (const e of d.expenses) {
                acc[e.category] = (acc[e.category] || 0) + e.amount
              }
              return acc
            }, {})
          : reportViewMode === 'day' && dayReport
            ? dayReport.expenses.reduce<Record<string, number>>((acc, e) => {
                acc[e.category] = (acc[e.category] || 0) + e.amount
                return acc
              }, {})
            : {}
    return Object.entries(byCat)
      .filter(([cat]) => !categoryFilter || cat === categoryFilter)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, color: CATEGORY_META[name as ExpenseCategory]?.color ?? '#94a3b8' }))
  }, [reportViewMode, dayReport, weekReport, monthReport, periodReport, categoryFilter, CATEGORY_META])

  const barData = useMemo(() => {
    if (reportViewMode === 'day' && dayReport) {
      return [{ label: new Date(dayReport.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), value: dayReport.total }]
    }
    if (reportViewMode === 'week' && weekReport) {
      return weekReport.days.map((d) => ({
        label: new Date(d.date + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' }),
        value: d.total,
      }))
    }
    if (reportViewMode === 'month' && monthReport) {
      return monthReport.byWeek.map((w, i) => ({
        label: `Н${i + 1}`,
        fullLabel: formatWeekRange(w.weekStart),
        value: w.total,
      }))
    }
    if (reportViewMode === 'period' && periodReport) {
      const daysWithData = periodReport.byDay.filter((d) => d.total > 0)
      return daysWithData.map((d) => ({
        label: new Date(d.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        value: d.total,
      }))
    }
    return []
  }, [reportViewMode, dayReport, weekReport, monthReport, periodReport])

  const filteredExpenses = useMemo(() => {
    if (!report) return []
    const list =
      reportViewMode === 'day' && dayReport
        ? dayReport.expenses
        : reportViewMode === 'week' && weekReport
          ? weekReport.days.flatMap((d) => d.expenses)
          : reportViewMode === 'month' && monthReport
            ? expenses.filter((e) => {
                const [y, m] = selectedDate?.split('-').map(Number) ?? [0, 0]
                const dates = getMonthDates(y, m - 1)
                return dates.includes(e.date)
              })
            : reportViewMode === 'period' && periodReport
              ? periodReport.byDay.flatMap((d) => d.expenses)
              : []
    return categoryFilter ? list.filter((e) => e.category === categoryFilter) : list
  }, [report, reportViewMode, dayReport, weekReport, monthReport, periodReport, expenses, selectedDate, categoryFilter])

  const periodLabel =
    reportViewMode === 'day' && selectedDate
      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : reportViewMode === 'week' && weekReport
        ? formatWeekRange(weekReport.weekStart)
        : reportViewMode === 'month' && selectedDate
          ? (() => {
              const [y, m] = selectedDate.split('-').map(Number)
              return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
            })()
          : reportViewMode === 'period' && periodReport
            ? `${new Date(periodReport.start + 'T00:00:00').toLocaleDateString('ru-RU')} — ${new Date(periodReport.end + 'T00:00:00').toLocaleDateString('ru-RU')}`
            : ''

  return (
    <div className="exp-report-page">
      <div className="exp-report-page__sidebar-wrap">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
          isMobileOpen={isMobileOpen}
          onCloseMobile={onCloseMobile}
          isMobile={isMobile}
        />
      </div>
      <main className="exp-report-page__main">
        <header className="exp-report-page__header">
          {isMobile && (
            <button type="button" className="exp-report-page__menu-btn" onClick={onOpenMobile} aria-label="Меню">
              <IconMenu />
            </button>
          )}
          <AnimatedLink to={routes.expenses} className="exp-report-page__back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="exp-report-page__back-label">Назад</span>
          </AnimatedLink>
          <div className="exp-report-page__header-divider" aria-hidden="true" />
          <div className="exp-report-page__header-inner">
            <h1 className="exp-report-page__title">Отчётность по расходам</h1>
          </div>
        </header>

        <div className="exp-report-page__content">
          <ExpensesReportFilters
            reportViewMode={reportViewMode}
            setReportViewMode={setReportViewMode}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            periodRange={periodRange}
            setPeriodRange={setPeriodRange}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            CATEGORY_META={CATEGORY_META}
          />

          <section className="exp-report-page__summary">
            <h2 className="exp-report-page__summary-period">{periodLabel}</h2>
            <div className="exp-report-page__summary-cards">
              <div className="exp-report-page__summary-card">
                <span className="exp-report-page__summary-label">Итого</span>
                <strong className="exp-report-page__summary-value">{formatAmount(total)}</strong>
              </div>
              <div className="exp-report-page__summary-card">
                <span className="exp-report-page__summary-label">Операций</span>
                <strong className="exp-report-page__summary-value">{count}</strong>
              </div>
            </div>
          </section>

          <ExpensesReportCharts pieData={pieData} barData={barData} formatAmount={formatAmount} />

          <section className="exp-report-page__table-section">
            <h3 className="exp-report-page__table-title">Детализация</h3>
            <ExpensesReportTable expenses={filteredExpenses} formatAmount={formatAmount} CATEGORY_META={CATEGORY_META} />
          </section>
        </div>
      </main>
    </div>
  )
}
