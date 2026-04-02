import { ExpensesPage } from './ExpensesPage'

/** Очередь заявок в статусе «На согласовании»; согласование — партнёры и администраторы. */
export function ExpensesRequestsPage() {
  return <ExpensesPage variant="moderationQueue" />
}
