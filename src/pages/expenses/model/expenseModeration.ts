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

/** Весь раздел «Расходы» (/expenses и вложенные маршруты): партнёры, администраторы, IT */
const EXPENSES_SECTION_ROLES = new Set([
  'Главный администратор',
  'Администратор',
  'Партнер',
  'IT отдел',
])

export function canAccessExpensesSection(role: string | null | undefined): boolean {
  const r = role?.trim()
  if (!r) return false
  return EXPENSES_SECTION_ROLES.has(r)
}
