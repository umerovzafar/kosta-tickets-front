import { useState, useCallback } from 'react'
import { useMediaQuery } from '@shared/hooks'
import { getSidebarCollapsed, setSidebarCollapsed } from '@shared/lib/sidebarCollapsed'
import { HomeProvider } from '../model/HomeContext'
import { HomePageView } from './HomePageView'

export function HomePage() {
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
    <HomeProvider
      isMobile={isMobile}
      isCollapsed={isCollapsed}
      onToggleCollapse={handleToggleCollapse}
    >
      <HomePageView />
    </HomeProvider>
  )
}
