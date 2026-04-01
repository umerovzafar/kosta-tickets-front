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
  | 'other'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other_payment'

export interface AttachmentItem {
  id: string
  expenseRequestId: string
  fileName: string
  storageKey: string
  mimeType: string | null
  sizeBytes: number
  uploadedByUserId: number
  uploadedAt: string
}

export interface ExpenseRequest {
  id: string
  description: string
  expenseDate: string
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
  expenseType: string
  expenseSubtype: string
  isReimbursable: boolean | null
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
  expenseType?: string
  isReimbursable?: string
  amountUzs?: string
  exchangeRate?: string
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
