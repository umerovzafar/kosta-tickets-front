import type { AttendanceQuery, AttendanceRecord } from './model/types'
import { getAttendanceApiUrl } from './lib/config'
import { buildAttendanceQuery } from './lib/query'
import { flattenAttendanceByCamera } from './lib/transform'
import { parseAttendanceJson } from './lib/parseResponse'

export async function fetchAttendance(options: AttendanceQuery): Promise<AttendanceRecord[]> {
  const query = buildAttendanceQuery(options)
  const url = `${getAttendanceApiUrl('/hikvision/attendance')}?${query}`

  const res = await fetch(url)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Failed to load attendance: ${res.status}`)
  }

  const data = await parseAttendanceJson(res)
  return flattenAttendanceByCamera(data)
}
