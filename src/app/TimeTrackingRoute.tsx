import { useCurrentUser } from '@shared/hooks'
import { TimeTrackingPage } from '@pages/time-tracking'

export function TimeTrackingRoute() {
  const { loading } = useCurrentUser()

  if (loading) return null

  return <TimeTrackingPage />
}
