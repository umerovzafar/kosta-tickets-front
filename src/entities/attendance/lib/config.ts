import { getAttendanceApiBase } from '@shared/config'

export function getAttendanceApiUrl(path: string): string {
  const base = getAttendanceApiBase()
  if (!base) throw new Error('VITE_ATTENDANCE_API_BASE не задан')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
