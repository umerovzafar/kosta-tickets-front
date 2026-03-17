import { formatDateForInput } from '@shared/lib/formatDate'

export const TYPE_OPTIONS = [
  { value: '', label: 'Все записи' },
  { value: 'late', label: 'Только опоздания' },
  { value: 'overtime', label: 'Только переработки' },
] as const

export function parseDateInput(s: string): string {
  return s || ''
}

export const defaultFrom = () => formatDateForInput(new Date())
export const defaultTo = () => formatDateForInput(new Date())
