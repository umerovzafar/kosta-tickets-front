import type { User } from '@entities/user'
import type { TimeTabId } from './types'
import { TABS } from './constants'

/** Вкладки, доступные роли «пользователь учёта времени» (не менеджер). */
export const TIME_TRACKING_LIMITED_TAB_IDS: readonly TimeTabId[] = ['timesheet', 'reports', 'expenses']

/** Полный набор вкладок (порядок как в TABS). */
export const TIME_TRACKING_ALL_TAB_IDS: TimeTabId[] = TABS.map(t => t.id)

/** Все вкладки — только при роли менеджера учёта времени (назначается в админке). */
export function hasFullTimeTrackingTabs(user: User | null | undefined): boolean {
  return user?.time_tracking_role === 'manager'
}

/**
 * Доступ к «Учёт времени», сайдбару и /time-tracking/project/:id
 * только если в профиле задана роль учёта времени (user или manager).
 */
export function canAccessTimeTracking(user: User | null | undefined): boolean {
  const r = user?.time_tracking_role
  return r === 'manager' || r === 'user'
}

export function getVisibleTimeTrackingTabs(user: User | null | undefined): TimeTabId[] {
  if (!user) return []
  if (hasFullTimeTrackingTabs(user)) return [...TIME_TRACKING_ALL_TAB_IDS]
  if (user.time_tracking_role === 'user') return [...TIME_TRACKING_LIMITED_TAB_IDS]
  return []
}

export function getVisibleTimeTrackingTabDefs(user: User | null | undefined): { id: TimeTabId; label: string }[] {
  const ids = new Set(getVisibleTimeTrackingTabs(user))
  return TABS.filter(t => ids.has(t.id))
}

/** Сохранённая вкладка допустима для текущего пользователя. */
export function resolveInitialTimeTab(
  user: User | null | undefined,
  saved: TimeTabId | null,
): TimeTabId {
  const visible = getVisibleTimeTrackingTabs(user)
  if (visible.length === 0) return 'timesheet'
  if (saved && visible.includes(saved)) return saved
  return visible[0]
}
