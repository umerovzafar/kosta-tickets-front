export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function buildMonthGrid(baseDate: Date): Date[] {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const firstWeekday = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month, 1 - firstWeekday)
  const days: Date[] = []
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  return days
}

export type TodoLabel = {
  id: string
  text: string
  color: string
}

export type TodoCheckItem = {
  id: string
  text: string
  done: boolean
}

export type TodoCard = {
  id: string
  title: string
  completed?: boolean
  description?: string
  labels?: TodoLabel[]
  dueDate?: string
  dueTime?: string
  startDate?: string
  startTime?: string
  checklist?: TodoCheckItem[]
  members?: string[]
  fromCalendar?: boolean
  calendarEventId?: string
  calendarTime?: string
}

export const LABEL_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#14b8a6', '#3b82f6', '#6366f1', '#a855f7',
  '#ec4899', '#64748b',
] as const

export type ArchivedCard = TodoCard & {
  archivedAt: string
  fromColumn: string
}

export type ColumnId = string
