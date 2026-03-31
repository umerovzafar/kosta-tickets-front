import type { ExpenseItem, ExpenseRequestStatus } from '../model/types'
import { getExpenseApprovalStatus, isExpenseEditable } from '../model/utils'
import './ExpensesPage.css'

const STATUS_LABEL: Record<ExpenseRequestStatus, string> = {
  draft: 'Черновик',
  pending: 'На согласовании',
  approved: 'Согласовано',
  rejected: 'Отклонено',
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ru-RU')
}

function isReceiptImageSrc(src: string): boolean {
  if (src.startsWith('data:image/')) return true
  if (/^https?:\/\//i.test(src)) return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(src)
  return false
}

function isPdfReceipt(src: string): boolean {
  return src.startsWith('data:application/pdf') || /\.pdf(\?|$)/i.test(src)
}

type ExpenseItemDetailModalProps = {
  expense: ExpenseItem
  formatAmount: (n: number, currency?: string) => string
  onClose: () => void
  onEdit: () => void
}

export function ExpenseItemDetailModal({ expense: e, formatAmount, onClose, onEdit }: ExpenseItemDetailModalProps) {
  const st = getExpenseApprovalStatus(e)
  const editable = isExpenseEditable(e)

  return (
    <div className="exp-modal exp-modal--item-detail" role="dialog" aria-modal="true" aria-labelledby="exp-item-detail-title">
      <div className="exp-modal__backdrop" onClick={onClose} />
      <div className="exp-modal__dialog exp-modal__dialog--narrow exp-item-detail-modal">
        <div className="exp-modal__head exp-item-detail-modal__head">
          <h3 id="exp-item-detail-title" className="exp-modal__title">
            Операция
          </h3>
          <p className="exp-modal__date exp-item-detail-modal__lead">{formatAmount(e.amount, e.currency)} · {e.category}</p>
          <button type="button" className="exp-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="exp-item-detail-modal__legend" role="note" aria-label="Расшифровка статусов">
          <span className="exp-item-detail-modal__legend-item">
            <span className="exp-item-detail-modal__dot exp-item-detail-modal__dot--draft" aria-hidden="true" />
            Черновик
          </span>
          <span className="exp-item-detail-modal__legend-item">
            <span className="exp-item-detail-modal__dot exp-item-detail-modal__dot--pending" aria-hidden="true" />
            На согласовании
          </span>
          <span className="exp-item-detail-modal__legend-item">
            <span className="exp-item-detail-modal__dot exp-item-detail-modal__dot--approved" aria-hidden="true" />
            Согласовано
          </span>
          <span className="exp-item-detail-modal__legend-item">
            <span className="exp-item-detail-modal__dot exp-item-detail-modal__dot--rejected" aria-hidden="true" />
            Отклонено
          </span>
        </div>

        <div className="exp-item-detail-modal__body">
          <dl className="exp-item-detail-modal__dl">
            <div className="exp-item-detail-modal__row">
              <dt>Дата</dt>
              <dd>{formatDate(e.date)}</dd>
            </div>
            <div className="exp-item-detail-modal__row">
              <dt>Категория</dt>
              <dd>{e.category}</dd>
            </div>
            <div className="exp-item-detail-modal__row">
              <dt>Сумма</dt>
              <dd className="exp-item-detail-modal__amount">{formatAmount(e.amount, e.currency)}</dd>
            </div>
            <div className="exp-item-detail-modal__row">
              <dt>Статус</dt>
              <dd>
                <span className="exp-item-detail-modal__status-line">
                  <span className={`exp-item-detail-modal__dot exp-item-detail-modal__dot--${st}`} title={STATUS_LABEL[st]} aria-hidden="true" />
                  <span className="exp-item-detail-modal__status-text">{STATUS_LABEL[st]}</span>
                </span>
              </dd>
            </div>
            {st === 'rejected' && e.rejectionReason?.trim() && (
              <div className="exp-item-detail-modal__reject">
                <strong>Причина отклонения</strong>
                <p>{e.rejectionReason.trim()}</p>
              </div>
            )}
            {(e.title || e.description) && (
              <div className="exp-item-detail-modal__row exp-item-detail-modal__row--block">
                <dt>Комментарий</dt>
                <dd className="exp-item-detail-modal__comment-dd">
                  <div className="exp-item-detail-modal__comment-scroll" tabIndex={0}>
                    {e.title && <div className="exp-item-detail-modal__title-line">{e.title}</div>}
                    {e.description && <div className="exp-item-detail-modal__desc-line">{e.description}</div>}
                  </div>
                </dd>
              </div>
            )}
            {e.requestId && (
              <div className="exp-item-detail-modal__row">
                <dt>Связь с заявкой</dt>
                <dd className="exp-item-detail-modal__muted exp-item-detail-modal__mono">{e.requestId}</dd>
              </div>
            )}
            {e.receiptPhoto && (
              <div className="exp-item-detail-modal__row exp-item-detail-modal__row--block">
                <dt>Чек</dt>
                <dd className="exp-item-detail-modal__receipt-dd">
                  {isReceiptImageSrc(e.receiptPhoto) ? (
                    <a
                      href={e.receiptPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="exp-item-detail-modal__receipt-link exp-item-detail-modal__receipt-link--image"
                      aria-label="Открыть чек в полном размере"
                    >
                      <img src={e.receiptPhoto} alt="Чек" className="exp-item-detail-modal__thumb" />
                    </a>
                  ) : (
                    <a
                      href={e.receiptPhoto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="exp-item-detail-modal__receipt-link exp-item-detail-modal__receipt-link--file"
                      aria-label="Открыть вложение"
                    >
                      <span className="exp-item-detail-modal__file-thumb-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                        </svg>
                      </span>
                      <span className="exp-item-detail-modal__file-thumb-label">
                        {isPdfReceipt(e.receiptPhoto) ? 'PDF' : 'Файл'}
                      </span>
                    </a>
                  )}
                  <span className="exp-item-detail-modal__receipt-hint">Нажмите для просмотра</span>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="exp-modal__foot exp-item-detail-modal__foot">
          <button type="button" className="exp-modal__btn exp-modal__btn--ghost" onClick={onClose}>
            Закрыть
          </button>
          {editable && (
            <button type="button" className="exp-modal__btn exp-modal__btn--primary" onClick={onEdit}>
              Редактировать
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
