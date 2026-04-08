import type { User } from '@entities/user'

/**
 * Кто может менять данные графика: импорт Excel (и при появлении API — правки в сетке).
 * Просмотр таблицы доступен всем авторизованным пользователям с доступом к API.
 */
const VACATION_SCHEDULE_EDIT_ROLES = new Set([
  'Главный администратор',
  'Администратор',
  'Партнер',
  'Офис менеджер',
])

export function canEditVacationSchedule(user: User | null | undefined): boolean {
  const r = user?.role?.trim()
  return !!r && VACATION_SCHEDULE_EDIT_ROLES.has(r)
}

/** Импорт Excel — то же правило, что и {@link canEditVacationSchedule}. */
export function canImportVacationSchedule(user: User | null | undefined): boolean {
  return canEditVacationSchedule(user)
}
