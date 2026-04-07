import { useState, useCallback, type ReactNode } from 'react'
import { useMediaQuery } from '@shared/hooks'
import { getSidebarCollapsed, setSidebarCollapsed } from '@shared/lib/sidebarCollapsed'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import './ExpensesPage.css'

type ExpensesShellProps = {
  title: string
  children?: ReactNode
}

export function ExpensesShell({ title, children }: ExpensesShellProps) {
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
    <div className="expenses-page">
      <div className="expenses-page__sidebar-wrap">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          isMobileOpen={isMobileOpen}
          onCloseMobile={handleCloseMobile}
          isMobile={isMobile}
        />
      </div>
      <main className="expenses-page__main">
        <header className="expenses-page__header">
          {isMobile && (
            <button type="button" className="expenses-page__menu-btn" onClick={handleOpenMobile} aria-label="Открыть меню">
              <IconMenu />
            </button>
          )}
          <div className="expenses-page__header-inner">
            <h1 className="expenses-page__title">{title}</h1>
          </div>
        </header>
        <div className="expenses-page__content">{children}</div>
      </main>
    </div>
  )
}
