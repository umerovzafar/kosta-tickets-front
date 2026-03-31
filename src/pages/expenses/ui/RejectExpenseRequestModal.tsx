import { useState } from 'react'
import './ExpensesPage.css'
import './ExpensesRequestsPage.css'

type RejectExpenseRequestModalProps = {
  requestNumber: string
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function RejectExpenseRequestModal({ requestNumber, onClose, onConfirm }: RejectExpenseRequestModalProps) {
  const [reason, setReason] = useState('')
  const [showError, setShowError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = reason.trim()
    if (!t) {
      setShowError(true)
      return
    }
    onConfirm(t)
  }

  return (
    <div className="exp-modal exp-modal--reject" role="dialog" aria-modal="true" aria-labelledby="exp-reject-title">
      <div className="exp-modal__backdrop" onClick={onClose} />
      <div className="exp-modal__dialog exp-modal__dialog--narrow exp-modal__dialog--reject">
        <div className="exp-modal__head exp-modal__head--reject">
          <h3 id="exp-reject-title" className="exp-modal__title">
            Отклонить заявку
          </h3>
          <p className="exp-modal__reject-ref">{requestNumber}</p>
          <button type="button" className="exp-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form className="exp-modal__form exp-modal__form--reject" onSubmit={handleSubmit}>
          <label className="exp-modal__field">
            <span className="exp-modal__label">Причина отклонения</span>
            <textarea
              className="exp-modal__input exp-modal__textarea exp-modal__textarea--reject"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setShowError(false)
              }}
              placeholder="Укажите причину отклонения заявки"
              rows={4}
              required
              aria-invalid={showError}
              aria-describedby={showError ? 'exp-reject-error' : undefined}
            />
          </label>
          {showError && (
            <p id="exp-reject-error" className="exp-modal__reject-error" role="alert">
              Введите причину отклонения
            </p>
          )}
          <div className="exp-modal__foot exp-modal__foot--reject">
            <button type="button" className="exp-modal__btn exp-modal__btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="exp-modal__btn exp-modal__btn--reject-send">
              Отклонить заявку
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
