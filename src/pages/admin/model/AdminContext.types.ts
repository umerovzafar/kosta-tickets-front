import type { RefObject } from 'react'
import type { User } from '@entities/user'
import type { Ticket, StatusItem, PriorityItem } from '@entities/ticket'
import type { AttendanceRecord } from '@entities/attendance'
import type { AdminMetrics, LateMetrics } from './types'
import type { TTRole, TTPosition } from './constants'

export type AdminContextValue = {
  isCollapsed: boolean
  isMobileOpen: boolean
  isMobile: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
  onOpenMobile: () => void

  users: User[]
  loading: boolean
  error: string | null
  search: string
  setSearch: (v: string) => void
  roleFilter: string
  setRoleFilter: (v: string) => void
  includeArchived: boolean
  setIncludeArchived: (v: boolean) => void
  filteredUsers: User[]
  metrics: AdminMetrics
  loadUsers: () => Promise<void>
  userActionError: string | null
  savingUserId: number | null
  handleToggleBlocked: (u: User) => void
  handleToggleArchived: (u: User) => void
  handleRoleChange: (u: User, roleValue: string) => void
  handleTTRoleChange: (u: User, ttRole: TTRole) => void
  handlePositionChange: (u: User, pos: TTPosition | null) => void

  openRoleDropdown: number | null
  setOpenRoleDropdown: (v: number | null) => void
  roleMenuPos: { top: number; left: number; width: number } | null
  setRoleMenuPos: (v: { top: number; left: number; width: number } | null) => void
  roleDropdownRef: RefObject<HTMLDivElement | null>
  openTTDropdown: number | null
  setOpenTTDropdown: (v: number | null) => void
  ttMenuPos: { top: number; left: number; width: number } | null
  setTTMenuPos: (v: { top: number; left: number; width: number } | null) => void
  ttDropdownRef: RefObject<HTMLDivElement | null>
  openPosDropdown: number | null
  setOpenPosDropdown: (v: number | null) => void
  posMenuPos: { top: number; left: number; width: number } | null
  setPosMenuPos: (v: { top: number; left: number; width: number } | null) => void
  posDropdownRef: RefObject<HTMLDivElement | null>

  tickets: Ticket[]
  ticketsLoading: boolean
  ticketsError: string | null
  ticketSearch: string
  setTicketSearch: (v: string) => void
  ticketStatusFilter: string
  setTicketStatusFilter: (v: string) => void
  ticketPriorityFilter: string
  setTicketPriorityFilter: (v: string) => void
  includeArchivedTickets: boolean
  setIncludeArchivedTickets: (v: boolean) => void
  statusOptions: StatusItem[]
  priorityOptions: PriorityItem[]
  filteredTickets: Ticket[]
  loadTickets: () => Promise<void>
  ticketDetails: Ticket | null
  ticketDetailsLoading: boolean
  ticketDetailsError: string | null
  openTicketDetails: (ticket: Ticket) => Promise<void>
  closeTicketDetails: () => void

  attendance: AttendanceRecord[]
  lateLoading: boolean
  lateError: string | null
  lateMetrics: LateMetrics
  loadAttendance: () => Promise<void>

  KNOWN_ROLES: typeof import('./constants').KNOWN_ROLES
  ROLE_META: typeof import('./constants').ROLE_META
  TT_ROLE_OPTIONS: typeof import('./constants').TT_ROLE_OPTIONS
  TT_POSITIONS: typeof import('./constants').TT_POSITIONS
  TT_POSITION_META: typeof import('./constants').TT_POSITION_META
}

