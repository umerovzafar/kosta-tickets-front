import type { ExpenseItem, ExpenseRequestStatus } from '../model/types'
import { getExpenseApprovalStatus, isExpenseApprovedForCalendar, isExpenseEditable } from '../model/utils'

type ExpensesDetailPanelProps = {
  date: string
  expenses: ExpenseItem[]
  onViewDetails: (expense: ExpenseItem) => void
  onEdit: (expense: ExpenseItem) => void
  formatAmount: (n: number) => string
  CATEGORY_META: Record<string, { color: string; bg: string }>
}

const STATUS_SHORT: Record<ExpenseRequestStatus, string> = {
  draft: 'Черновик',
  pending: 'На согласовании',
  approved: 'Согласовано',
  rejected: 'Отклонено',
}

export function ExpensesDetailPanel({
  date,
  expenses,
  onViewDetails,
  onEdit,
  formatAmount,
  CATEGORY_META,
}: ExpensesDetailPanelProps) {
  const d = new Date(date + 'T00:00:00')
  const dateLabel = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const approved = expenses.filter(isExpenseApprovedForCalendar)
  const total = approved.reduce((s, e) => s + e.amount, 0)
  const pendingCount = expenses.filter((e) => getExpenseApprovalStatus(e) === 'pending').length

  return (
    <div className="exp-detail-panel">
      <div className="exp-detail-panel__head">
        <h3 className="exp-detail-panel__title" title={`Расходы за ${dateLabel}`}>
          Расходы за {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        </h3>
        <p className="exp-detail-panel__summary">
          {formatAmount(total)} · {approved.length} согласовано
          {pendingCount > 0 && (
            <span className="exp-detail-panel__summary-pending"> · {pendingCount} на согласовании</span>
          )}
        </p>
      </div>
      <div className="exp-detail-panel__body">
        <section
          className="exp-detail-panel__operations"
          aria-labelledby="exp-detail-panel-list-heading"
          aria-live="polite"
        >
          <h4 id="exp-detail-panel-list-heading" className="exp-detail-panel__section-title">
            Расходы за выбранную дату
          </h4>
          {expenses.length > 0 && (
            <div className="exp-detail-panel__legend" role="note" aria-label="Расшифровка статусов">
              <span className="exp-detail-panel__legend-item">
                <span className="exp-detail-panel__status-dot exp-detail-panel__status-dot--draft" aria-hidden="true" />
                Черновик
              </span>
              <span className="exp-detail-panel__legend-item">
                <span className="exp-detail-panel__status-dot exp-detail-panel__status-dot--pending" aria-hidden="true" />
                На согласовании
              </span>
              <span className="exp-detail-panel__legend-item">
                <span className="exp-detail-panel__status-dot exp-detail-panel__status-dot--approved" aria-hidden="true" />
                Согласовано
              </span>
              <span className="exp-detail-panel__legend-item">
                <span className="exp-detail-panel__status-dot exp-detail-panel__status-dot--rejected" aria-hidden="true" />
                Отклонено
              </span>
            </div>
          )}
          {expenses.length === 0 ? (
            <p className="exp-detail-panel__empty">Нет расходов за этот день</p>
          ) : (
            <ul className="exp-detail-panel__list" role="list">
              {expenses.map((e) => {
                const st = getExpenseApprovalStatus(e)
                return (
                  <li key={e.id} className="exp-detail-panel__item">
                    <button
                      type="button"
                      className="exp-detail-panel__item-inner"
                      onClick={() => onViewDetails(e)}
                      title={`${STATUS_SHORT[st]} · подробнее`}
                    >
                      <div className="exp-detail-panel__item-top">
                        <div className="exp-detail-panel__item-tags">
                          <span
                            className="exp-detail-panel__cat"
                            style={{ color: CATEGORY_META[e.category]?.color, background: CATEGORY_META[e.category]?.bg }}
                          >
                            {e.category}
                          </span>
                          <span
                            className={`exp-detail-panel__status-dot exp-detail-panel__status-dot--${st}`}
                            title={STATUS_SHORT[st]}
                            aria-hidden="true"
                          />
                        </div>
                        <span className="exp-detail-panel__amt">{formatAmount(e.amount)}</span>
                      </div>
                      {st === 'rejected' && e.rejectionReason && (
                        <p className="exp-detail-panel__reject-reason">{e.rejectionReason}</p>
                      )}
                      {(e.title || e.description) && (
                        <div className="exp-detail-panel__item-desc">
                          {e.title && <span className="exp-detail-panel__title-text">{e.title}</span>}
                          {e.description && <span className="exp-detail-panel__desc">{e.description}</span>}
                        </div>
                      )}
                    </button>
                    {isExpenseEditable(e) && (
                      <div className="exp-detail-panel__item-side" role="group" aria-label="Действия">
                        <button
                          type="button"
                          className="exp-detail-panel__icon-btn exp-detail-panel__icon-btn--edit"
                          onClick={() => onEdit(e)}
                          aria-label="Редактировать"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
