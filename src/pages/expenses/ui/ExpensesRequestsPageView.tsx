import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatedLink } from '@shared/ui'
import { useCurrentUser } from '@shared/hooks'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { routes } from '@shared/config'
import { createExpenseRequest, listExpenseRequests, patchExpenseRequestStatus } from '@entities/expenses'
import { useExpenses } from '../model/ExpensesContext'
import { appendExpenseRequest, loadExpenseRequests, setExpenseRequestStatus } from '../model/expenseRequestsStorage'
import { syncCalendarExpensesWithRequestStatus } from '../model/expenseApprovalSync'
import { canModerateExpenseRequests } from '../model/expenseModeration'
import { expenseRequestOutToExpenseRequest } from '../model/lib/mapExpenseApi'
import { formatMoneyAmount } from '../model/utils'
import type { ExpenseRequest, ExpenseRequestExpenseType, ExpenseRequestStatus } from '../model/types'
import type { NewExpenseRequestInput } from '../model/expenseRequestsStorage'
import { ExpenseRequestDetailModal } from './ExpenseRequestDetailModal'
import { ExpenseRequestFormModal } from './ExpenseRequestFormModal'
import { RejectExpenseRequestModal } from './RejectExpenseRequestModal'
import './ExpensesRequestsPage.css'

const EXPENSES_OFFLINE = import.meta.env.VITE_EXPENSES_OFFLINE === 'true'

const STATUS_LABEL: Record<ExpenseRequestStatus, string> = {
  draft: 'Черновик',
  pending: 'На согласовании',
  approved: 'Согласовано',
  rejected: 'Отклонено',
}

const EXPENSE_TYPE_LABEL: Record<ExpenseRequestExpenseType, string> = {
  reimbursable: 'Возмещаемый',
  non_reimbursable: 'Невозмещаемый',
}

