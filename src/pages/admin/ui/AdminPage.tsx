import { useState, useCallback } from 'react'
import { useMediaQuery } from '@shared/hooks'
import { getSidebarCollapsed, setSidebarCollapsed } from '@shared/lib/sidebarCollapsed'
import { AdminProvider } from '../model/AdminContext'
import { AdminPageView } from './AdminPageView'

export function AdminPage() {
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
    <AdminProvider
      isMobile={isMobile}
      isCollapsed={isCollapsed}
      onToggleCollapse={handleToggleCollapse}
    >
      <AdminPageView />
    </AdminProvider>
  )
}
