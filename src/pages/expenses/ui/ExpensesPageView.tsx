import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useCurrentUser } from '@shared/hooks'
import { AnimatedLink } from '@shared/ui'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { routes } from '@shared/config'
import { useExpenses } from '../model/ExpensesContext'
import { toDateKey, buildDaySummary } from '../model/utils'
import type { ExpenseItem } from '../model/types'
import { ExpensesDetailPanel } from './ExpensesDetailPanel'
import { ExpenseFormModal } from './ExpenseFormModal'
import { ExpenseItemDetailModal } from './ExpenseItemDetailModal'
import { canViewExpensesRequestsAndReport } from '../model/expenseModeration'
import './ExpensesPage.css'

function formatFullDate(date: string | null) {
  if (!date) return 'Дата не выбрана'
  const parsed = new Date(date + 'T00:00:00')
  const label = parsed.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function ExpensesPageSkeleton() {
  return (
    <>
      <section
        className="exp-page__panel exp-page__panel--calendar exp-page__panel--calendar-main"
        aria-busy="true"
        aria-label="Загрузка календаря"
      >
        <div className="exp-page__calendar-header exp-page__skel-calendar-header">
          <div className="exp-page__skel-pill exp-page__skel-pill--month" />
          <div className="exp-page__skel-pill exp-page__skel-pill--selected" />
          <div className="exp-page__skel-pill exp-page__skel-pill--legend" />
        </div>
        <div className="exp-page__weekdays">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="exp-page__weekday exp-page__skel-weekday" aria-hidden />
          ))}
        </div>
        <div className="exp-page__days">
          {Array.from({ length: 42 }, (_, i) => (
            <div
              key={i}
              className="exp-page__skel-day"
              style={{ animationDelay: `${(i % 14) * 0.05}s` }}
              aria-hidden
            />
          ))}
        </div>
      </section>
      <aside className="exp-page__detail-panel" aria-busy="true" aria-label="Загрузка расходов за дату">
        <div className="exp-detail-panel">
          <div className="exp-detail-panel__head">
            <div className="exp-page__skel-line exp-page__skel-line--title" />
            <div className="exp-page__skel-line exp-page__skel-line--summary" />
          </div>
          <div className="exp-detail-panel__body exp-page__skel-detail-body">
            <div className="exp-page__skel-line exp-page__skel-line--section" />
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="exp-page__skel-exp-card"
                style={{ animationDelay: `${0.1 + i * 0.07}s` }}
              />
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}

