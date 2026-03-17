import type { ReportViewMode } from '../model/types'
import type { ExpenseCategory } from '../model/types'

type ExpensesReportFiltersProps = {
  reportViewMode: ReportViewMode
  setReportViewMode: (m: ReportViewMode) => void
  selectedDate: string | null
  setSelectedDate: (d: string | null) => void
  periodRange: { start: string; end: string }
  setPeriodRange: (range: { start: string; end: string }) => void
  categoryFilter: ExpenseCategory | ''
  setCategoryFilter: (c: ExpenseCategory | '') => void
  CATEGORY_META: Record<string, { color: string; bg: string }>
}

export function ExpensesReportFilters({
  reportViewMode,
  setReportViewMode,
  selectedDate,
  setSelectedDate,
  periodRange,
  setPeriodRange,
  categoryFilter,
  setCategoryFilter,
  CATEGORY_META,
}: ExpensesReportFiltersProps) {
  return (
    <section className="exp-report-page__filters">
      <div className="exp-report-page__tabs">
        {(['day', 'week', 'month', 'period'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`exp-report-page__tab ${reportViewMode === m ? 'exp-report-page__tab--active' : ''}`}
            onClick={() => setReportViewMode(m)}
          >
            {m === 'day' ? 'День' : m === 'week' ? 'Неделя' : m === 'month' ? 'Месяц' : 'Период'}
          </button>
        ))}
      </div>
      {reportViewMode === 'day' && (
        <label className="exp-report-page__filter">
          <span>Дата</span>
          <input type="date" value={selectedDate ?? ''} onChange={(e) => setSelectedDate(e.target.value)} />
        </label>
      )}
      {reportViewMode === 'week' && selectedDate && (
        <label className="exp-report-page__filter">
          <span>Неделя (дата в ней)</span>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </label>
      )}
      {reportViewMode === 'month' && selectedDate && (
        <label className="exp-report-page__filter">
          <span>Месяц</span>
          <input
            type="month"
            value={selectedDate.slice(0, 7)}
            onChange={(e) => setSelectedDate(e.target.value + '-01')}
          />
        </label>
      )}
      {reportViewMode === 'period' && (
        <div className="exp-report-page__period-fields">
          <label className="exp-report-page__filter">
            <span>С</span>
            <input
              type="date"
              value={periodRange.start}
              onChange={(e) => setPeriodRange({ ...periodRange, start: e.target.value })}
            />
          </label>
          <label className="exp-report-page__filter">
            <span>По</span>
            <input
              type="date"
              value={periodRange.end}
              onChange={(e) => setPeriodRange({ ...periodRange, end: e.target.value })}
            />
          </label>
        </div>
      )}
      <label className="exp-report-page__filter">
        <span>Категория</span>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | '')}>
          <option value="">Все</option>
          {Object.keys(CATEGORY_META).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
    </section>
  )
}
