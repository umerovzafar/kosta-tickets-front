import { apiFetch } from '@shared/api'
import type { User } from '@entities/user'

export type HourlyRateKind = 'billable' | 'cost'

/** Элемент списка `GET /api/v1/time-tracking/users` (`id` = auth_user_id). */
export type TimeTrackingUserRow = {
  id: number
  email: string
  display_name?: string | null
  picture?: string | null
  role?: string
  is_blocked: boolean
  is_archived: boolean
  weekly_capacity_hours?: string | number
  created_at: string
  updated_at?: string | null
}

/** Ответ `GET/POST/PATCH` записей времени (snake_case). */
export type TimeEntryRow = {
  id: string
  auth_user_id: number
  work_date: string
  hours: string | number
  is_billable: boolean
  project_id: string | null
  description: string | null
  created_at: string
  updated_at: string | null
}

export type HourlyRateRow = {
  id: string
  auth_user_id: number
  rate_kind: HourlyRateKind
  amount: string | number
  currency: string
  valid_from: string | null
  valid_to: string | null
  created_at: string
  updated_at: string | null
}

function formatApiDetail(detail: unknown): string | null {
  if (detail == null) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'msg' in item) {
          const m = (item as { msg?: unknown }).msg
          if (typeof m === 'string') return m
        }
        try {
          return JSON.stringify(item)
        } catch {
          return String(item)
        }
      })
      .join('; ')
  }
  if (typeof detail === 'object') {
    try {
      return JSON.stringify(detail)
    } catch {
      return String(detail)
    }
  }
  return String(detail)
}

async function throwIfNotOk(res: Response): Promise<Response> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    const text = await res.text()
    const trimmed = text.trim()
    if (trimmed) {
      try {
        const j = JSON.parse(text) as { detail?: unknown; message?: unknown }
        const fromDetail = formatApiDetail(j.detail)
        if (fromDetail) msg = fromDetail
        else if (typeof j.message === 'string' && j.message) msg = j.message
        else msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed
      } catch {
        msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed
      }
    }
    if (res.status >= 500) {
      console.error('[time-tracking api]', res.status, msg)
    }
    throw new Error(msg)
  }
  return res
}

export type UpsertTimeTrackingUserOptions = {
  /** Если передано, обновляет норму в TT; иначе поле не отправляется (существующее значение не сбрасывается). */
  weeklyCapacityHours?: number
}

/** Синхронизация пользователя в БД учёта времени (нужна до ставок). См. TIME_TRACKING_HOURLY_RATES.md */
export async function upsertTimeTrackingUser(user: User, options?: UpsertTimeTrackingUserOptions): Promise<void> {
  const email = (user.email ?? '').trim()
  if (!email) {
    throw new Error('У пользователя нет email — запрос синхронизации не пройдёт валидацию на gateway')
  }
  const body: Record<string, unknown> = {
    auth_user_id: user.id,
    email,
    display_name: user.display_name,
    picture: user.picture,
    role: user.role ?? '',
    is_blocked: user.is_blocked,
    is_archived: user.is_archived,
  }
  if (options?.weeklyCapacityHours !== undefined) {
    body.weekly_capacity_hours = options.weeklyCapacityHours
  }
  const res = await apiFetch('/api/v1/time-tracking/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)
}

/** Удалить пользователя из списка TT (manage-роль на gateway). */
export async function deleteTimeTrackingUser(authUserId: number): Promise<void> {
  const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}`, { method: 'DELETE' })
  await throwIfNotOk(res)
}

/** Список пользователей в учёте времени (права просмотра TT на gateway). */
export async function listTimeTrackingUsers(): Promise<TimeTrackingUserRow[]> {
  const res = await apiFetch('/api/v1/time-tracking/users')
  await throwIfNotOk(res)
  return (await res.json()) as TimeTrackingUserRow[]
}

/**
 * Агрегат загрузки команды за период (даты YYYY-MM-DD).
 * См. tickets-back `docs/TIME_TRACKING_TEAM_WORKLOAD.md` при наличии.
 */
export async function getTeamWorkload(
  from: string,
  to: string,
  options?: { includeArchived?: boolean },
): Promise<unknown> {
  const qs = new URLSearchParams({ from, to })
  if (options?.includeArchived) qs.set('includeArchived', 'true')
  const res = await apiFetch(`/api/v1/time-tracking/team-workload?${qs}`)
  await throwIfNotOk(res)
  return res.json()
}

/** `from` / `to` — даты YYYY-MM-DD (query `from`, `to` на сервисе). */
export async function listTimeEntries(authUserId: number, from: string, to: string): Promise<TimeEntryRow[]> {
  const qs = new URLSearchParams({ from, to })
  const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries?${qs}`)
  await throwIfNotOk(res)
  return (await res.json()) as TimeEntryRow[]
}

