import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { routes } from '@shared/config'
import { useCurrentUser } from '@shared/hooks'
import type { TimeTabId } from '../model/types'
import { TABS } from '../model/constants'
import {
  canAccessTimeTracking,
  getVisibleTimeTrackingTabs,
  getVisibleTimeTrackingTabDefs,
  resolveInitialTimeTab,
} from '../model/timeTrackingAccess'
import { TimeTrackingHeader } from './TimeTrackingHeader'
import { TimeTrackingTabBar } from './TimeTrackingTabBar'
import { TimeUsersPanel } from './TimeUsersPanel'
import { ExpensesPanel } from './ExpensesPanel'
import { ProjectsPanel } from './ProjectsPanel'
import { TimesheetPanel } from './TimesheetPanel'
import { ReportsPanel } from './ReportsPanel'
import { TimeTrackingSettingsPanel } from './TimeTrackingSettingsPanel'
import './TimeTrackingPage.css'

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const STORAGE_KEY = 'tt_active_tab'
const VALID_TABS = TABS.map(t => t.id)

function readTab(): TimeTabId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as TimeTabId | null
    if (saved && VALID_TABS.includes(saved)) return saved
  } catch {}
  return 'users'
}

export function TimeTrackingPage() {
  const navigate = useNavigate()
  const { user, loading } = useCurrentUser()
  const [activeTab, setActiveTab] = useState<TimeTabId>(() => readTab())
  const handleBack = useCallback(() => navigate(routes.home), [navigate])

  const hasAccess = !loading && canAccessTimeTracking(user)
  const visibleTabDefs = useMemo(() => getVisibleTimeTrackingTabDefs(user), [user])

  useEffect(() => {
    if (loading || !user) return
    const allowed = getVisibleTimeTrackingTabs(user)
    if (allowed.length === 0) return
    setActiveTab(prev => {
      if (allowed.includes(prev)) return prev
      const next = resolveInitialTimeTab(user, readTab())
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }, [loading, user])

  function handleTabChange(id: TimeTabId) {
    if (!getVisibleTimeTrackingTabs(user).includes(id)) return
    setActiveTab(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  }

  return (
    <div className="time-page time-page--enter">
      <main className="time-page__main">
        {!hasAccess && (
          <div className="time-page__dev-overlay" role="status" aria-label="Нет доступа к учёту времени">
            <div className="time-page__dev-overlay-inner">
              <span className="time-page__dev-overlay-icon" aria-hidden><IconLock /></span>
              <p className="time-page__dev-overlay-text">
                Нет доступа к учёту времени. Роль «Пользователь» или «Менеджер» учёта времени назначается в админ-панели.
              </p>
              <button type="button" className="time-page__dev-overlay-back" onClick={handleBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                Назад
              </button>
            </div>
          </div>
        )}
        <TimeTrackingHeader />
        {hasAccess && (
          <>
            <TimeTrackingTabBar tabs={visibleTabDefs} activeTab={activeTab} onTabChange={handleTabChange} />
            <div
              className="time-page__content"
              role="tabpanel"
              id="time-tab-users"
              aria-labelledby="time-tab-btn-users"
              hidden={activeTab !== 'users'}
            >
              <TimeUsersPanel />
            </div>
            <div
              className="time-page__content"
              role="tabpanel"
              id="time-tab-projects"
              aria-labelledby="time-tab-btn-projects"
              hidden={activeTab !== 'projects'}
            >
              <ProjectsPanel />
            </div>
            <div
              className="time-page__content"
              role="tabpanel"
              id="time-tab-expenses"
              aria-labelledby="time-tab-btn-expenses"
              hidden={activeTab !== 'expenses'}
            >
              <ExpensesPanel />
            </div>
            <div
              className="time-page__content"
              role="tabpanel"
              id="time-tab-timesheet"
              aria-labelledby="time-tab-btn-timesheet"
              hidden={activeTab !== 'timesheet'}
            >
              <div className="tsp-wrap">
                <TimesheetPanel />
              </div>
            </div>
            <div
              className="time-page__content"
              role="tabpanel"
              id="time-tab-reports"
              aria-labelledby="time-tab-btn-reports"
              hidden={activeTab !== 'reports'}
            >
              <ReportsPanel />
            </div>
            <div
              className="time-page__content"
              role="tabpanel"
              id="time-tab-settings"
              aria-labelledby="time-tab-btn-settings"
              hidden={activeTab !== 'settings'}
            >
              <TimeTrackingSettingsPanel />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default TimeTrackingPage
