import { getAccessToken } from '@shared/lib'

const GATEWAY_BASE = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:1234'

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

async function extractErrorDetail(res: Response): Promise<string | null> {
  try {
    const data = await res.json()
    return data?.detail ?? null
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

  if (res.status === 302 || res.status === 307) {
    const url = res.headers.get('Location')
    if (url) {
      window.location.href = url
      return
    }
  }

  if (res.type === 'opaqueredirect') {
    const url = res.headers.get('Location')
    if (url) {
      window.location.href = url
      return
    }
  }

  if (res.ok) {
    const data = await res.json().catch(() => null)
    if (data?.url) {
      window.location.href = data.url
      return
    }
  }

  if (res.status === 401) throw new Error('Требуется авторизация')

  if (res.status === 503) {
    const detail = await extractErrorDetail(res)
    throw new Error(detail ?? 'Сервис календаря недоступен. Проверьте настройки backend (MICROSOFT_CLIENT_ID, AUTH_SERVICE_URL).')
  }

  if (res.status === 500) {
    const detail = await extractErrorDetail(res)
    throw new Error(detail ?? 'Внутренняя ошибка сервера. Проверьте логи контейнера todos.')
  }

  throw new Error('Не удалось начать подключение календаря')
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
  if (res.status === 403) throw new Error('Календарь не подключён')
  if (!res.ok) {
    const detail = await extractErrorDetail(res)
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
  if (res.status === 403) throw new Error('Календарь не подключён')
  if (!res.ok) throw new Error('Ошибка создания события')
  return res.json()
}
