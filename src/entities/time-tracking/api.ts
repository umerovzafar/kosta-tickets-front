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

/** Ответ gateway / time_tracking (snake_case). */
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

export function isForbiddenError(e: unknown): boolean {
  return (
    e instanceof Error &&
    /\b403\b|Недостаточно прав|доступны только администраторам|доступны администраторам/i.test(e.message)
  )
}
