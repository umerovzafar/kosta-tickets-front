/** Совпадает с `ROLES_MODERATE` в tickets-back/expenses/presentation/deps.py */
const EXPENSE_MODERATION_ROLES = new Set([
  'Главный администратор',
  'Администратор',
  'Партнер',
])

export function canModerateExpenseRequests(role: string | null | undefined): boolean {
  const r = role?.trim()
  if (!r) return false
  return EXPENSE_MODERATION_ROLES.has(r)
}

/** Разделы «Заявки» и «Отчётность» в шапке расходов — те же роли, что и модерация заявок */
export function canViewExpensesRequestsAndReport(role: string | null | undefined): boolean {
  return canModerateExpenseRequests(role)
}

/** Раздел «Расходы» (/expenses и вложенные маршруты): любой авторизованный пользователь с ролью (как в ROLES_VIEW на бэкенде). */
export function canAccessExpensesSection(role: string | null | undefined): boolean {
  return Boolean(role?.trim())
}