export async function createTimeEntry(
  authUserId: number,
  body: {
    workDate: string
    hours: string | number
    isBillable?: boolean
    projectId?: string | null
    description?: string | null
  },
): Promise<TimeEntryRow> {
  const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workDate: body.workDate,
      hours: body.hours,
      isBillable: body.isBillable ?? true,
      projectId: body.projectId ?? null,
      description: body.description ?? null,
    }),
  })
  await throwIfNotOk(res)
  return (await res.json()) as TimeEntryRow
}

export async function patchTimeEntry(
  authUserId: number,
  entryId: string,
  patch: {
    workDate?: string
    hours?: string | number
    isBillable?: boolean
    projectId?: string | null
    description?: string | null
  },
): Promise<TimeEntryRow> {
  const res = await apiFetch(
    `/api/v1/time-tracking/users/${authUserId}/time-entries/${encodeURIComponent(entryId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  )
  await throwIfNotOk(res)
  return (await res.json()) as TimeEntryRow
}

export async function deleteTimeEntry(authUserId: number, entryId: string): Promise<void> {
  const res = await apiFetch(
    `/api/v1/time-tracking/users/${authUserId}/time-entries/${encodeURIComponent(entryId)}`,
    { method: 'DELETE' },
  )
  await throwIfNotOk(res)
}

export async function listHourlyRates(authUserId: number, kind: HourlyRateKind): Promise<HourlyRateRow[]> {
  const qs = new URLSearchParams({ kind })
  const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates?${qs}`)
  await throwIfNotOk(res)
  return (await res.json()) as HourlyRateRow[]
}

export async function createHourlyRate(
  authUserId: number,
  body: {
    rateKind: HourlyRateKind
    amount: string
    currency: string
    validFrom: string | null
    validTo: string | null
  },
): Promise<HourlyRateRow> {
  const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rateKind: body.rateKind,
      amount: body.amount,
      currency: body.currency,
      validFrom: body.validFrom,
      validTo: body.validTo,
    }),
  })
  await throwIfNotOk(res)
  return (await res.json()) as HourlyRateRow
}

