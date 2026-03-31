import { formatDateForInput } from '@shared/lib/formatDate'

/** Период &gt; 1 дня: сырые события Hikvision */
export const LEGACY_TYPE_OPTIONS = [
  { value: '', label: 'Все записи' },
  { value: 'late', label: 'Только опоздания' },
  { value: 'overtime', label: 'Только переработки' },
] as const

/** Один день: дневной отчёт со всеми сотрудниками */
export const DAILY_TYPE_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'present_on_time', label: 'Вовремя' },
  { value: 'late', label: 'Опоздания' },
  { value: 'absent', label: 'Отсутствуют' },
] as const

/** @deprecated используйте LEGACY_TYPE_OPTIONS / DAILY_TYPE_OPTIONS по режиму */
export const TYPE_OPTIONS = LEGACY_TYPE_OPTIONS

export function parseDateInput(s: string): string {
  return s || ''
}

export const defaultFrom = () => formatDateForInput(new Date())
export const defaultTo = () => formatDateForInput(new Date())
