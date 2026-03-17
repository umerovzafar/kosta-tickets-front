import { useState, useCallback, useMemo, useEffect } from 'react'
import { fetchAttendance, type AttendanceRecord } from '@entities/attendance'
import { getWorkdaySettings } from '@shared/lib/attendanceSettings'
import type { LateMetrics } from '../types'

export function useAdminAttendance() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [lateLoading, setLateLoading] = useState(false)
  const [lateError, setLateError] = useState<string | null>(null)

  const loadAttendance = useCallback(async () => {
    setLateLoading(true)
    setLateError(null)
    try {
      const today = new Date()
      const date = today.toISOString().slice(0, 10)
      const records = await fetchAttendance({
        dateFrom: date,
        dateTo: date,
        maxRecordsPerDevice: 500,
      })
      setAttendance(records)
    } catch (e) {
      setLateError(e instanceof Error ? e.message : 'Не удалось загрузить посещаемость')
      setAttendance([])
    } finally {
      setLateLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  const lateMetrics = useMemo((): LateMetrics => {
    if (attendance.length === 0) {
      return { total: 0, lateCount: 0, onTime: 0, lateEmployees: [] }
    }
    const settings = getWorkdaySettings()
    const timeToMinutes = (time: string): number => {
      const [h, m] = time.split(':').map((v) => Number(v))
      if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
      return h * 60 + m
    }
    const threshold = timeToMinutes(settings.startTime) + settings.lateMinutes
    const byPerson = new Map<string, { name: string; department: string; firstTime: string }>()
    attendance.forEach((r) => {
      if (!r.time) return
      const date = r.time.slice(0, 10)
      const key = `${r.person_id || r.name || '-'}|${date}`
      const existing = byPerson.get(key)
      if (!existing || new Date(r.time).getTime() < new Date(existing.firstTime).getTime()) {
        byPerson.set(key, {
          name: r.name || r.person_id || '-',
          department: r.department || '—',
          firstTime: r.time,
        })
      }
    })
    const rows: LateMetrics['lateEmployees'] = []
    byPerson.forEach((value) => {
      const timePart = value.firstTime.slice(11, 16)
      const minutes = timeToMinutes(timePart)
      const minutesLate = minutes - threshold
      rows.push({ ...value, minutesLate: minutesLate > 0 ? minutesLate : 0 })
    })
    const total = rows.length
    const lateEmployees = rows.filter((r) => r.minutesLate > 0).sort((a, b) => b.minutesLate - a.minutesLate)
    const lateCount = lateEmployees.length
    const onTime = total - lateCount
    return { total, lateCount, onTime, lateEmployees }
  }, [attendance])

  return {
    attendance,
    lateLoading,
    lateError,
    lateMetrics,
    loadAttendance,
  }
}
