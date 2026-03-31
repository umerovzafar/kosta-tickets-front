import { getAttendanceApiBase, getApiBaseUrl } from '@shared/config'

function normalizeBase(value: string): string {
  const s = value.replace(/\/+$/, '')
  if (s.endsWith('/api/v1')) return s.slice(0, -'/api/v1'.length)
  return s
}

/**
 * База для сервиса attendance:
 * - если задан `VITE_ATTENDANCE_API_BASE` — он (отдельный gateway);
 * - иначе общий `VITE_API_BASE_URL` (как у остального API);
 * - иначе пустая строка — относительные пути `/api/...` (Vite proxy в dev).
 */
export function getAttendanceResolvedBaseUrl(): string {
  const dedicated = getAttendanceApiBase()
  if (dedicated) return normalizeBase(dedicated)
  return getApiBaseUrl()
}

/** Полный URL к эндпоинту attendance, например `/api/v1/attendance/report/daily`. */
export function getAttendanceApiUrl(path: string): string {
  const base = getAttendanceResolvedBaseUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}