export function ExpensesRequestsPageView() {
  const {
    isCollapsed,
    isMobileOpen,
    isMobile,
    onToggleCollapse,
    onCloseMobile,
    onOpenMobile,
    reloadExpenses,
  } = useExpenses()

  const { user } = useCurrentUser()
  const canModerate = canModerateExpenseRequests(user?.role)

  const [requests, setRequests] = useState<ExpenseRequest[]>(() => (EXPENSES_OFFLINE ? loadExpenseRequests() : []))
  const [listLoading, setListLoading] = useState(!EXPENSES_OFFLINE)
  const [listError, setListError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [detailRequest, setDetailRequest] = useState<ExpenseRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ExpenseRequest | null>(null)
  const [moderationId, setModerationId] = useState<string | null>(null)
  const [moderationError, setModerationError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (EXPENSES_OFFLINE) {
      setRequests(loadExpenseRequests())
      return
    }
    setListError(null)
    listExpenseRequests({ limit: 200 })
      .then((r) => setRequests(r.items.map(expenseRequestOutToExpenseRequest)))
      .catch((e: unknown) => setListError(e instanceof Error ? e.message : 'Не удалось загрузить заявки.'))
  }, [])

  useEffect(() => {
    if (EXPENSES_OFFLINE) return
    const ac = new AbortController()
    setListLoading(true)
    setListError(null)
    listExpenseRequests({ limit: 200, signal: ac.signal })
      .then((r) => setRequests(r.items.map(expenseRequestOutToExpenseRequest)))
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        setListError(e instanceof Error ? e.message : 'Не удалось загрузить заявки.')
      })
      .finally(() => {
        if (!ac.signal.aborted) setListLoading(false)
      })
    return () => ac.abort()
  }, [])

  const handleApprove = async (id: string) => {
    setModerationError(null)
    if (EXPENSES_OFFLINE) {
      const next = setExpenseRequestStatus(id, 'approved')
      if (next) {
        syncCalendarExpensesWithRequestStatus(id, 'approved')
        reloadExpenses()
        refresh()
      }
      return
    }
    setModerationId(id)
    try {
      await patchExpenseRequestStatus(Number(id), { status: 'approved' })
      reloadExpenses()
      refresh()
    } catch (e: unknown) {
      setModerationError(e instanceof Error ? e.message : 'Не удалось согласовать заявку.')
    } finally {
      setModerationId(null)
    }
  }

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return
    const id = rejectTarget.id
    setModerationError(null)
    if (EXPENSES_OFFLINE) {
      const next = setExpenseRequestStatus(id, 'rejected', { rejectionReason: reason })
      if (next) {
        syncCalendarExpensesWithRequestStatus(id, 'rejected', reason)
        reloadExpenses()
        refresh()
      }
      setRejectTarget(null)
      return
    }
    setModerationId(id)
    try {
      await patchExpenseRequestStatus(Number(id), { status: 'rejected', rejection_reason: reason.trim() })
      reloadExpenses()
      refresh()
      setRejectTarget(null)
    } catch (e: unknown) {
      setModerationError(e instanceof Error ? e.message : 'Не удалось отклонить заявку.')
    } finally {
      setModerationId(null)
    }
  }

  const onCreateSubmit = async (data: NewExpenseRequestInput) => {
    if (EXPENSES_OFFLINE) {
      appendExpenseRequest(data)
      refresh()
      setFormOpen(false)
      return
    }
    await createExpenseRequest({
      request_date: data.requestDate,
      department: data.department === '—' ? null : data.department || null,
      budget_category: data.budgetItem === '—' ? null : data.budgetItem || null,
      counterparty: data.counterparty === '—' ? null : data.counterparty || null,
      amount: data.amount,
      currency: data.currency,
      expense_date: data.expenseOrPaymentDate,
      description: data.description || null,
      reimbursement_type: data.expenseType,
    })
    reloadExpenses()
    refresh()
    setFormOpen(false)
  }

  const sorted = useMemo(() => [...requests].sort((a, b) => b.requestDate.localeCompare(a.requestDate)), [requests])

  return (
    <div className="exp-req-page">
      <div className="exp-req-page__sidebar-wrap">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
          isMobileOpen={isMobileOpen}
          onCloseMobile={onCloseMobile}
          isMobile={isMobile}
        />
      </div>
      <main className="exp-req-page__main">
        <header className="exp-req-page__header">
          {isMobile && (
            <button type="button" className="exp-req-page__menu-btn" onClick={onOpenMobile} aria-label="Меню">
              <IconMenu />
            </button>
          )}
          <AnimatedLink to={routes.expenses} className="exp-req-page__back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="exp-req-page__back-label">Назад</span>
          </AnimatedLink>
          <div className="exp-req-page__header-divider" aria-hidden="true" />
          <div className="exp-req-page__header-inner">
            <h1 className="exp-req-page__title">Заявки на расходы</h1>
            <button type="button" className="exp-req-page__header-primary" onClick={() => setFormOpen(true)}>
              + Новая заявка
            </button>
          </div>
        </header>

        {!EXPENSES_OFFLINE && listError && (
          <div className="exp-req-page__banner exp-req-page__banner--error" role="alert">
            {listError}
          </div>
        )}
        {!EXPENSES_OFFLINE && listLoading && !listError && (
          <div className="exp-req-page__banner exp-req-page__banner--loading" aria-live="polite">
            Загрузка заявок…
          </div>
        )}
        {moderationError && (
          <div className="exp-req-page__banner exp-req-page__banner--error" role="alert">
            {moderationError}
            <button type="button" className="exp-req-page__banner-dismiss" onClick={() => setModerationError(null)} aria-label="Закрыть">
              ×
            </button>
          </div>
        )}

        <div className="exp-req-page__content">
          {!EXPENSES_OFFLINE && listLoading ? null : sorted.length === 0 ? (
            <p className="exp-req-page__empty">Заявок пока нет.</p>
          ) : (
            <div className="exp-req-page__tiles" role="list">
              {sorted.map((r) => (
                <article
                  key={r.id}
                  className="exp-req-tile exp-req-tile--clickable"
                  role="listitem"
                  tabIndex={0}
                  aria-label={`Заявка ${r.requestNumber}, открыть все поля`}
                  onClick={() => setDetailRequest(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDetailRequest(r)
                    }
                  }}
                >
                  <header className="exp-req-tile__head">
                    <span className="exp-req-tile__num">{r.requestNumber}</span>
                    <span className={`exp-req-page__status exp-req-page__status--${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  </header>
                  <div className="exp-req-tile__body">
                    <dl className="exp-req-tile__meta">
                      <div className="exp-req-tile__field">
                        <dt>Дата заявки</dt>
                        <dd>{new Date(r.requestDate + 'T12:00:00').toLocaleDateString('ru-RU')}</dd>
                      </div>
                      <div className="exp-req-tile__field">
                        <dt>Инициатор</dt>
                        <dd>{r.initiator}</dd>
                      </div>
                      <div className="exp-req-tile__field">
                        <dt>Подразделение</dt>
                        <dd className={r.department === '—' ? 'exp-req-tile__muted' : undefined}>{r.department}</dd>
                      </div>
                      <div className="exp-req-tile__field">
                        <dt>Статья бюджета</dt>
                        <dd>{r.budgetItem}</dd>
                      </div>
                      <div className="exp-req-tile__field">
                        <dt>Контрагент</dt>
                        <dd className={r.counterparty === '—' ? 'exp-req-tile__muted' : undefined}>{r.counterparty}</dd>
                      </div>
                    </dl>
                    <div className="exp-req-tile__bottom">
                      <span className="exp-req-tile__amount">{formatMoneyAmount(r.amount, r.currency)}</span>
                      <span
                        className={`exp-req-page__type exp-req-page__type--${r.expenseType === 'non_reimbursable' ? 'noref' : 'ref'}`}
                      >
                        {EXPENSE_TYPE_LABEL[r.expenseType]}
                      </span>
                    </div>
                  </div>
                  {r.status === 'rejected' && r.rejectionReason && (
                    <p className="exp-req-tile__reject-reason">
                      <strong>Причина отклонения:</strong> {r.rejectionReason}
                    </p>
                  )}
                  {r.status === 'pending' && canModerate && (
                    <footer className="exp-req-tile__foot" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="exp-req-page__action-btn exp-req-page__action-btn--approve"
                        onClick={() => handleApprove(r.id)}
                        disabled={moderationId === r.id}
                      >
                        {moderationId === r.id ? '…' : 'Согласовать'}
                      </button>
                      <button
                        type="button"
                        className="exp-req-page__action-btn exp-req-page__action-btn--reject"
                        onClick={() => setRejectTarget(r)}
                        disabled={moderationId === r.id}
                      >
                        Отклонить
                      </button>
                    </footer>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {formOpen && (
        <ExpenseRequestFormModal
          onClose={() => setFormOpen(false)}
          onSubmit={onCreateSubmit}
        />
      )}

      {detailRequest && <ExpenseRequestDetailModal request={detailRequest} onClose={() => setDetailRequest(null)} />}

      {rejectTarget && (
        <RejectExpenseRequestModal
          requestNumber={rejectTarget.requestNumber}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </div>
  )
}
