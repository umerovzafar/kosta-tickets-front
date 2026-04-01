import type { ExpenseStatus, ExpenseType, PaymentMethod } from './types'

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
  transport:     { label: 'Транспорт' },
  food:          { label: 'Питание' },
  accommodation: { label: 'Проживание' },
  purchase:      { label: 'Закупка' },
  services:      { label: 'Сервисы' },
  entertainment: { label: 'Представительские' },
  other:         { label: 'Прочее' },
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

export const EXPENSE_TYPES: { value: ExpenseType; label: string }[] = [
  { value: 'transport',     label: 'Транспорт' },
  { value: 'food',          label: 'Питание' },
  { value: 'accommodation', label: 'Проживание' },
  { value: 'purchase',      label: 'Закупка' },
  { value: 'services',      label: 'Сервисы' },
  { value: 'entertainment', label: 'Представительские' },
  { value: 'other',         label: 'Прочее' },
]

export const SUBTYPES: Record<ExpenseType, string[]> = {
  transport:     ['Такси', 'Автобус', 'Метро', 'Самолёт', 'Поезд', 'Аренда авто'],
  food:          ['Обед', 'Ужин', 'Завтрак', 'Банкет'],
  accommodation: ['Гостиница', 'Апартаменты', 'Хостел'],
  purchase:      ['Канцтовары', 'Оргтехника', 'Расходники', 'Мебель'],
  services:      ['ПО / лицензии', 'Хостинг', 'Облачные сервисы', 'Подписка'],
  entertainment: ['Встреча с клиентом', 'Корпоратив', 'Деловой ужин', 'Подарки'],
  other:         [],
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',          label: 'Наличные' },
  { value: 'card',          label: 'Банковская карта' },
  { value: 'transfer',      label: 'Банковский перевод' },
  { value: 'other_payment', label: 'Другое' },
]
