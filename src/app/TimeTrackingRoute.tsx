import { Navigate } from 'react-router-dom'
import { routes } from '@shared/config'
import { useCurrentUser } from '@shared/hooks'
import { TimeTrackingPage } from '@pages/time-tracking'

export function TimeTrackingRoute() {
  const { user, loading } = useCurrentUser()

  if (loading) return null
  if (!user?.time_tracking_role) return <Navigate to={routes.home} replace />

  return <TimeTrackingPage />
}
