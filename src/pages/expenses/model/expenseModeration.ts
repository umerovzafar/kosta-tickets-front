/**
 * Роли, которые видят очередь «На согласование», отчёт Excel по расходам и кнопки согласования.
 * Синхронизируйте с `ROLES_MODERATE` в tickets-back/expenses/presentation/deps.py
 */
const EXPENSE_MODERATION_ROLES_LC = new Set([
  'главный администратор',
  'администратор',
  'партнер',
  'партнёр',
])

export function canModerateExpenseRequests(role: string | null | undefined): boolean {
  const r = role?.trim().toLowerCase()
  if (!r) return false
  return EXPENSE_MODERATION_ROLES_LC.has(r)
}

/** Разделы «Заявки» и «Отчётность» в шапке расходов — те же роли, что и модерация заявок */
export function canViewExpensesRequestsAndReport(role: string | null | undefined): boolean {
  return canModerateExpenseRequests(role)
}

/** Раздел «Расходы» (/expenses и вложенные маршруты): любой авторизованный пользователь с ролью (как в ROLES_VIEW на бэкенде). */
export function canAccessExpensesSection(role: string | null | undefined): boolean {
  return Boolean(role?.trim())
}
