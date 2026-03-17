type ExpensesContextMenuProps = {
  x: number
  y: number
  dateKey: string
  dateRange: { start: string; end: string } | null
  hasComment: boolean
  onAddExpense: (dateKey: string) => void
  onShowDetails: (dateKey: string) => void
  onShowAllExpenses: () => void
  onComment: (dateKey: string) => void
  onSelectPeriod: (dateKey: string) => void
  onResetPeriod: () => void
}

export function ExpensesContextMenu({
  x,
  y,
  dateKey,
  dateRange,
  hasComment,
  onAddExpense,
  onShowDetails,
  onShowAllExpenses,
  onComment,
  onSelectPeriod,
  onResetPeriod,
}: ExpensesContextMenuProps) {
  return (
    <div
      className="exp-context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className="exp-context-menu__item" onClick={() => onAddExpense(dateKey)}>
        Добавить расход
      </button>
      <button type="button" className="exp-context-menu__item" onClick={() => onShowDetails(dateKey)}>
        Детали расходов
      </button>
      <button type="button" className="exp-context-menu__item" onClick={onShowAllExpenses}>
        Все расходы
      </button>
      <button type="button" className="exp-context-menu__item" onClick={() => onComment(dateKey)}>
        {hasComment ? 'Посмотреть комментарий' : 'Добавить комментарий'}
      </button>
      <button type="button" className="exp-context-menu__item" onClick={() => onSelectPeriod(dateKey)}>
        {dateRange ? 'Добавить в период' : 'Выбрать период'}
      </button>
      {dateRange && (
        <button type="button" className="exp-context-menu__item exp-context-menu__item--danger" onClick={onResetPeriod}>
          Сбросить период
        </button>
      )}
    </div>
  )
}
