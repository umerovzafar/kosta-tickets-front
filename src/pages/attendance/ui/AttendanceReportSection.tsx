import { useMemo } from 'react'
import { formatDateOnly, formatTime } from '@shared/lib/formatDate'
import type { GroupedRow } from '../model/types'
import type { WorkdaySettings } from '@shared/lib/attendanceSettings'
import { AttendanceDatePicker } from './AttendanceDatePicker'
import { AttendanceSelect } from './AttendanceSelect'
import { TYPE_OPTIONS } from '../model/constants'

function isLate(row: GroupedRow, settings: WorkdaySettings): boolean {
  if (!row.firstTime) return false
  const d = new Date(row.firstTime)
  const [sh, sm] = settings.startTime.split(':').map(Number)
  const threshold = (sh || 0) * 60 + (sm || 0) + settings.lateMinutes
  const arrived = d.getHours() * 60 + d.getMinutes()
  return arrived > threshold
}

type AttendanceReportSectionProps = {
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  search: string
  setSearch: (v: string) => void
  typeFilter: string
  setTypeFilter: (v: string) => void
  groupedRecords: GroupedRow[]
  filteredGroupedRecords: GroupedRow[]
  loading: boolean
  error: boolean
  recordsCount: number
  showTable: boolean
  load: () => void
  onReset: () => void
  onExportExcel: () => void
  settings: WorkdaySettings
}

export function AttendanceReportSection({
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  groupedRecords,
  filteredGroupedRecords,
  loading,
  error,
  recordsCount,
  showTable,
  load,
  onReset,
  onExportExcel,
  settings,
}: AttendanceReportSectionProps) {
  const sortedRecords = useMemo(() => {
    return [...filteredGroupedRecords].sort((a, b) => {
      const aLate = isLate(a, settings)
      const bLate = isLate(b, settings)
      if (aLate && !bLate) return -1
      if (!aLate && bLate) return 1
      return 0
    })
  }, [filteredGroupedRecords, settings])

  return (
    <section className="att__card">
      <div className="att__card-head">
        <h2 className="att__card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Отчёт по посещаемости
        </h2>
        {loading ? (
          <span className="att__card-count att__card-count--skel">
            <span className="att__skel att__skel--count" />
          </span>
        ) : (
          <span className="att__card-count">{groupedRecords.length}</span>
        )}
      </div>

      <div className="att__toolbar">
        <div className="att__search-wrap">
          <svg className="att__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="att__search"
            placeholder="Введите ФИО или имя…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <div className="att__toolbar-group">
          <label className="att__field">
            <span className="att__field-label">Период с</span>
            <AttendanceDatePicker value={dateFrom} onChange={setDateFrom} />
          </label>
          <label className="att__field">
            <span className="att__field-label">по</span>
            <AttendanceDatePicker value={dateTo} onChange={setDateTo} />
          </label>
          <label className="att__field">
            <span className="att__field-label">Тип</span>
            <AttendanceSelect value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} placeholder="Все записи" />
          </label>
        </div>
        <div className="att__toolbar-actions">
          <button type="button" className="att__btn att__btn--ghost" onClick={onReset}>Сброс</button>
          <button
            type="button"
            className="att__btn att__btn--accent"
            onClick={onExportExcel}
            disabled={!filteredGroupedRecords.length || loading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M8 13h2" />
              <path d="M8 17h2" />
              <path d="M14 13h2" />
              <path d="M14 17h2" />
            </svg>
            Excel
          </button>
        </div>
      </div>

      {loading && (
        <div className="att__table-wrap att__table-wrap--skeleton">
          <table className="att__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сотрудник</th>
                <th>Приход</th>
                <th>Уход</th>
                <th>Точка прохода</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td data-label="Дата"><span className="att__skel att__skel--date" /></td>
                  <td data-label="Сотрудник"><span className="att__skel att__skel--name" /></td>
                  <td data-label="Приход"><span className="att__skel att__skel--time" /></td>
                  <td data-label="Уход"><span className="att__skel att__skel--time" /></td>
                  <td data-label="Точка прохода"><span className="att__skel att__skel--checkpoint" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showTable && (
        <div className="att__table-wrap">
          <table className="att__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сотрудник</th>
                <th>Приход</th>
                <th>Уход</th>
                <th>Точка прохода</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((r) => {
                const late = isLate(r, settings)
                const arrivalStatus: 'ontime' | 'late' | null = r.firstTime ? (late ? 'late' : 'ontime') : null
                return (
                  <tr key={r.key} className={late ? 'att__row--late' : ''}>
                    <td className="att__td-date" data-label="Дата">{r.date ? formatDateOnly(r.date) : '—'}</td>
                    <td className="att__td-name" data-label="Сотрудник">{r.name || '—'}</td>
                    <td className="att__td-time" data-label="Приход">
                      {r.firstTime ? (
                        <span className={`att__arrival att__arrival--${arrivalStatus}`}>
                          {formatTime(r.firstTime)}
                          {arrivalStatus === 'late' ? (
                            <span className="att__arrival-badge att__arrival-badge--late" title="Опоздал">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                            </span>
                          ) : (
                            <span className="att__arrival-badge att__arrival-badge--ontime" title="Вовремя">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="att__td-time" data-label="Уход">{r.lastTime ? formatTime(r.lastTime) : '—'}</td>
                    <td data-label="Точка прохода">
                      {r.firstCheckpoint === r.lastCheckpoint
                        ? r.firstCheckpoint
                        : `${r.firstCheckpoint} → ${r.lastCheckpoint}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && recordsCount === 0 && (
        <div className="att__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p className="att__empty-title">Нет данных о посещаемости</p>
          <p className="att__empty-desc">Убедитесь, что сервис attendance запущен и доступен.</p>
        </div>
      )}
    </section>
  )
}
