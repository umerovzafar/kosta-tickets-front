import { useState, useCallback, useMemo, useEffect } from 'react'
import { fetchAttendance, type AttendanceRecord } from '@entities/attendance'
import type { WorkdaySettings } from '@shared/lib/attendanceSettings'
import { parseDateInput } from '../constants'
import { timeToMinutes } from '../lib/timeToMinutes'
import { groupRecords } from '../lib/groupRecords'
import type { AttendanceSummary } from '../types'

export function useAttendanceData(
  dateFrom: string,
  dateTo: string,
  search: string,
  typeFilter: string,
  settings: WorkdaySettings
) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const from = parseDateInput(dateFrom) || new Date().toISOString().slice(0, 10)
      const to = parseDateInput(dateTo) || undefined
      const res = await fetchAttendance({
        dateFrom: from,
        dateTo: to,
        name: search || undefined,
        maxRecordsPerDevice: 500,
      })
      setRecords(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, search])

  useEffect(() => {
    load()
  }, [load])

  const groupedRecords = useMemo(() => groupRecords(records), [records])

  const filteredGroupedRecords = useMemo(() => {
    if (!typeFilter) return groupedRecords

    const startMinutes = timeToMinutes(settings.startTime)
    const lateThreshold = startMinutes + settings.lateMinutes

    return groupedRecords.filter((row) => {
      if (!row.firstTime || !row.lastTime) return false
      const startDate = new Date(row.firstTime)
      const endDate = new Date(row.lastTime)
      const firstMinutes = startDate.getHours() * 60 + startDate.getMinutes()
      const workedHours = Math.max(0, (endDate.getTime() - startDate.getTime()) / 3_600_000)

      if (typeFilter === 'late') return firstMinutes > lateThreshold
      if (typeFilter === 'overtime') return workedHours > settings.dailyHours
      return true
    })
  }, [groupedRecords, typeFilter, settings])

  const summary = useMemo((): AttendanceSummary => {
    let lateness = 0
    let overtime = 0
    let totalMinutes = 0

    const startMinutes = timeToMinutes(settings.startTime)
    const lateThreshold = startMinutes + settings.lateMinutes

    filteredGroupedRecords.forEach((row) => {
      if (!row.firstTime || !row.lastTime) return
      const s = new Date(row.firstTime)
      const e = new Date(row.lastTime)
      const firstMin = s.getHours() * 60 + s.getMinutes()
      const workedMin = Math.max(0, (e.getTime() - s.getTime()) / 60_000)
      totalMinutes += workedMin
      if (firstMin > lateThreshold) lateness++
      if (workedMin / 60 > settings.dailyHours) overtime++
    })

    const totalHours = totalMinutes / 60
    const avg = filteredGroupedRecords.length > 0 ? totalHours / filteredGroupedRecords.length : 0

    return {
      entries: filteredGroupedRecords.length,
      lateness,
      overtime,
      total_hours: totalHours,
      avg_hours_per_entry: avg,
    }
  }, [filteredGroupedRecords, settings])

  const showTable = !loading && !error && filteredGroupedRecords.length > 0

  return {
    records,
    loading,
    error,
    load,
    groupedRecords,
    filteredGroupedRecords,
    summary,
    showTable,
  }
}
