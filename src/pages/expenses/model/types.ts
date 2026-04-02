export type ExpenseStatus =
  | 'draft'
  | 'pending_approval'
  | 'revision_required'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'closed'
  | 'not_reimbursable'
  | 'withdrawn'

export type ExpenseType =
  | 'transport'
  | 'food'
  | 'accommodation'
  | 'purchase'
  | 'services'
  | 'entertainment'
  | 'client_expense'
  | 'other'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other_payment'

/** Валюта ввода суммы в форме (в API хранится сумма в UZS). */
export type ExpenseAmountCurrency = 'UZS' | 'USD' | 'RUB' | 'GBP' | 'EUR'

/** Тип вложения (сохраняется в API как attachmentKind). */
export type ExpenseAttachmentKind = 'payment_document' | 'payment_receipt'

/** Файлы для загрузки по типам (новая заявка / черновик). */
export type ExpenseFilesByKind = Record<ExpenseAttachmentKind, File[]>

export const EXPENSE_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

/** Профиль автора заявки (gateway + auth), см. tickets-back/docs/expenses-frontend.md */
export interface ExpenseCreatedBy {
  id: number
  displayName: string | null
  email: string | null
  picture?: string | null
  position?: string | null
}

export interface AttachmentItem {
  id: string
  expenseRequestId: string
  fileName: string
  storageKey: string
  mimeType: string | null
  sizeBytes: number
  /** payment_document | payment_receipt | отсутствует у старых вложений */
  attachmentKind?: string | null
  uploadedByUserId: number
  uploadedAt: string
}

export interface ExpenseRequest {
  id: string
  description: string
  expenseDate: string
  /** Конечный срок оплаты (ISO YYYY-MM-DD), опционально */
  paymentDeadline?: string | null
  amountUzs: number
  exchangeRate: number
  equivalentAmount: number
  expenseType: string
  expenseSubtype: string | null
  isReimbursable: boolean
  paymentMethod: string | null
  departmentId: string | null
  projectId: string | null
  vendor: string | null
  businessPurpose: string | null
  comment: string | null
  status: ExpenseStatus
  createdByUserId: number
  /** Обогащение из auth в ответах списка и GET по id */
  createdBy?: ExpenseCreatedBy
  updatedByUserId: number
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  paidAt: string | null
  closedAt: string | null
  withdrawnAt: string | null
  attachmentsCount: number
  attachments?: AttachmentItem[]
}

export interface ExpenseFormValues {
  description: string
  expenseDate: string
  paymentDeadline: string
  expenseType: string
  isReimbursable: boolean | null
  /** Валюта поля «Сумма». */
  amountCurrency: ExpenseAmountCurrency
  /** Единиц выбранной валюты за 1 USD (нужно для RUB, GBP, EUR). */
  foreignPerUsd: string
  amountUzs: string
  exchangeRate: string
  paymentMethod: string
  projectId: string
  vendor: string
  businessPurpose: string
  comment: string
}

export interface ExpenseFormErrors {
  description?: string
  expenseDate?: string
  paymentDeadline?: string
  expenseType?: string
  isReimbursable?: string
  amountUzs?: string
  exchangeRate?: string
  foreignPerUsd?: string
  attachmentsPaymentDoc?: string
  attachmentsReceipt?: string
}

export interface ExpenseTypeRef {
  code: string
  label: string
  sortOrder: number
}

export interface ProjectRef {
  id: string
  name: string
}

export interface ListParams {
  status?: string
  expenseType?: string
  isReimbursable?: boolean
  dateFrom?: string
  dateTo?: string
  q?: string
  sortBy?: string
  sortOrder?: string
  skip?: number
  limit?: number
}