export function ExpensesPageView() {
  const {
    isCollapsed,
    isMobileOpen,
    isMobile,
    onToggleCollapse,
    onCloseMobile,
    onOpenMobile,
    currentMonth,
    setCurrentMonth,
    monthDays,
    monthLabel,
    selectedDate,
    setSelectedDate,
    todayKey,
    expensesByDay,
    openFormForDate,
    openFormForEdit,
    closeForm,
    isFormOpen,
    formDate,
    editingExpense,
    addExpense,
    updateExpense,
    CATEGORY_META,
    WEEKDAYS_SHORT,
    formatAmount,
    dateRange,
    isDateInRange,
    expenses,
    expensesOfflineMode,
    expensesApiError,
    expensesApiLoading,
  } = useExpenses()

  const { user } = useCurrentUser()
  const showExpensesMgmtLinks = canViewExpensesRequestsAndReport(user?.role)

  const showExpensesSkeleton = !expensesOfflineMode && expensesApiLoading && !expensesApiError

  const [detailExpense, setDetailExpense] = useState<ExpenseItem | null>(null)

  const selectedDayInfo = selectedDate ? expensesByDay[selectedDate] : null
  const selectedDateLabel = formatFullDate(selectedDate)

  const syncSelectedToMonth = (nextMonth: Date) => {
    if (!selectedDate) return
    const [sy, sm] = selectedDate.split('-').map(Number)
    if (sy !== nextMonth.getFullYear() || sm !== nextMonth.getMonth() + 1) {
      const firstKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`
      setSelectedDate(firstKey)
    }
  }

  const goPrevMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    setCurrentMonth(next)
    syncSelectedToMonth(next)
  }

  const goNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    setCurrentMonth(next)
    syncSelectedToMonth(next)
  }

  const goToday = () => {
    setSelectedDate(todayKey)
    setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth()))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFormOpen) closeForm()
        setDetailExpense(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFormOpen, closeForm])

  return (
    <div className="exp-page">
      <div className="exp-page__sidebar-wrap">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
          isMobileOpen={isMobileOpen}
          onCloseMobile={onCloseMobile}
          isMobile={isMobile}
        />
      </div>
      <main className="exp-page__main">
        <header className="exp-page__header">
          {isMobile && (
            <button type="button" className="exp-page__menu-btn" onClick={onOpenMobile} aria-label="Открыть меню">
              <IconMenu />
            </button>
          )}
          <div className="exp-page__header-inner">
            <div className="exp-page__header-copy">
              <h1 className="exp-page__title">Расходы компании</h1>
            </div>
            <div className="exp-page__header-actions">
              {showExpensesMgmtLinks && (
                <>
                  <AnimatedLink to={routes.expensesRequests} className="exp-page__btn exp-page__btn--ghost">
                    Заявки
                  </AnimatedLink>
                  <AnimatedLink to={routes.expensesReport} className="exp-page__btn exp-page__btn--ghost">
                    Отчётность
                  </AnimatedLink>
                </>
              )}
              <button type="button" className="exp-page__btn exp-page__btn--ghost" onClick={goToday} title="Перейти к сегодняшней дате">
                Сегодня
              </button>
              <button
                type="button"
                className="exp-page__btn exp-page__btn--primary"
                onClick={() => selectedDate && openFormForDate(selectedDate)}
                title="Добавить расход за дату, выбранную в календаре"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Добавить расход
              </button>
            </div>
          </div>
        </header>

        {!expensesOfflineMode && expensesApiError && (
          <div className="exp-page__api-banner exp-page__api-banner--error" role="alert">
            {expensesApiError}
          </div>
        )}
        {showExpensesSkeleton && (
          <span className="exp-page__sr-only" aria-live="polite">
            Загрузка расходов…
          </span>
        )}

        <div className="exp-page__content">
          <div className="exp-page__grid">
            {showExpensesSkeleton ? (
              <ExpensesPageSkeleton />
            ) : (
            <>
            <section className="exp-page__panel exp-page__panel--calendar exp-page__panel--calendar-main">
              <div className="exp-page__calendar-header">
                <div className="exp-page__calendar-block exp-page__calendar-block--month">
                  <span className="exp-page__calendar-block-label">Месяц</span>
                  <div className="exp-page__calendar-month-row">
                    <h3 className="exp-page__calendar-month">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h3>
                    <div className="exp-page__calendar-nav">
                      <button type="button" className="exp-page__nav-btn" onClick={goPrevMonth} aria-label="Предыдущий месяц" title="Предыдущий месяц">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                      </button>
                      <button type="button" className="exp-page__nav-btn" onClick={goNextMonth} aria-label="Следующий месяц" title="Следующий месяц">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="exp-page__calendar-divider" aria-hidden="true" />
                <div className="exp-page__calendar-block exp-page__calendar-block--selected">
                  <span className="exp-page__calendar-block-label">Выбрано</span>
                  <div className="exp-page__calendar-selected">
                    <span className="exp-page__calendar-selected-date">{selectedDateLabel}</span>
                    <span className="exp-page__calendar-selected-stats">
                      {formatAmount(selectedDayInfo?.total ?? 0)} · {selectedDayInfo?.count ?? 0} операций
                    </span>
                    {dateRange && dateRange.start !== dateRange.end && (
                      <span className="exp-page__calendar-range">
                        Период: {new Date(dateRange.start + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {new Date(dateRange.end + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="exp-page__calendar-divider" aria-hidden="true" />
                <div className="exp-page__calendar-block exp-page__calendar-block--legend">
                  <span className="exp-page__calendar-block-label">Обозначения</span>
                  <div className="exp-page__legend">
                    <span className="exp-page__legend-item">
                      <span className="exp-page__legend-dot exp-page__legend-dot--today" />
                      Сегодня
                    </span>
                    <span className="exp-page__legend-item">
                      <span className="exp-page__legend-dot exp-page__legend-dot--selected" />
                      Выбрано
                    </span>
                    <span className="exp-page__legend-item">
                      <span className="exp-page__legend-dot exp-page__legend-dot--expense" />
                      Есть расходы
                    </span>
                  </div>
                </div>
              </div>

              <div className="exp-page__weekdays">
                {WEEKDAYS_SHORT.map((d) => (
                  <span key={d} className="exp-page__weekday">{d}</span>
                ))}
              </div>
              <div className="exp-page__days">
                {monthDays.map((d) => {
                  const key = toDateKey(d)
                  const inMonth = d.getMonth() === currentMonth.getMonth()
                  const isToday = key === todayKey
                  const isSelected = key === selectedDate
                  const inRange = isDateInRange(key)
                  const info = expensesByDay[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      className={[
                        'exp-page__day',
                        !inMonth && 'exp-page__day--muted',
                        isToday && 'exp-page__day--today',
                        isSelected && 'exp-page__day--selected',
                        inRange && 'exp-page__day--in-range',
                        info && info.count > 0 && 'exp-page__day--has-exp',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setSelectedDate(key)}
                      title={key}
                    >
                      <span className="exp-page__day-num">{d.getDate()}</span>
                      {info && info.count > 0 && (
                        <span className="exp-page__day-sum">
                          {formatAmount(info.total)}
                          {info.count > 1 && <span className="exp-page__day-count">×{info.count}</span>}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
            <aside className="exp-page__detail-panel" aria-label="Расходы по выбранной дате в календаре">
              <ExpensesDetailPanel
                date={selectedDate ?? todayKey}
                expenses={buildDaySummary(selectedDate ?? todayKey, expenses).expenses}
                onViewDetails={setDetailExpense}
                onEdit={openFormForEdit}
                formatAmount={formatAmount}
                CATEGORY_META={CATEGORY_META}
              />
            </aside>
            </>
            )}
          </div>
        </div>
      </main>

      {detailExpense && typeof document !== 'undefined' && createPortal(
        <ExpenseItemDetailModal
          expense={detailExpense}
          formatAmount={formatAmount}
          onClose={() => setDetailExpense(null)}
          onEdit={() => {
            openFormForEdit(detailExpense)
            setDetailExpense(null)
          }}
        />,
        document.body,
      )}

      {isFormOpen && formDate && typeof document !== 'undefined' && createPortal(
        <ExpenseFormModal
          date={formDate}
          initialExpense={editingExpense}
          onClose={closeForm}
          onSaveExpense={(item) => {
            addExpense(item)
          }}
          onUpdateExpense={updateExpense}
        />,
        document.body
      )}

    </div>
  )
}
