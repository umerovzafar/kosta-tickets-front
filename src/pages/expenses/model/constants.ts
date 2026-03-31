import type { ExpenseCategory } from './types'

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Транспорт',
  'Питание',
  'Командировка',
  'Офис',
  'ПО и сервисы',
  'Представительские',
  'Прочее',
]

export const CATEGORY_META: Record<ExpenseCategory, { color: string; bg: string }> = {
  'Транспорт': { color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  'Питание': { color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  'Командировка': { color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
  'Офис': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
  'ПО и сервисы': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  'Представительские': { color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
  'Прочее': { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
}

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const STORAGE_KEY = 'expenses-calendar-data'

export const DEFAULT_CURRENCY = 'UZS'

/** Подсказки для поля «Подразделение» в заявке (можно ввести свой текст). */
export const EXPENSE_REQUEST_DEPARTMENT_HINTS = [
  'Юридический отдел',
  'IT',
  'Бухгалтерия',
  'HR',
  'Командировки',
  'Администрация',
] as const
