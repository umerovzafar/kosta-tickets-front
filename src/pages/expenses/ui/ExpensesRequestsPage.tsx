import { useState, useCallback } from 'react'
import { useMediaQuery } from '@shared/hooks'
import { getSidebarCollapsed, setSidebarCollapsed } from '@shared/lib/sidebarCollapsed'
import { ExpensesProvider } from '../model/ExpensesContext'
import { ExpensesRequestsPageView } from './ExpensesRequestsPageView'

export function ExpensesRequestsPage() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isCollapsed, setIsCollapsed] = useState(getSidebarCollapsed)

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      setSidebarCollapsed(next)
      return next
    })
  }, [])

  return (
    <ExpensesProvider isMobile={isMobile} isCollapsed={isCollapsed} onToggleCollapse={handleToggleCollapse}>
      <ExpensesRequestsPageView />
    </ExpensesProvider>
  )
}
