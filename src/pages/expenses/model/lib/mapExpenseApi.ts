import type { ExpenseCategory, ExpenseItem, ExpenseRequest, ExpenseRequestStatus } from '../types'
import { EXPENSE_CATEGORIES } from '../constants'
import type { ExpenseRequestOut } from '@entities/expenses'

function toNum(v: string | number): number {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function mapStatus(s: string): ExpenseRequestStatus {
  if (s === 'draft' || s === 'pending' || s === 'approved' || s === 'rejected') return s
  return 'pending'
}

function budgetToCategory(budget: string | null | undefined): ExpenseCategory {
  const t = (budget || '').trim()
  const found = EXPENSE_CATEGORIES.find((c) => c === t)
  return found ?? 'Прочее'
}

export function expenseRequestOutToExpenseRequest(row: ExpenseRequestOut): ExpenseRequest {
  const id = String(row.id)
  return {
    id,
    requestNumber: row.public_id?.trim() || `#${row.id}`,
    requestDate: row.request_date.slice(0, 10),
    initiator: row.initiator_name?.trim() || '—',
    department: row.department?.trim() || '—',
    budgetItem: row.budget_category?.trim() || '—',
    counterparty: row.counterparty?.trim() || '—',
    amount: toNum(row.amount),
    currency: row.currency || 'UZS',
    description: row.description?.trim() || '',
    expenseOrPaymentDate: row.expense_date.slice(0, 10),
    attachments: row.attachments?.map((a) => a.file_path) ?? [],
    expenseType: row.reimbursement_type === 'non_reimbursable' ? 'non_reimbursable' : 'reimbursable',
    status: mapStatus(row.status),
    rejectionReason: row.rejection_reason ?? undefined,
  }
}

export function expenseRequestOutToExpenseItem(row: ExpenseRequestOut): ExpenseItem {
  return {
    id: `er-${row.id}`,
    date: row.expense_date.slice(0, 10),
    category: budgetToCategory(row.budget_category),
    amount: toNum(row.amount),
    currency: row.currency || 'UZS',
    title: row.counterparty?.trim() || undefined,
    description: row.description?.trim() || '—',
    approvalStatus: mapStatus(row.status),
    rejectionReason: row.rejection_reason ?? undefined,
    requestId: String(row.id),
  }
}
