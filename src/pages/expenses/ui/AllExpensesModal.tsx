import type { ExpenseItem } from '../model/types'

type AllExpensesModalProps = {
  expenses: ExpenseItem[]
  onClose: () => void
  onRemove: (id: string) => void
  formatAmount: (n: number) => string
  CATEGORY_META: Record<string, { color: string; bg: string }>
}

export function AllExpensesModal(props: AllExpensesModalProps) {
  const { expenses, onClose, onRemove, formatAmount, CATEGORY_META } = props
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date))
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="exp-modal" role="dialog" aria-modal="true">
      <div className="exp-modal__backdrop" onClick={onClose} />
      <div className="exp-modal__dialog exp-modal__dialog--wide exp-modal__dialog--tall">
        <div className="exp-modal__head">
          <h3 className="exp-modal__title">Все расходы</h3>
          <p className="exp-modal__date">{formatAmount(total)} · {expenses.length} операций</p>
          <button type="button" className="exp-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="exp-details exp-details--scroll">
          {sorted.length === 0 ? (
            <p className="exp-details__empty">Нет расходов</p>
          ) : (
            <ul className="exp-details__list">
              {sorted.map((e) => (
                <li key={e.id} className="exp-details__item">
                  <span className="exp-details__date">{new Date(e.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                  <span
                    className="exp-details__cat"
                    style={{ color: CATEGORY_META[e.category]?.color, background: CATEGORY_META[e.category]?.bg }}
                  >
                    {e.category}
                  </span>
                  <div className="exp-details__main">
                    {e.title && <span className="exp-details__title">{e.title}</span>}
                    {e.description && <span className="exp-details__desc">{e.description}</span>}
                  </div>
                  <span className="exp-details__amt">{formatAmount(e.amount)}</span>
                  <button type="button" className="exp-details__del" onClick={() => onRemove(e.id)} aria-label="Удалить">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
