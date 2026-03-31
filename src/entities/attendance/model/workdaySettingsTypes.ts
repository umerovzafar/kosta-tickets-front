/** Payload for GET/PATCH `/api/v1/attendance/settings/workday` */
export type WorkdaySettingsDto = {
  workday_start: string
  workday_end: string
  late_threshold_minutes: number
  daily_hours_norm: number
}
