import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { AnimatedLink } from '@shared/ui'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { routes } from '@shared/config'
import { useExpenses } from '../model/ExpensesContext'
import { toDateKey, buildDaySummary } from '../model/utils'
import type { ExpenseCategory } from '../model/types'
import { ExpensesDetailPanel } from './ExpensesDetailPanel'
import { ExpenseFormModal } from './ExpenseFormModal'
import { AllExpensesModal } from './AllExpensesModal'
import { ExpensesContextMenu } from './ExpensesContextMenu'
import './ExpensesPage.css'

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

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

export function ExpensesPageView() {
  const navigate = useNavigate()
  const handleBack = useCallback(() => navigate(routes.home), [navigate])
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
    EXPENSE_CATEGORIES,
    CATEGORY_META,
    WEEKDAYS_SHORT,
    formatAmount,
    dateRange,
    setDateRange,
    isDateInRange,
    dayComments,
    setDayComment,
    expenses,
    removeExpense,
  } = useExpenses()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; dateKey: string } | null>(null)
  const [allExpensesModalOpen, setAllExpensesModalOpen] = useState(false)

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

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
        if (allExpensesModalOpen) setAllExpensesModalOpen(false)
        setContextMenu(null)
      }
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (selectedDate) openFormForDate(selectedDate)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFormOpen, closeForm, allExpensesModalOpen, selectedDate, openFormForDate])

  const handleContextMenu = (e: React.MouseEvent, dateKey: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, dateKey })
  }

  const handleSelectPeriod = (dateKey: string) => {
    if (!dateRange) {
      setDateRange({ start: dateKey, end: dateKey })
    } else {
      const all = [dateRange.start, dateRange.end, dateKey].sort()
      setDateRange({ start: all[0], end: all[all.length - 1] })
    }
    setContextMenu(null)
  }

  const handleAddExpense = (dateKey: string) => {
    setSelectedDate(dateKey)
    openFormForDate(dateKey)
    setContextMenu(null)
  }

  const handleShowDetails = (dateKey: string) => {
    setSelectedDate(dateKey)
    setContextMenu(null)
  }

  const handleShowAllExpenses = () => {
    setAllExpensesModalOpen(true)
    setContextMenu(null)
  }

  const handleComment = (dateKey: string) => {
    setSelectedDate(dateKey)
    setContextMenu(null)
  }

  return (
    <div className="exp-page">
      <div className="exp-page__dev-overlay" role="status" aria-label="Вкладка ещё на разработке">
        <div className="exp-page__dev-overlay-inner">
          <span className="exp-page__dev-overlay-icon" aria-hidden><IconLock /></span>
          <p className="exp-page__dev-overlay-text">Вкладка ещё на разработке</p>
          <button type="button" className="exp-page__dev-overlay-back" onClick={handleBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Назад
          </button>
        </div>
      </div>
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
              <AnimatedLink to={routes.expensesReport} className="exp-page__btn exp-page__btn--ghost">
                Отчётность
              </AnimatedLink>
              <button type="button" className="exp-page__btn exp-page__btn--ghost" onClick={goToday} title="Перейти к сегодняшней дате">
                Сегодня
              </button>
              <button
                type="button"
                className="exp-page__btn exp-page__btn--primary"
                onClick={() => selectedDate && openFormForDate(selectedDate)}
                title="Добавить расход (Ctrl+N)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Добавить расход
              </button>
            </div>
          </div>
        </header>

        <div className="exp-page__content">
          <div className="exp-page__grid">
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
                    <span className="exp-page__legend-item" title="Клик по точке — просмотр комментария">
                      <span className="exp-page__legend-dot exp-page__legend-dot--comment" />
                      Комментарий
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
                  const hasComment = !!dayComments[key]
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
                      onContextMenu={(e) => handleContextMenu(e, key)}
                      title={`${key} — левый клик: выбрать${hasComment ? ', по точке: комментарий' : ''}, правый: меню`}
                    >
                      <span className="exp-page__day-num">{d.getDate()}</span>
                      {hasComment && (
                        <span
                          className="exp-page__day-comment-badge"
                          title={dayComments[key]}
                          role="button"
                          tabIndex={0}
                          aria-label="Посмотреть комментарий"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDate(key)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              setSelectedDate(key)
                            }
                          }}
                        />
                      )}
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
            <aside className="exp-page__detail-panel">
              <ExpensesDetailPanel
                date={selectedDate ?? todayKey}
                expenses={buildDaySummary(selectedDate ?? todayKey, expenses).expenses}
                dayComment={dayComments[selectedDate ?? todayKey] ?? ''}
                onCommentSave={(comment) => setDayComment(selectedDate ?? todayKey, comment)}
                onAdd={() => openFormForDate(selectedDate ?? todayKey)}
                onEdit={openFormForEdit}
                onRemove={removeExpense}
                formatAmount={formatAmount}
                CATEGORY_META={CATEGORY_META}
              />
            </aside>
          </div>
        </div>
      </main>

      {isFormOpen && formDate && typeof document !== 'undefined' && createPortal(
        <ExpenseFormModal
          date={formDate}
          initialExpense={editingExpense}
          onClose={closeForm}
          onSave={(data) => {
            if (editingExpense) {
              updateExpense(editingExpense.id, {
                category: data.category as ExpenseCategory,
                amount: data.amount,
                description: data.description,
                title: data.title,
                receiptPhoto: data.receiptPhoto,
              })
            } else {
              addExpense({
                date: formDate,
                currency: 'UZS',
                category: data.category as ExpenseCategory,
                amount: data.amount,
                description: data.description,
                title: data.title,
                receiptPhoto: data.receiptPhoto,
              })
            }
            closeForm()
          }}
          categories={EXPENSE_CATEGORIES}
          categoryMeta={CATEGORY_META}
        />,
        document.body
      )}

      {contextMenu && typeof document !== 'undefined' && createPortal(
        <ExpensesContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          dateKey={contextMenu.dateKey}
          dateRange={dateRange}
          hasComment={!!dayComments[contextMenu.dateKey]}
          onAddExpense={handleAddExpense}
          onShowDetails={handleShowDetails}
          onShowAllExpenses={handleShowAllExpenses}
          onComment={handleComment}
          onSelectPeriod={handleSelectPeriod}
          onResetPeriod={() => { setDateRange(null); setContextMenu(null) }}
        />,
        document.body
      )}

      {allExpensesModalOpen && typeof document !== 'undefined' && createPortal(
        <AllExpensesModal
          expenses={expenses}
          onClose={() => setAllExpensesModalOpen(false)}
          onRemove={removeExpense}
          formatAmount={formatAmount}
          CATEGORY_META={CATEGORY_META}
        />,
        document.body
      )}
    </div>
  )
}