export async function patchHourlyRate(
  authUserId: number,
  rateId: string,
  patch: {
    amount?: string
    currency?: string
    validFrom?: string | null
    validTo?: string | null
  },
): Promise<HourlyRateRow> {
  const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates/${encodeURIComponent(rateId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  await throwIfNotOk(res)
  return (await res.json()) as HourlyRateRow
}

export async function deleteHourlyRate(authUserId: number, rateId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates/${encodeURIComponent(rateId)}`, {
    method: 'DELETE',
  })
  await throwIfNotOk(res)
}

/** Ответ `GET/PUT .../users/{id}/project-access` (camelCase или snake_case). */
export type UserProjectAccessOut = {
  projectIds: string[]
}

function parseUserProjectAccess(raw: unknown): UserProjectAccessOut {
  if (!raw || typeof raw !== 'object') return { projectIds: [] }
  const o = raw as { projectIds?: unknown; project_ids?: unknown }
  const ids = o.projectIds ?? o.project_ids
  if (!Array.isArray(ids)) return { projectIds: [] }
  return { projectIds: ids.map(String) }
}

export async function getUserProjectAccess(authUserId: number): Promise<UserProjectAccessOut> {
  const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/project-access`)
  await throwIfNotOk(res)
  return parseUserProjectAccess(await res.json())
}

export async function putUserProjectAccess(authUserId: number, projectIds: string[]): Promise<UserProjectAccessOut> {
  const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/project-access`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectIds }),
  })
  await throwIfNotOk(res)
  return parseUserProjectAccess(await res.json())
}

/** Ответ `GET/POST/PATCH` клиентов time manager (snake_case). Проценты могут приходить как строки из Decimal. */
export type TimeManagerClientRow = {
  id: string
  name: string
  address: string | null
  currency: string
  invoice_due_mode: string
  invoice_due_days_after_issue: number | null
  tax_percent: string | number | null
  tax2_percent: string | number | null
  discount_percent: string | number | null
  created_at: string
  updated_at: string | null
}

export type TimeManagerClientCreatePayload = {
  name: string
  address?: string | null
  currency?: string
  invoiceDueMode?: string
  invoiceDueDaysAfterIssue?: number | null
  taxPercent?: number | null
  tax2Percent?: number | null
  discountPercent?: number | null
}

export type TimeManagerClientPatchPayload = {
  name?: string
  address?: string | null
  currency?: string
  invoiceDueMode?: string
  invoiceDueDaysAfterIssue?: number | null
  taxPercent?: number | null
  tax2Percent?: number | null
  discountPercent?: number | null
}

export async function listTimeManagerClients(): Promise<TimeManagerClientRow[]> {
  const res = await apiFetch('/api/v1/time-tracking/clients')
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientRow[]
}

export async function getTimeManagerClient(clientId: string): Promise<TimeManagerClientRow> {
  const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}`)
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientRow
}

export async function createTimeManagerClient(body: TimeManagerClientCreatePayload): Promise<TimeManagerClientRow> {
  const res = await apiFetch('/api/v1/time-tracking/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name,
      address: body.address ?? null,
      currency: body.currency ?? 'USD',
      invoiceDueMode: body.invoiceDueMode ?? 'custom',
      invoiceDueDaysAfterIssue: body.invoiceDueDaysAfterIssue ?? null,
      taxPercent: body.taxPercent ?? null,
      tax2Percent: body.tax2Percent ?? null,
      discountPercent: body.discountPercent ?? null,
    }),
  })
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientRow
}

export async function patchTimeManagerClient(
  clientId: string,
  patch: TimeManagerClientPatchPayload,
): Promise<TimeManagerClientRow> {
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.address !== undefined) payload.address = patch.address
  if (patch.currency !== undefined) payload.currency = patch.currency
  if (patch.invoiceDueMode !== undefined) payload.invoiceDueMode = patch.invoiceDueMode
  if (patch.invoiceDueDaysAfterIssue !== undefined) payload.invoiceDueDaysAfterIssue = patch.invoiceDueDaysAfterIssue
  if (patch.taxPercent !== undefined) payload.taxPercent = patch.taxPercent
  if (patch.tax2Percent !== undefined) payload.tax2Percent = patch.tax2Percent
  if (patch.discountPercent !== undefined) payload.discountPercent = patch.discountPercent
  const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientRow
}

export async function deleteTimeManagerClient(clientId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' })
  await throwIfNotOk(res)
}

/** Задача клиента (справочник), ответ API в snake_case. */
export type TimeManagerClientTaskRow = {
  id: string
  client_id: string
  name: string
  default_billable_rate: string | number | null
  billable_by_default: boolean
  common_for_future_projects: boolean
  add_to_existing_projects: boolean
  created_at: string
  updated_at: string | null
}

export type TimeManagerClientTaskCreatePayload = {
  name: string
  defaultBillableRate?: number | null
  billableByDefault?: boolean
  commonForFutureProjects?: boolean
  addToExistingProjects?: boolean
}

