import type { ExpenseItem } from '../model/types'

type Props = {
  expenses: ExpenseItem[]
  formatAmount: (n: number) => string
  CATEGORY_META: Record<string, { color: string; bg: string }>
}

export function ExpensesReportTable({ expenses, formatAmount, CATEGORY_META }: Props) {
  if (expenses.length === 0) {
    return <p className="exp-report-page__empty">Нет расходов за выбранный период</p>
  }

  return (
    <div className="exp-report-page__table-wrap">
      <table className="exp-report-page__table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Категория</th>
            <th>Описание</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.date + 'T00:00:00').toLocaleDateString('ru-RU')}</td>
              <td>
                <span
                  className="exp-report-page__cat-badge"
                  style={{ color: CATEGORY_META[e.category]?.color, background: CATEGORY_META[e.category]?.bg }}
                >
                  {e.category}
                </span>
              </td>
              <td>{e.title || e.description || '—'}</td>
              <td className="exp-report-page__amt">{formatAmount(e.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
