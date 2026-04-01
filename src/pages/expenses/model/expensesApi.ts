import { apiFetch } from '@shared/api'
import type { ExpenseRequest, ListParams, ExpenseTypeRef, ProjectRef } from './types'

interface ListResponse {
  items: ExpenseRequest[]
  total: number
  skip: number
  limit: number
}

interface ExchangeRateResponse {
  date: string
  rate: number
  pairLabel: string
}

async function throwIfNotOk(res: Response): Promise<Response> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.clone().json() as { detail?: string; message?: string }
      if (j.detail) msg = j.detail
      else if (j.message) msg = j.message
    } catch { /* ignore parse errors */ }
    throw new Error(msg)
  }
  return res
}

export async function fetchExpenses(params: ListParams = {}): Promise<ListResponse> {
  const qs = new URLSearchParams()
  if (params.status)                    qs.set('status', params.status)
  if (params.expenseType)               qs.set('expenseType', params.expenseType)
  if (params.isReimbursable !== undefined) qs.set('isReimbursable', String(params.isReimbursable))
  if (params.dateFrom)                  qs.set('dateFrom', params.dateFrom)
  if (params.dateTo)                    qs.set('dateTo', params.dateTo)
  if (params.q)                         qs.set('q', params.q)
  if (params.sortBy)                    qs.set('sortBy', params.sortBy)
  if (params.sortOrder)                 qs.set('sortOrder', params.sortOrder)
  if (params.skip !== undefined)        qs.set('skip', String(params.skip))
  if (params.limit !== undefined)       qs.set('limit', String(params.limit))
  const query = qs.toString()
  const res = await apiFetch(`/api/v1/expenses${query ? `?${query}` : ''}`)
  await throwIfNotOk(res)
  return res.json() as Promise<ListResponse>
}

export interface ExpenseCreateBody {
  description: string
  expenseDate: string
  amountUzs: number
  exchangeRate: number
  expenseType: string
  expenseSubtype?: string
  isReimbursable: boolean
  paymentMethod?: string
  projectId?: string
  vendor?: string
  businessPurpose?: string
  comment?: string
}

export async function createExpense(body: ExpenseCreateBody): Promise<ExpenseRequest> {
  const res = await apiFetch('/api/v1/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)
  return res.json() as Promise<ExpenseRequest>
}

export async function updateExpense(id: string, body: Partial<ExpenseCreateBody>): Promise<ExpenseRequest> {
  const res = await apiFetch(`/api/v1/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)
  return res.json() as Promise<ExpenseRequest>
}

export async function submitExpense(id: string): Promise<ExpenseRequest> {
  const res = await apiFetch(`/api/v1/expenses/${id}/submit`, { method: 'POST' })
  await throwIfNotOk(res)
  return res.json() as Promise<ExpenseRequest>
}

export async function withdrawExpense(id: string): Promise<ExpenseRequest> {
  const res = await apiFetch(`/api/v1/expenses/${id}/withdraw`, { method: 'POST' })
  await throwIfNotOk(res)
  return res.json() as Promise<ExpenseRequest>
}

export async function uploadAttachment(id: string, file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch(`/api/v1/expenses/${id}/attachments`, {
    method: 'POST',
    body: form,
  })
  await throwIfNotOk(res)
}

export async function deleteAttachment(id: string, attId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/expenses/${id}/attachments/${attId}`, { method: 'DELETE' })
  await throwIfNotOk(res)
}

export async function fetchExpenseTypes(): Promise<ExpenseTypeRef[]> {
  const res = await apiFetch('/api/v1/expense-types')
  await throwIfNotOk(res)
  return res.json() as Promise<ExpenseTypeRef[]>
}

export async function fetchProjects(): Promise<ProjectRef[]> {
  const res = await apiFetch('/api/v1/projects')
  await throwIfNotOk(res)
  return res.json() as Promise<ProjectRef[]>
}

export async function fetchExchangeRate(date: string): Promise<ExchangeRateResponse> {
  const res = await apiFetch(`/api/v1/exchange-rates?date=${date}`)
  await throwIfNotOk(res)
  return res.json() as Promise<ExchangeRateResponse>
}
