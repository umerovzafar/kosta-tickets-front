export type GroupedRow = {
  key: string
  date: string
  name: string
  department: string
  firstTime: string | null
  lastTime: string | null
  firstCheckpoint: string
  lastCheckpoint: string
}

export type AttendanceSummary = {
  entries: number
  lateness: number
  overtime: number
  total_hours: number
  avg_hours_per_entry: number
}
