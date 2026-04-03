export const routes = {
  login: '/',
  home: '/home',
  authCallback: '/auth/callback',
  ticketDetail: '/ticket/:uuid',
  attendance: '/attendance',
  inventory: '/inventory',
  timeTracking: '/time-tracking',
  todo: '/todo',
  admin: '/admin',
  userEdit: '/admin/user/:id',
  projectDetail: '/time-tracking/project/:id',
  timesheet: '/timesheet',
  expenses: '/expenses',
  expensesRequests: '/expenses/requests',
  expensesReport: '/expenses/report',
  rules: '/rules',
  help: '/help',
} as const

export function getTicketDetailUrl(uuid: string): string {
  return `/ticket/${uuid}`
}

export function getUserEditUrl(id: number): string {
  return `/admin/user/${id}`
}

export function getProjectDetailUrl(id: string): string {
  return `/time-tracking/project/${id}`
}

/** Реестр расходов: открыть заявку по id (ссылки из e-mail: `?intent=approve|reject`). */
export function getExpensesOpenUrl(expenseId: string): string {
  return `/expenses/${encodeURIComponent(expenseId)}`
}

