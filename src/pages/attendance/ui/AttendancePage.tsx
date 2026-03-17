import { useState, useCallback } from 'react'
import { useMediaQuery } from '@shared/hooks'
import { getSidebarCollapsed, setSidebarCollapsed } from '@shared/lib/sidebarCollapsed'
import { AttendanceProvider } from '../model/AttendanceContext'
import { AttendancePageView } from './AttendancePageView'

export function AttendancePage() {
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
    <AttendanceProvider
      isMobile={isMobile}
      isCollapsed={isCollapsed}
      onToggleCollapse={handleToggleCollapse}
    >
      <AttendancePageView />
    </AttendanceProvider>
  )
}
