import type { ExpenseRequestStatus } from './types'
import { loadExpensesFromStorage, saveExpensesToStorage } from './lib/storage'

/** Обновляет статус согласования у строк календаря, привязанных к заявке */
export function syncCalendarExpensesWithRequestStatus(
  requestId: string,
  status: ExpenseRequestStatus,
  rejectionReason?: string,
): void {
  const items = loadExpensesFromStorage()
  let changed = false
  const next = items.map((e) => {
    if (e.requestId === requestId) {
      changed = true
      return {
        ...e,
        approvalStatus: status,
        rejectionReason: status === 'rejected' ? rejectionReason?.trim() || undefined : undefined,
      }
    }
    return e
  })
  if (changed) saveExpensesToStorage(next)
}
