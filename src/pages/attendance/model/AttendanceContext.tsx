import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { getWorkdaySettings } from '@shared/lib/attendanceSettings'
import { defaultFrom, defaultTo, TYPE_OPTIONS } from './constants'
import type { AttendanceContextValue } from './AttendanceContext.types'
import { useAttendanceData } from './hooks/useAttendanceData'
import { exportAttendanceToCsv } from './lib/exportExcel'

const AttendanceContext = createContext<AttendanceContextValue | null>(null)

export function useAttendance() {
  const ctx = useContext(AttendanceContext)
  if (!ctx) throw new Error('useAttendance must be used within AttendanceProvider')
  return ctx
}

type AttendanceProviderProps = {
  children: ReactNode
  isMobile: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function AttendanceProvider({
  children,
  isMobile,
  isCollapsed,
  onToggleCollapse,
}: AttendanceProviderProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState(() => defaultFrom())
  const [dateTo, setDateTo] = useState(() => defaultTo())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [settings, setSettings] = useState(() => getWorkdaySettings())
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const data = useAttendanceData(dateFrom, dateTo, search, typeFilter, settings)

  useEffect(() => {
    if (!isMobile) return
    if (isMobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, isMobileOpen])

  useEffect(() => {
    if (!isMobile || !isMobileOpen) return
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileOpen(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [isMobile, isMobileOpen])

  const handleReset = useCallback(() => {
    setDateFrom(defaultFrom())
    setDateTo(defaultTo())
    setSearch('')
    setTypeFilter('')
  }, [])

  const handleExportExcel = useCallback(() => {
    exportAttendanceToCsv(data.filteredGroupedRecords, dateFrom, dateTo)
  }, [data.filteredGroupedRecords, dateFrom, dateTo])

  const value = useMemo<AttendanceContextValue>(
    () => ({
      isCollapsed,
      isMobileOpen,
      isMobile,
      onToggleCollapse,
      onCloseMobile: () => setIsMobileOpen(false),
      onOpenMobile: () => setIsMobileOpen(true),
      dateFrom,
      setDateFrom,
      dateTo,
      setDateTo,
      search,
      setSearch,
      typeFilter,
      setTypeFilter,
      settings,
      setSettings,
      isSettingsOpen,
      setIsSettingsOpen,
      records: data.records,
      loading: data.loading,
      error: data.error,
      load: data.load,
      groupedRecords: data.groupedRecords,
      filteredGroupedRecords: data.filteredGroupedRecords,
      summary: data.summary,
      showTable: data.showTable,
      handleReset,
      handleExportExcel,
      TYPE_OPTIONS,
    }),
    [
      isCollapsed,
      isMobileOpen,
      isMobile,
      onToggleCollapse,
      dateFrom,
      dateTo,
      search,
      typeFilter,
      settings,
      isSettingsOpen,
      data,
      handleReset,
      handleExportExcel,
    ],
  )

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  )
}
