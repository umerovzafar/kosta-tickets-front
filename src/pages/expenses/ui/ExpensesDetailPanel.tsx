import { useState, useEffect } from 'react'
import type { ExpenseItem } from '../model/types'

type ExpensesDetailPanelProps = {
  date: string
  expenses: ExpenseItem[]
  dayComment: string
  onCommentSave: (comment: string) => void
  onAdd: () => void
  onEdit: (expense: ExpenseItem) => void
  onRemove: (id: string) => void
  formatAmount: (n: number) => string
  CATEGORY_META: Record<string, { color: string; bg: string }>
}

export function ExpensesDetailPanel({
  date,
  expenses,
  dayComment,
  onCommentSave,
  onAdd,
  onEdit,
  onRemove,
  formatAmount,
  CATEGORY_META,
}: ExpensesDetailPanelProps) {
  const [comment, setComment] = useState(dayComment)

  const handleCommentBlur = () => {
    if (comment.trim() !== dayComment.trim()) {
      onCommentSave(comment.trim())
    }
  }

  useEffect(() => {
    setComment(dayComment)
  }, [date, dayComment])

  const d = new Date(date + 'T00:00:00')
  const dateLabel = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="exp-detail-panel">
      <div className="exp-detail-panel__head">
        <h3 className="exp-detail-panel__title" title={`Расходы за ${dateLabel}`}>
          Расходы за {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        </h3>
        <p className="exp-detail-panel__summary">{formatAmount(total)} · {expenses.length} операций</p>
      </div>
      <div className="exp-detail-panel__body">
        <section className="exp-detail-panel__comment">
          <label className="exp-detail-panel__comment-label">Комментарий к дате</label>
          <textarea
            className="exp-detail-panel__comment-input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={handleCommentBlur}
            placeholder="Заметка к этой дате..."
            rows={3}
          />
          <p className="exp-detail-panel__comment-hint">Сохраняется при потере фокуса</p>
        </section>
        {expenses.length === 0 ? (
          <p className="exp-detail-panel__empty">Нет расходов за этот день</p>
        ) : (
          <ul className="exp-detail-panel__list">
            {expenses.map((e) => (
              <li key={e.id} className="exp-detail-panel__item">
                <button
                  type="button"
                  className="exp-detail-panel__item-inner"
                  onClick={() => onEdit(e)}
                  title="Редактировать"
                >
                  <div className="exp-detail-panel__item-top">
                    <span
                      className="exp-detail-panel__cat"
                      style={{ color: CATEGORY_META[e.category]?.color, background: CATEGORY_META[e.category]?.bg }}
                    >
                      {e.category}
                    </span>
                    <span className="exp-detail-panel__amt">{formatAmount(e.amount)}</span>
                  </div>
                  {(e.title || e.description) && (
                    <div className="exp-detail-panel__item-desc">
                      {e.title && <span className="exp-detail-panel__title-text">{e.title}</span>}
                      {e.description && <span className="exp-detail-panel__desc">{e.description}</span>}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  className="exp-detail-panel__del"
                  onClick={(ev) => { ev.stopPropagation(); onRemove(e.id) }}
                  aria-label="Удалить"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="exp-detail-panel__add" onClick={onAdd}>
          + Добавить расход
        </button>
      </div>
    </div>
  )
}
