import { getApiBaseUrl } from '@shared/config'
import { getAccessToken } from '@shared/lib'

/**
 * URL к эндпоинтам todos (календарь) на gateway.
 * Если задан `VITE_API_BASE_URL` (например https://ticketsback.kostalegal.com) — всегда он,
 * чтобы в dev OAuth шёл на тот же хост, что и `.../todos/calendar/callback` на сервере.
 * Иначе в `vite dev` на :5173 — относительный `/api` через прокси на локальный gateway.
 */
function todosApiUrl(path: string): string {
  const normalized = path.replace(/^\//, '')
  const rel = `/api/v1/todos/${normalized}`

  const base = getApiBaseUrl().replace(/\/+$/, '')
  if (base) return `${base}${rel}`

  if (import.meta.env.DEV && typeof window !== 'undefined' && window.location.port === '5173') {
    return rel
  }

  return rel
}

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
  /* redirect: manual — если сервер случайно отдаст 302 на Microsoft, fetch не пойдёт за ним (иначе CORS). */
  const res = await fetch(todosApiUrl('calendar/connect'), {
    method: 'GET',
    redirect: 'manual',
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
    credentials: 'include',
  })

  if (res.status === 401) throw new Error('Требуется авторизация')

  if (res.type === 'opaqueredirect') {
    throw new Error(
      'Несовместимый ответ сервера при подключении календаря. Убедитесь, что сервис todos обновлён: GET /calendar/connect должен отдавать JSON { "url": "..." }, без HTTP-редиректа.',
    )
  }

  if (res.status === 302 || res.status === 307) {
    const loc = res.headers.get('Location')
    if (loc) {
      window.location.href = loc
      return
    }
  }

  const data = await parseBody(res)

  if (data?.url && typeof data.url === 'string') {
    window.location.href = data.url
    return
  }

  if (res.ok) {
    throw new Error(
      'Сервер вернул 200 без поля url. Обновите сервис todos и gateway: ответ подключения календаря должен быть JSON с адресом входа Microsoft.',
    )
  }

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

export type CalendarStatusResult = { connected: boolean; detail?: string }

export async function getCalendarStatus(): Promise<CalendarStatusResult> {
  const res = await fetch(todosApiUrl('calendar/status'), {
    headers: {
      ...authHeaders(),
      Accept: 'application/json',
    },
    credentials: 'include',
  })
  if (res.status === 401) throw new Error('Требуется авторизация')
  if (!res.ok) {
    const body = await parseBody(res)
    const detail = typeof body?.detail === 'string' ? body.detail : undefined
    return { connected: false, detail }
  }
  const data = (await res.json()) as { connected?: boolean; detail?: unknown }
  return {
    connected: !!data?.connected,
    detail: typeof data?.detail === 'string' ? data.detail : undefined,
  }
}

export async function getCalendarEvents(
  start?: string,
  end?: string,
): Promise<CalendarEvent[]> {
  const path = todosApiUrl('calendar/events')
  const qs = new URLSearchParams()
  if (start) qs.set('start', start)
  if (end) qs.set('end', end)
  const url = qs.toString() ? `${path}?${qs}` : path

  const res = await fetch(url, {
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
  const res = await fetch(todosApiUrl('calendar/events'), {
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
