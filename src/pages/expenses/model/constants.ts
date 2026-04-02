import type { ExpenseAmountCurrency, ExpenseStatus, ExpenseType, PaymentMethod } from './types'

/** Статусы заявок на странице «Расходы компании» (/expenses): согласованные, отклонённые и завершённые. */
export const EXPENSE_REGISTRY_STATUSES: ExpenseStatus[] = ['approved', 'rejected', 'paid', 'closed']

export const EXPENSE_REGISTRY_STATUS_SET = new Set<ExpenseStatus>(EXPENSE_REGISTRY_STATUSES)

export const STATUS_META: Record<ExpenseStatus, { label: string }> = {
  draft:             { label: 'Черновик' },
  pending_approval:  { label: 'На согласовании' },
  revision_required: { label: 'На доработке' },
  approved:          { label: 'Одобрено' },
  rejected:          { label: 'Отклонено' },
  paid:              { label: 'Выплачено' },
  closed:            { label: 'Закрыто' },
  not_reimbursable:  { label: 'Невозмещаемый' },
  withdrawn:         { label: 'Отозвана' },
}

export const TYPE_META: Record<ExpenseType, { label: string }> = {
  transport:      { label: 'Транспорт' },
  food:           { label: 'Питание' },
  accommodation:  { label: 'Проживание' },
  purchase:       { label: 'Закупка' },
  services:       { label: 'Сервисы' },
  entertainment:  { label: 'Представительские' },
  client_expense: { label: 'За клиента' },
  other:          { label: 'Прочее' },
}

export const PAYMENT_META: Record<PaymentMethod, { label: string }> = {
  cash:          { label: 'Наличные' },
  card:          { label: 'Банковская карта' },
  transfer:      { label: 'Банковский перевод' },
  other_payment: { label: 'Другое' },
}

export const REIMBURSABLE_META: Record<string, { label: string }> = {
  reimbursable:     { label: 'Возмещаемый' },
  non_reimbursable: { label: 'Невозмещаемый' },
}

export const EXPENSE_CURRENCIES: { value: ExpenseAmountCurrency; label: string }[] = [
  { value: 'UZS', label: 'Сум' },
  { value: 'RUB', label: 'Рубли' },
  { value: 'USD', label: 'Доллары' },
  { value: 'GBP', label: 'Фунты' },
  { value: 'EUR', label: 'Евро' },
]

export const EXPENSE_TYPES: { value: ExpenseType; label: string }[] = [
  { value: 'transport',      label: 'Транспорт' },
  { value: 'food',           label: 'Питание' },
  { value: 'accommodation',  label: 'Проживание' },
  { value: 'purchase',       label: 'Закупка' },
  { value: 'services',       label: 'Сервисы' },
  { value: 'entertainment',  label: 'Представительские' },
  { value: 'client_expense', label: 'За клиента' },
  { value: 'other',          label: 'Прочее' },
]

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',          label: 'Наличные' },
  { value: 'card',          label: 'Банковская карта' },
  { value: 'transfer',      label: 'Банковский перевод' },
  { value: 'other_payment', label: 'Другое' },
]
