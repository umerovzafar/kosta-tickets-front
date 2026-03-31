import { getAccessToken } from '@shared/lib'

const GATEWAY_BASE = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:1234'

/** Единое сообщение: календарь недоступен или не связан с аккаунтом (сброс состояния во UI). */
export const CALENDAR_NOT_CONNECTED_MSG = 'Календарь не подключён'

export interface CalendarEvent {
  id: string
  subject?: string
  start?: { dateTime: string; timeZone?: string }
  end?: { dateTime: string; timeZone?: string }
  body?: { content?: string }
}

function getToken(): string {
  const token = getAccessToken()
  if (!token) throw new Error('Требуется авторизация')
  return token
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}` }
}

async function parseBody(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function connectOutlookCalendar(): Promise<void> {
  const res = await fetch(`${GATEWAY_BASE}/api/v1/todos/calendar/connect`, {
    method: 'GET',
    redirect: 'manual',
    headers: authHeaders(),
    credentials: 'include',
  })

  // Server-side redirect — follow Location header directly
  if (res.status === 302 || res.status === 307) {
    const url = res.headers.get('Location')
    if (url) {
      window.location.href = url
      return
    }
  }

  // Opaque redirect (CORS manual mode) — Location header not accessible,
  // fall through to body parsing below
  if (res.type === 'opaqueredirect') {
    window.location.href = `${GATEWAY_BASE}/api/v1/todos/calendar/connect`
    return
  }

  if (res.status === 401) throw new Error('Требуется авторизация')

  // Always try to parse the body — the backend may return an auth URL
  // inside the JSON body regardless of the HTTP status code
  const data = await parseBody(res)

  if (data?.url && typeof data.url === 'string') {
    window.location.href = data.url
    return
  }

  if (res.ok) return

  const detail = typeof data?.detail === 'string' ? data.detail : null

  if (res.status === 503) {
    throw new Error(
      detail
        ?? 'Сервис календаря не настроен на сервере (OAuth Microsoft). Нужны MICROSOFT_CLIENT_ID и MICROSOFT_REDIRECT_URI в сервисе todos.',
    )
  }

  if (res.status === 500) {
    throw new Error(detail ?? 'Внутренняя ошибка сервера. Проверьте логи контейнера todos.')
  }

  throw new Error(detail ?? 'Не удалось начать подключение календаря')
}

export async function getCalendarStatus(): Promise<{ connected: boolean }> {
  const res = await fetch(`${GATEWAY_BASE}/api/v1/todos/calendar/status`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (res.status === 401) throw new Error('Требуется авторизация')
  if (res.status === 503) return { connected: false }
  if (!res.ok) return { connected: false }
  return res.json()
}

export async function getCalendarEvents(
  start?: string,
  end?: string,
): Promise<CalendarEvent[]> {
  const url = new URL(`${GATEWAY_BASE}/api/v1/todos/calendar/events`)
  if (start) url.searchParams.set('start', start)
  if (end) url.searchParams.set('end', end)

  const res = await fetch(url.toString(), {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (res.status === 401) throw new Error('Требуется авторизация')
  if (res.status === 503) {
    throw new Error(CALENDAR_NOT_CONNECTED_MSG)
  }
  if (res.status === 403) {
    await parseBody(res)
    throw new Error(CALENDAR_NOT_CONNECTED_MSG)
  }
  if (!res.ok) {
    const body = await parseBody(res)
    const detail = typeof body?.detail === 'string' ? body.detail : null
    throw new Error(detail ?? `Ошибка загрузки событий (${res.status})`)
  }

  const data = await res.json()

  if (Array.isArray(data)) return data
  if (Array.isArray(data?.value)) return data.value
  if (Array.isArray(data?.events)) return data.events
  if (Array.isArray(data?.data)) return data.data

  console.warn('[CalendarAPI] Unexpected events response format:', data)
  return []
}

export async function createCalendarEvent(payload: {
  subject: string
  start: string
  end: string
  body?: string
}): Promise<CalendarEvent> {
  const res = await fetch(`${GATEWAY_BASE}/api/v1/todos/calendar/events`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error('Требуется авторизация')
  if (res.status === 403) throw new Error(CALENDAR_NOT_CONNECTED_MSG)
  if (!res.ok) throw new Error('Ошибка создания события')
  return res.json()
}