export type TimeManagerClientTaskPatchPayload = {
  name?: string
  defaultBillableRate?: number | null
  billableByDefault?: boolean
  commonForFutureProjects?: boolean
  addToExistingProjects?: boolean
}

export async function listClientTasks(clientId: string): Promise<TimeManagerClientTaskRow[]> {
  const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/tasks`)
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientTaskRow[]
}

export async function getClientTask(clientId: string, taskId: string): Promise<TimeManagerClientTaskRow> {
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/tasks/${encodeURIComponent(taskId)}`,
  )
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientTaskRow
}

export async function createClientTask(
  clientId: string,
  body: TimeManagerClientTaskCreatePayload,
): Promise<TimeManagerClientTaskRow> {
  const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name,
      defaultBillableRate: body.defaultBillableRate ?? null,
      billableByDefault: body.billableByDefault ?? true,
      commonForFutureProjects: body.commonForFutureProjects ?? false,
      addToExistingProjects: body.addToExistingProjects ?? false,
    }),
  })
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientTaskRow
}

export async function patchClientTask(
  clientId: string,
  taskId: string,
  patch: TimeManagerClientTaskPatchPayload,
): Promise<TimeManagerClientTaskRow> {
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.defaultBillableRate !== undefined) payload.defaultBillableRate = patch.defaultBillableRate
  if (patch.billableByDefault !== undefined) payload.billableByDefault = patch.billableByDefault
  if (patch.commonForFutureProjects !== undefined) payload.commonForFutureProjects = patch.commonForFutureProjects
  if (patch.addToExistingProjects !== undefined) payload.addToExistingProjects = patch.addToExistingProjects
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientTaskRow
}

export async function deleteClientTask(clientId: string, taskId: string): Promise<void> {
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' },
  )
  await throwIfNotOk(res)
}

/** Категория расходов клиента (справочник time manager). */
export type TimeManagerClientExpenseCategoryRow = {
  id: string
  client_id: string
  name: string
  has_unit_price: boolean
  is_archived: boolean
  sort_order: number | null
  created_at: string
  updated_at: string | null
  usage_count: number
  deletable: boolean
}

export type TimeManagerClientExpenseCategoryCreatePayload = {
  name: string
  hasUnitPrice?: boolean
  sortOrder?: number | null
}

export type TimeManagerClientExpenseCategoryPatchPayload = {
  name?: string
  hasUnitPrice?: boolean
  isArchived?: boolean
  sortOrder?: number | null
}

export async function listClientExpenseCategories(
  clientId: string,
  options?: { includeArchived?: boolean },
): Promise<TimeManagerClientExpenseCategoryRow[]> {
  const qs = new URLSearchParams()
  if (options?.includeArchived) qs.set('includeArchived', 'true')
  const suffix = qs.toString() ? `?${qs}` : ''
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories${suffix}`,
  )
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientExpenseCategoryRow[]
}

export async function getClientExpenseCategory(
  clientId: string,
  categoryId: string,
): Promise<TimeManagerClientExpenseCategoryRow> {
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories/${encodeURIComponent(categoryId)}`,
  )
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientExpenseCategoryRow
}

export async function createClientExpenseCategory(
  clientId: string,
  body: TimeManagerClientExpenseCategoryCreatePayload,
): Promise<TimeManagerClientExpenseCategoryRow> {
  const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name,
      hasUnitPrice: body.hasUnitPrice ?? false,
      sortOrder: body.sortOrder ?? null,
    }),
  })
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientExpenseCategoryRow
}

