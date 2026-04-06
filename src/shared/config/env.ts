/**
 * Базовый URL API для `apiFetch`, OAuth и WebSocket (через тот же хост).
 *
 * - Пустой `VITE_API_BASE_URL` → в dev запросы на `/api/v1/...` идут на origin SPA, Vite проксирует `/api` на `VITE_PROXY_TARGET`.
 * - Задан `VITE_API_BASE_URL` → абсолютный URL gateway (прод или прямой API).
 *
 * См. `docs/FRONTEND_CONNECTION.md` и tickets-back `docs/FRONTEND_CONNECTION.md`.
 */
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL

function normalizeBaseUrl(value: string): string {
  const s = value.replace(/\/+$/, '')
  if (s.endsWith('/api/v1')) return s.slice(0, -'/api/v1'.length)
  return s
}

export function getApiBaseUrl(): string {
  if (typeof rawBaseUrl !== 'string' || !rawBaseUrl) return ''
  return normalizeBaseUrl(rawBaseUrl)
}

export function getAzureLoginUrl(): string {
  const base = getApiBaseUrl()
  if (!base) return ''
  return `${base}/api/v1/auth/azure/login`
}

export function getAzureLogoutUrl(): string {
  const base = getApiBaseUrl()
  if (!base) return ''
  return `${base}/api/v1/auth/azure/logout`
}

export function getAdminLoginUrl(): string {
  const base = getApiBaseUrl()
  if (!base) return ''
  return `${base}/api/v1/auth/admin/login`
}

function getWsUrl(path: string): string {
  const base = getApiBaseUrl()
  if (!base) return ''
  const wsProtocol = base.startsWith('https') ? 'wss' : 'ws'
  const host = base.replace(/^https?:\/\//, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${wsProtocol}://${host}${p}`
}

export function getTicketsWsUrl(): string {
  return getWsUrl('/api/v1/tickets/ws/tickets')
}

export function getNotificationsWsUrl(): string {
  return getWsUrl('/api/v1/notifications/ws')
}

export function getAttendanceApiBase(): string {
  const v = import.meta.env.VITE_ATTENDANCE_API_BASE
  if (typeof v !== 'string' || !v.trim()) return ''
  return v.trim().replace(/\/+$/, '')
}

export const AUTH_ERROR_AUTH_FAILED = 'auth_failed'
