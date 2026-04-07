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
  /** Позиция с сервера (для reorder) */
  position?: number
}

export type TodoCardAttachment = {
  id: string
  name: string
  mimeType?: string
  /** Ссылка на /api/v1/media/… (нужен Bearer) */
  mediaUrl?: string
  sizeBytes?: number
}

export type TodoCardComment = {
  id: string
  userId: number
  body: string
  createdAt: string
}

export type TodoCard = {
  id: string
  title: string
  /** ISO с бэкенда (todo card), для сортировки по дате создания */
  createdAt?: string
  completed?: boolean
  description?: string
  labels?: TodoLabel[]
  dueDate?: string
  dueTime?: string
  /** ISO с сервера для снимка при архивации */
  dueAtIso?: string
  startDate?: string
  startTime?: string
  checklist?: TodoCheckItem[]
  /** Участники: id пользователей (как на бэкенде) */
  participantUserIds?: number[]
  attachments?: TodoCardAttachment[]
  comments?: TodoCardComment[]
  fromCalendar?: boolean
  calendarEventId?: string
  calendarTime?: string
}

export const LABEL_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#14b8a6', '#4f46e5', '#6366f1', '#a855f7',
  '#ec4899', '#64748b',
] as const

export type ArchivedCard = TodoCard & {
  archivedAt: string
  fromColumn: string
  /** Снимок для восстановления */
  snapshotLabelIds?: number[]
  snapshotParticipantUserIds?: number[]
  snapshotDueAt?: string | null
}

export type ColumnId = string

/** Порядок карточек в колонке только на клиенте (режим «как на сервере» = server). */
export type TodoColumnListSortMode = 'server' | 'az' | 'za' | 'newest' | 'oldest' | 'done'