export async function patchClientExpenseCategory(
  clientId: string,
  categoryId: string,
  patch: TimeManagerClientExpenseCategoryPatchPayload,
): Promise<TimeManagerClientExpenseCategoryRow> {
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined) payload.name = patch.name
  if (patch.hasUnitPrice !== undefined) payload.hasUnitPrice = patch.hasUnitPrice
  if (patch.isArchived !== undefined) payload.isArchived = patch.isArchived
  if (patch.sortOrder !== undefined) payload.sortOrder = patch.sortOrder
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories/${encodeURIComponent(categoryId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientExpenseCategoryRow
}

export async function deleteClientExpenseCategory(clientId: string, categoryId: string): Promise<void> {
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories/${encodeURIComponent(categoryId)}`,
    { method: 'DELETE' },
  )
  await throwIfNotOk(res)
}

/** Проект клиента (справочник time manager). См. tickets-back `docs/TIME_TRACKING_FRONTEND.md` §5.2, `FRONTEND_TIME_MANAGER_PROJECTS.md`. */
export type TimeManagerClientProjectRow = {
  id: string
  client_id: string
  name: string
  code: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  report_visibility: string
  project_type: string
  billable_rate_type: string | null
  budget_type: string | null
  budget_amount: string | number | null
  budget_hours: string | number | null
  budget_resets_every_month: boolean
  budget_includes_expenses: boolean
  send_budget_alerts: boolean
  budget_alert_threshold_percent: string | number | null
  fixed_fee_amount: string | number | null
  usage_count: number
  deletable: boolean
  created_at: string
  updated_at: string | null
}

export type TimeManagerClientProjectCodeHint = {
  last_code: string | null
  suggested_next: string | null
}

export type TimeManagerClientProjectCreatePayload = {
  name: string
  code?: string | null
  startDate?: string | null
  endDate?: string | null
  notes?: string | null
  reportVisibility?: string
  projectType?: string
  billableRateType?: string | null
  budgetType?: string | null
  budgetAmount?: string | number | null
  budgetHours?: string | number | null
  budgetResetsEveryMonth?: boolean
  budgetIncludesExpenses?: boolean
  sendBudgetAlerts?: boolean
  budgetAlertThresholdPercent?: string | number | null
  fixedFeeAmount?: string | number | null
}

export type TimeManagerClientProjectPatchPayload = {
  name?: string
  code?: string | null
  startDate?: string | null
  endDate?: string | null
  notes?: string | null
  reportVisibility?: string
  projectType?: string
  billableRateType?: string | null
  budgetType?: string | null
  budgetAmount?: string | number | null
  budgetHours?: string | number | null
  budgetResetsEveryMonth?: boolean
  budgetIncludesExpenses?: boolean
  sendBudgetAlerts?: boolean
  budgetAlertThresholdPercent?: string | number | null
  fixedFeeAmount?: string | number | null
}

function projectCreateBody(body: TimeManagerClientProjectCreatePayload): Record<string, unknown> {
  const o: Record<string, unknown> = { name: body.name }
  if (body.code !== undefined) o.code = body.code
  if (body.startDate !== undefined) o.startDate = body.startDate
  if (body.endDate !== undefined) o.endDate = body.endDate
  if (body.notes !== undefined) o.notes = body.notes
  if (body.reportVisibility !== undefined) o.reportVisibility = body.reportVisibility
  if (body.projectType !== undefined) o.projectType = body.projectType
  if (body.billableRateType !== undefined) o.billableRateType = body.billableRateType
  if (body.budgetType !== undefined) o.budgetType = body.budgetType
  if (body.budgetAmount !== undefined) o.budgetAmount = body.budgetAmount
  if (body.budgetHours !== undefined) o.budgetHours = body.budgetHours
  if (body.budgetResetsEveryMonth !== undefined) o.budgetResetsEveryMonth = body.budgetResetsEveryMonth
  if (body.budgetIncludesExpenses !== undefined) o.budgetIncludesExpenses = body.budgetIncludesExpenses
  if (body.sendBudgetAlerts !== undefined) o.sendBudgetAlerts = body.sendBudgetAlerts
  if (body.budgetAlertThresholdPercent !== undefined) o.budgetAlertThresholdPercent = body.budgetAlertThresholdPercent
  if (body.fixedFeeAmount !== undefined) o.fixedFeeAmount = body.fixedFeeAmount
  return o
}

function projectPatchBody(patch: TimeManagerClientProjectPatchPayload): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  if (patch.name !== undefined) o.name = patch.name
  if (patch.code !== undefined) o.code = patch.code
  if (patch.startDate !== undefined) o.startDate = patch.startDate
  if (patch.endDate !== undefined) o.endDate = patch.endDate
  if (patch.notes !== undefined) o.notes = patch.notes
  if (patch.reportVisibility !== undefined) o.reportVisibility = patch.reportVisibility
  if (patch.projectType !== undefined) o.projectType = patch.projectType
  if (patch.billableRateType !== undefined) o.billableRateType = patch.billableRateType
  if (patch.budgetType !== undefined) o.budgetType = patch.budgetType
  if (patch.budgetAmount !== undefined) o.budgetAmount = patch.budgetAmount
  if (patch.budgetHours !== undefined) o.budgetHours = patch.budgetHours
  if (patch.budgetResetsEveryMonth !== undefined) o.budgetResetsEveryMonth = patch.budgetResetsEveryMonth
  if (patch.budgetIncludesExpenses !== undefined) o.budgetIncludesExpenses = patch.budgetIncludesExpenses
  if (patch.sendBudgetAlerts !== undefined) o.sendBudgetAlerts = patch.sendBudgetAlerts
  if (patch.budgetAlertThresholdPercent !== undefined) o.budgetAlertThresholdPercent = patch.budgetAlertThresholdPercent
  if (patch.fixedFeeAmount !== undefined) o.fixedFeeAmount = patch.fixedFeeAmount
  return o
}

export async function getClientProjectCodeHint(clientId: string): Promise<TimeManagerClientProjectCodeHint> {
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/code-hint`,
  )
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientProjectCodeHint
}

