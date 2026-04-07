import { useState, useCallback } from 'react'
import { useMediaQuery } from '@shared/hooks'
import { getSidebarCollapsed, setSidebarCollapsed } from '@shared/lib/sidebarCollapsed'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { VacationScheduleGrid } from './VacationScheduleGrid'
import './VacationSchedulePage.css'

export function VacationSchedulePage() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isCollapsed, setIsCollapsed] = useState(getSidebarCollapsed)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      setSidebarCollapsed(next)
      return next
    })
  }, [])

  const handleCloseMobile = useCallback(() => setIsMobileOpen(false), [])
  const handleOpenMobile = useCallback(() => setIsMobileOpen(true), [])

  return (
    <div className="vacation-schedule-page">
      <div className="vacation-schedule-page__sidebar-wrap">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          isMobileOpen={isMobileOpen}
          onCloseMobile={handleCloseMobile}
          isMobile={isMobile}
        />
      </div>
      <main className="vacation-schedule-page__main">
        <header className="vacation-schedule-page__header">
          {isMobile && (
            <button
              type="button"
              className="vacation-schedule-page__menu-btn"
              onClick={handleOpenMobile}
              aria-label="Открыть меню"
            >
              <IconMenu />
            </button>
          )}
          <h1 className="vacation-schedule-page__title">График отпусков</h1>
        </header>

        <div className="vacation-schedule-page__content">
          <div className="vacation-schedule-page__inner">
            <VacationScheduleGrid />
          </div>
        </div>
      </main>
    </div>
  )
}
