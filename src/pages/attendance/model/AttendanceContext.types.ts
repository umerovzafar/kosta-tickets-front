import type { WorkdaySettings } from '@shared/lib/attendanceSettings'
import type { GroupedRow, AttendanceSummary } from './types'

export type AttendanceContextValue = {
  isCollapsed: boolean
  isMobileOpen: boolean
  isMobile: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
  onOpenMobile: () => void

  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  search: string
  setSearch: (v: string) => void
  typeFilter: string
  setTypeFilter: (v: string) => void

  settings: WorkdaySettings
  setSettings: (v: WorkdaySettings) => void
  isSettingsOpen: boolean
  setIsSettingsOpen: (v: boolean) => void

  records: import('@entities/attendance').AttendanceRecord[]
  loading: boolean
  error: string | null
  load: () => Promise<void>

  groupedRecords: GroupedRow[]
  filteredGroupedRecords: GroupedRow[]
  summary: AttendanceSummary
  showTable: boolean

  handleReset: () => void
  handleExportExcel: () => void

  TYPE_OPTIONS: typeof import('./constants').TYPE_OPTIONS
}