export async function listClientProjects(clientId: string): Promise<TimeManagerClientProjectRow[]> {
  const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects`)
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientProjectRow[]
}

export async function getClientProject(clientId: string, projectId: string): Promise<TimeManagerClientProjectRow> {
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`,
  )
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientProjectRow
}

export async function createClientProject(
  clientId: string,
  body: TimeManagerClientProjectCreatePayload,
): Promise<TimeManagerClientProjectRow> {
  const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectCreateBody(body)),
  })
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientProjectRow
}

export async function patchClientProject(
  clientId: string,
  projectId: string,
  patch: TimeManagerClientProjectPatchPayload,
): Promise<TimeManagerClientProjectRow> {
  const payload = projectPatchBody(patch)
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  await throwIfNotOk(res)
  return (await res.json()) as TimeManagerClientProjectRow
}

export async function deleteClientProject(clientId: string, projectId: string): Promise<void> {
  const res = await apiFetch(
    `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`,
    { method: 'DELETE' },
  )
  await throwIfNotOk(res)
}

/** Все проекты всех клиентов (для настройки доступа пользователю). */
export async function listAllClientProjectsForPicker(): Promise<TimeManagerClientProjectRow[]> {
  const clients = await listTimeManagerClients()
  if (clients.length === 0) return []
  const chunks = await Promise.all(
    clients.map((c) =>
      listClientProjects(c.id).catch((e) => {
        if (isForbiddenError(e)) throw e
        return [] as TimeManagerClientProjectRow[]
      }),
    ),
  )
  const rows = chunks.flat()
  const nameById = new Map(clients.map((c) => [c.id, c.name]))
  rows.sort((a, b) => {
    const ca = nameById.get(a.client_id) ?? ''
    const cb = nameById.get(b.client_id) ?? ''
    const cmp = ca.localeCompare(cb, 'ru', { sensitivity: 'base' })
    if (cmp !== 0) return cmp
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
  })
  return rows
}

export function isForbiddenError(e: unknown): boolean {
  return (
    e instanceof Error &&
    /\b403\b|Недостаточно прав|доступны только администраторам|доступны администраторам|доступа к проектам/i.test(
      e.message,
    )
  )
}
