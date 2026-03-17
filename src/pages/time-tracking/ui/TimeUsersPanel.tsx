import { useState, useEffect, useCallback } from 'react'
import { getUsers } from '@entities/user'
import type { TimeUserRow, TimeUsersTotals } from '../model/types'
import type { TimeTrackingRole } from '../model/constants'
import { TimeUsersSummary } from './TimeUsersSummary'
import { TimeUsersTable } from './TimeUsersTable'
import { TimeUsersSkeleton } from './TimeUsersSkeleton'

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function TimeUsersPanel() {
  const [users, setUsers] = useState<TimeUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getUsers()
      .then((data) => {
        if (cancelled) return
        const ttUsers: TimeUserRow[] = data
          .filter((u) => u.time_tracking_role !== null)
          .map((u) => ({
            id: String(u.id),
            name: u.display_name ?? u.email,
            initials: getInitials(u.display_name ?? u.email),
            avatarUrl: u.picture ?? undefined,
            isOnline: false,
            role: (u.position as TimeTrackingRole | null) ?? undefined,
            hours: 0,
            billableHours: 0,
            utilizationPercent: 0,
            capacity: 35,
          }))
        setUsers(ttUsers)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError((err as Error).message ?? 'Не удалось загрузить пользователей')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleActionsOpen = useCallback((id: string) => {
    setOpenActionsId((prev) => (prev === id ? null : id))
  }, [])

  const handleActionsClose = useCallback(() => setOpenActionsId(null), [])

  if (loading) return <TimeUsersSkeleton />

  if (error) {
    return (
      <div className="time-page__panel time-users">
        <div className="time-users__error">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
        </div>
      </div>
    )
  }

  const totals: TimeUsersTotals = {
    totalHours: users.reduce((s, u) => s + u.hours, 0),
    teamCapacity: users.reduce((s, u) => s + u.capacity, 0),
    billableHours: users.reduce((s, u) => s + u.billableHours, 0),
    nonBillableHours: users.reduce((s, u) => s + (u.hours - u.billableHours), 0),
  }

  return (
    <div className="time-page__panel time-users">
      <TimeUsersSummary totals={totals} />

      {users.length === 0 && !loading && (
        <div className="time-users__empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Нет сотрудников с доступом к учёту времени</span>
        </div>
      )}

      {users.length > 0 && (
        <TimeUsersTable
          users={users}
          openActionsId={openActionsId}
          onActionsOpen={handleActionsOpen}
          onActionsClose={handleActionsClose}
        />
      )}
    </div>
  )
}
