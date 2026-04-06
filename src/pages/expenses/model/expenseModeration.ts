/**
 * Роли, которые видят очередь «На согласование», отчёт Excel по расходам и кнопки согласования.
 * Синхронизируйте с `ROLES_MODERATE` в tickets-back/expenses/presentation/deps.py
 * (там сравнение через `_normalize_role_key`: trim, lower, ё→е).
 */
const ROLES_MODERATE_CANONICAL = ['Главный администратор', 'Администратор', 'Партнер'] as const

function normalizeExpenseRoleKey(role: string | null | undefined): string {
  return (role ?? '').trim().toLowerCase().replace(/ё/g, 'е')
}

const EXPENSE_MODERATION_ROLE_KEYS = new Set(ROLES_MODERATE_CANONICAL.map(r => normalizeExpenseRoleKey(r)))

export function canModerateExpenseRequests(role: string | null | undefined): boolean {
  const rk = normalizeExpenseRoleKey(role)
  if (!rk) return false
  return EXPENSE_MODERATION_ROLE_KEYS.has(rk)
}

/** Разделы «Заявки» и «Отчётность» в шапке расходов — те же роли, что и модерация заявок */
export function canViewExpensesRequestsAndReport(role: string | null | undefined): boolean {
  return canModerateExpenseRequests(role)
}

/** Раздел «Расходы» (/expenses и вложенные маршруты): любой авторизованный пользователь с ролью (как в ROLES_VIEW на бэкенде). */
export function canAccessExpensesSection(role: string | null | undefined): boolean {
  return Boolean(role?.trim())
}
