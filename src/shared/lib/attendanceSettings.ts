const ATTENDANCE_SETTINGS_KEY = 'attendance-workday-settings'

export type WorkdaySettings = {
  startTime: string
  endTime: string
  lateMinutes: number
  dailyHours: number
}

const DEFAULT_SETTINGS: WorkdaySettings = {
  startTime: '09:00',
  endTime: '18:00',
  lateMinutes: 15,
  dailyHours: 8,
}

export function getWorkdaySettings(): WorkdaySettings {
  try {
    const raw = localStorage.getItem(ATTENDANCE_SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<WorkdaySettings>
    return {
      startTime: parsed.startTime || DEFAULT_SETTINGS.startTime,
      endTime: parsed.endTime || DEFAULT_SETTINGS.endTime,
      lateMinutes:
        typeof parsed.lateMinutes === 'number' && Number.isFinite(parsed.lateMinutes)
          ? parsed.lateMinutes
          : DEFAULT_SETTINGS.lateMinutes,
      dailyHours:
        typeof parsed.dailyHours === 'number' && Number.isFinite(parsed.dailyHours)
          ? parsed.dailyHours
          : DEFAULT_SETTINGS.dailyHours,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function setWorkdaySettings(value: WorkdaySettings) {
  try {
    localStorage.setItem(ATTENDANCE_SETTINGS_KEY, JSON.stringify(value))
  } catch {
  }
}

