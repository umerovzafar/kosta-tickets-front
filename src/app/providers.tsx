import { type ReactNode } from 'react'
import { AppRouter } from './router'
import { CalendarReminder } from '@widgets/calendar-reminder'

type ProvidersProps = {
  children?: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      {children ?? <AppRouter />}
      <CalendarReminder />
    </>
  )
}
