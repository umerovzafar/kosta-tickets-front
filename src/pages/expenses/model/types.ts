export type ExpenseCategory =
  | 'Транспорт'
  | 'Питание'
  | 'Командировка'
  | 'Офис'
  | 'ПО и сервисы'
  | 'Представительские'
  | 'Прочее'

/** Статус согласования заявки и строки в календаре */
export type ExpenseRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export type ExpenseItem = {
  id: string
  date: string
  category: ExpenseCategory
  amount: number
  currency: string
  title?: string
  description: string
  receiptPhoto?: string
  /** Связь с заявкой на расход; при смене статуса заявки обновляется и календарь */
  requestId?: string
  /** Статус согласования; если нет — считаем старые записи согласованными */
  approvalStatus?: ExpenseRequestStatus
  /** Копия причины отклонения заявки (для отображения в календаре) */
  rejectionReason?: string
}

export type ReportViewMode = 'day' | 'week' | 'month' | 'period'

export type PeriodSummary = {
  start: string
  end: string
  total: number
  count: number
  byCategory: Record<string, number>
  byDay: DaySummary[]
}

export type DaySummary = {
  date: string
  total: number
  count: number
  expenses: ExpenseItem[]
}

export type WeekSummary = {
  weekStart: string
  total: number
  count: number
  days: DaySummary[]
}

export type MonthSummary = {
  year: number
  month: number
  total: number
  count: number
  byCategory: Record<string, number>
  byWeek: WeekSummary[]
}

/** Возмещаемый / невозмещаемый */
export type ExpenseRequestExpenseType = 'reimbursable' | 'non_reimbursable'

/** Заявка на расход — полная модель для согласования и учёта */
export type ExpenseRequest = {
  id: string
  /** Номер заявки (человекочитаемый), присваивается при сохранении */
  requestNumber: string
  /** Дата создания заявки (ISO date YYYY-MM-DD) */
  requestDate: string
  /** Инициатор — обычно текущий пользователь, только для чтения в форме */
  initiator: string
  /** Подразделение инициатора; пустое в UI сохраняется как «—» */
  department: string
  /** Статья бюджета (категория из EXPENSE_CATEGORIES или уточнение для «Прочее») */
  budgetItem: string
  /** Получатель платежа; пустое — «—» */
  counterparty: string
  amount: number
  currency: string
  /** Назначение / комментарий к расходу (видно согласующим) */
  description: string
  /** Фактическая или планируемая дата расхода/оплаты */
  expenseOrPaymentDate: string
  /** Имена прикреплённых файлов (локально; позже — загрузка на сервер) */
  attachments: string[]
  expenseType: ExpenseRequestExpenseType
  status: ExpenseRequestStatus
  /** Причина отклонения (если status === 'rejected') */
  rejectionReason?: string
}
