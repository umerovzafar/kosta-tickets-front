import type { AttendanceSummary } from '../model/types'
import type { WorkdaySettings } from '@shared/lib/attendanceSettings'

type AttendanceKPISectionProps = {
  summary: AttendanceSummary
  settings: WorkdaySettings
  loading: boolean
}

const KPI_CARDS = [
  {
    key: 'entries',
    label: 'Записей',
    valueKey: 'entries' as const,
    subKey: 'entries_sub' as const,
    color: 'blue' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    key: 'late',
    label: 'Опозданий',
    valueKey: 'lateness' as const,
    subKey: 'late_sub' as const,
    color: 'orange' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    key: 'overtime',
    label: 'Переработок',
    valueKey: 'overtime' as const,
    subKey: 'overtime_sub' as const,
    color: 'violet' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    key: 'hours',
    label: 'Всего часов',
    valueKey: 'total_hours' as const,
    subKey: 'hours_sub' as const,
    color: 'green' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
] as const

export function AttendanceKPISection({ summary, settings, loading }: AttendanceKPISectionProps) {
  const subs = {
    entries_sub: 'за выбранный период',
    late_sub: `после ${settings.startTime} + ${settings.lateMinutes} мин`,
    overtime_sub: `больше ${settings.dailyHours} ч в день`,
    hours_sub: `≈ ${summary.avg_hours_per_entry.toFixed(1)} ч / запись`,
  }

  const values = {
    entries: summary.entries,
    lateness: summary.lateness,
    overtime: summary.overtime,
    total_hours: summary.total_hours.toFixed(1),
  }

  return (
    <section className="att__kpi">
      {KPI_CARDS.map((card) => (
        <div key={card.key} className={`att__kpi-card att__kpi-card--${card.color}`}>
          <div className="att__kpi-icon">{card.icon}</div>
          {loading ? (
            <div className="att__kpi-skel">
              <span />
              <span />
            </div>
          ) : (
            <>
              <span className="att__kpi-value">{values[card.valueKey]}</span>
              <span className="att__kpi-label">{card.label}</span>
              <span className="att__kpi-sub">{subs[card.subKey]}</span>
            </>
          )}
        </div>
      ))}
    </section>
  )
}
