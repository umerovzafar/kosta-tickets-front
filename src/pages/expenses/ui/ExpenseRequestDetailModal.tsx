import type { ExpenseRequest, ExpenseRequestExpenseType, ExpenseRequestStatus } from '../model/types'
import { formatMoneyAmount } from '../model/utils'
import './ExpensesPage.css'
import './ExpensesRequestsPage.css'

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

function formatIsoDate(iso: string): string {
  if (!iso?.trim()) return '—'
  const d = new Date(`${iso.trim()}T12:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ru-RU')
}

type ExpenseRequestDetailModalProps = {
  request: ExpenseRequest
  onClose: () => void
}

export function ExpenseRequestDetailModal({ request: r, onClose }: ExpenseRequestDetailModalProps) {
  const muted = (v: string) => v === '—'

  return (
    <div className="exp-modal exp-modal--req-detail" role="dialog" aria-modal="true" aria-labelledby="exp-req-detail-title">
      <div className="exp-modal__backdrop" onClick={onClose} />
      <div className="exp-modal__dialog exp-modal__dialog--wide exp-modal__dialog--tall exp-req-detail-modal">
        <div className="exp-modal__head exp-req-detail-modal__head">
          <div className="exp-req-detail-modal__head-text">
            <h3 id="exp-req-detail-title" className="exp-modal__title exp-req-detail-modal__title">
              Заявка <span className="exp-req-detail-modal__num">{r.requestNumber}</span>
            </h3>
            <p className="exp-modal__date exp-req-detail-modal__subtitle">Все поля заявки на расход</p>
          </div>
          <button type="button" className="exp-modal__close exp-req-detail-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="exp-req-detail exp-req-detail--modern">
          <div className="exp-req-detail__status-strip">
            <span className="exp-req-detail__status-label">Статус</span>
            <span className={`exp-req-detail__status-pill exp-req-detail__status-pill--${r.status}`}>{STATUS_LABEL[r.status]}</span>
          </div>

          <div className="exp-req-detail__body">
            <section className="exp-req-detail__card" aria-labelledby="exp-req-detail-sec-req">
              <h4 id="exp-req-detail-sec-req" className="exp-req-detail__card-title">
                Реквизиты
              </h4>
              <dl className="exp-req-detail__dl">
                <div className="exp-req-detail__row">
                  <dt>Дата заявки</dt>
                  <dd>{formatIsoDate(r.requestDate)}</dd>
                </div>
                <div className="exp-req-detail__row">
                  <dt>Инициатор</dt>
                  <dd>{r.initiator || '—'}</dd>
                </div>
                <div className="exp-req-detail__row">
                  <dt>Подразделение</dt>
                  <dd className={muted(r.department) ? 'exp-req-detail__muted' : undefined}>{r.department}</dd>
                </div>
                <div className="exp-req-detail__row">
                  <dt>Статья бюджета</dt>
                  <dd>{r.budgetItem || '—'}</dd>
                </div>
                <div className="exp-req-detail__row">
                  <dt>Контрагент</dt>
                  <dd className={muted(r.counterparty) ? 'exp-req-detail__muted' : undefined}>{r.counterparty}</dd>
                </div>
              </dl>
            </section>

            <section className="exp-req-detail__card" aria-labelledby="exp-req-detail-sec-money">
              <h4 id="exp-req-detail-sec-money" className="exp-req-detail__card-title">
                Сумма и сроки
              </h4>
              <dl className="exp-req-detail__dl">
                <div className="exp-req-detail__row exp-req-detail__row--highlight">
                  <dt>Сумма</dt>
                  <dd className="exp-req-detail__amount">{formatMoneyAmount(r.amount, r.currency)}</dd>
                </div>
                <div className="exp-req-detail__row">
                  <dt>Валюта</dt>
                  <dd>
                    <span className="exp-req-detail__mono">{r.currency}</span>
                  </dd>
                </div>
                <div className="exp-req-detail__row">
                  <dt>Дата расхода / оплаты</dt>
                  <dd>{formatIsoDate(r.expenseOrPaymentDate)}</dd>
                </div>
                <div className="exp-req-detail__row">
                  <dt>Тип расхода</dt>
                  <dd>
                    <span className={`exp-req-detail__type-pill exp-req-detail__type-pill--${r.expenseType === 'non_reimbursable' ? 'noref' : 'ref'}`}>
                      {EXPENSE_TYPE_LABEL[r.expenseType]}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="exp-req-detail__card" aria-labelledby="exp-req-detail-sec-desc">
              <h4 id="exp-req-detail-sec-desc" className="exp-req-detail__card-title">
                Описание и вложения
              </h4>
              <dl className="exp-req-detail__dl">
                <div className="exp-req-detail__row exp-req-detail__row--block">
                  <dt>Описание расхода</dt>
                  <dd className="exp-req-detail__multiline exp-req-detail__desc-box">{r.description?.trim() || '—'}</dd>
                </div>
                <div className="exp-req-detail__row exp-req-detail__row--block">
                  <dt>Вложения</dt>
                  <dd>
                    {r.attachments?.length ? (
                      <ul className="exp-req-detail__files">
                        {r.attachments.map((name) => (
                          <li key={name}>
                            <span className="exp-req-detail__file-icon" aria-hidden="true">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </span>
                            {name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="exp-req-detail__muted exp-req-detail__empty-files">Нет файлов</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            {r.status === 'rejected' && r.rejectionReason?.trim() && (
              <div className="exp-req-detail__reject exp-req-detail__reject--modern">
                <strong>Причина отклонения</strong>
                <p>{r.rejectionReason.trim()}</p>
              </div>
            )}
          </div>
        </div>

        <div className="exp-modal__foot exp-req-detail-modal__foot">
          <button type="button" className="exp-modal__btn exp-modal__btn--primary exp-req-detail-modal__btn-close" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
