import { useState, useEffect, useRef } from 'react'
import { useAnimatedNumber } from '@shared/hooks'
import { ReportsSkeleton } from './ReportsSkeleton'

type ReportTypeId = 'time' | 'detailed-time' | 'detailed-expense' | 'contractor' | 'uninvoiced'
type ReportGroupId = 'tasks' | 'clients' | 'projects' | 'team'

const REPORT_TYPES: { id: ReportTypeId; label: string }[] = [
  { id: 'time', label: 'Время' },
  { id: 'detailed-time', label: 'Детальное время' },
  { id: 'detailed-expense', label: 'Детальные расходы' },
  { id: 'contractor', label: 'Подрядчики' },
  { id: 'uninvoiced', label: 'Не выставленные' },
]

const REPORT_GROUPS: { id: ReportGroupId; label: string }[] = [
  { id: 'tasks', label: 'Задачи' },
  { id: 'clients', label: 'Клиенты' },
  { id: 'projects', label: 'Проекты' },
  { id: 'team', label: 'Команда' },
]

type PeriodGranularity = 'week' | 'month' | 'quarter' | 'year'
const PERIOD_OPTIONS: { id: PeriodGranularity; label: string }[] = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'year', label: 'Год' },
]

const IcoChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
)
const IcoChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)
const IcoChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>
)
const IcoFileText = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
)
const IcoDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IcoPrinter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
  </svg>
)
const IcoSortUp = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m18 15-6-6-6 6"/>
  </svg>
)

function fmtHours(n: number) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtAmt(n: number, cur = 'UZS') {
  return `${n.toLocaleString('ru-RU')} ${cur}`
}

function formatPeriodLabel(date: Date, granularity: PeriodGranularity): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
  if (granularity === 'week') {
    const start = new Date(d)
    start.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${pad(start.getDate())} — ${pad(end.getDate())} ${months[start.getMonth()]} ${start.getFullYear()}`
  }
  if (granularity === 'month') {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return `01 — ${pad(lastDay)} ${months[d.getMonth()]} ${d.getFullYear()}`
  }
  if (granularity === 'quarter') {
    const q = Math.floor(d.getMonth() / 3) + 1
    const startMonth = (q - 1) * 3
    const endMonth = startMonth + 2
    const lastDay = new Date(d.getFullYear(), endMonth + 1, 0).getDate()
    return `01 ${months[startMonth]} — ${pad(lastDay)} ${months[endMonth]} ${d.getFullYear()}`
  }
  return `01 янв — 31 дек ${d.getFullYear()}`
}

export function ReportsPanel() {
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState<ReportTypeId>('time')
  const [reportGroup, setReportGroup] = useState<ReportGroupId>('tasks')
  const [periodDate, setPeriodDate] = useState(() => new Date(2026, 2, 15))
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>('month')
  const [periodDropdown, setPeriodDropdown] = useState(false)
  const periodDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!periodDropdown) return
    const h = (e: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target as Node)) {
        setPeriodDropdown(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [periodDropdown])

  const periodLabel = formatPeriodLabel(periodDate, periodGranularity)

  function goPrevPeriod() {
    const d = new Date(periodDate)
    if (periodGranularity === 'week') d.setDate(d.getDate() - 7)
    else if (periodGranularity === 'month') d.setMonth(d.getMonth() - 1)
    else if (periodGranularity === 'quarter') d.setMonth(d.getMonth() - 3)
    else d.setFullYear(d.getFullYear() - 1)
    setPeriodDate(d)
  }

  function goNextPeriod() {
    const d = new Date(periodDate)
    if (periodGranularity === 'week') d.setDate(d.getDate() + 7)
    else if (periodGranularity === 'month') d.setMonth(d.getMonth() + 1)
    else if (periodGranularity === 'quarter') d.setMonth(d.getMonth() + 3)
    else d.setFullYear(d.getFullYear() + 1)
    setPeriodDate(d)
  }

  const tasks: { name: string; hours: number; billableHours: number }[] = []
  const totalHours = 0
  const billableHours = 0
  const nonBillableHours = 0
  const billablePct = 0
  const maxTaskHours = tasks.length > 0 ? Math.max(...tasks.map((t) => t.hours)) : 0

  const animTotalHours = useAnimatedNumber(totalHours, { duration: 700, enabled: !loading })
  const animBillablePct = useAnimatedNumber(billablePct, { duration: 600, enabled: !loading })
  const animBillableHours = useAnimatedNumber(billableHours, { duration: 650, enabled: !loading })
  const animNonBillableHours = useAnimatedNumber(nonBillableHours, { duration: 650, enabled: !loading })
  const animAmountUzs = useAnimatedNumber(0, { duration: 800, enabled: !loading })
  const animAmountEur = useAnimatedNumber(0, { duration: 750, enabled: !loading })
  const animAmountUsd = useAnimatedNumber(0, { duration: 750, enabled: !loading })

  if (loading) return <ReportsSkeleton />

  return (
    <div className="tt-reports">
<nav className="tt-reports__type-nav" role="tablist">
        {REPORT_TYPES.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={reportType === tab.id}
            className={`tt-reports__type-tab${reportType === tab.id ? ' tt-reports__type-tab--active' : ''}`}
            onClick={() => setReportType(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
<div className="tt-reports__header">
        <div className="tt-reports__header-left">
          <button type="button" className="tt-reports__nav-btn" onClick={goPrevPeriod} aria-label="Предыдущий период">
            <IcoChevronLeft />
          </button>
          <h2 className="tt-reports__period-title">
            {periodGranularity === 'month' ? 'Этот месяц' : periodGranularity === 'week' ? 'Эта неделя' : periodGranularity === 'quarter' ? 'Этот квартал' : 'Этот год'}: {periodLabel}
          </h2>
          <button type="button" className="tt-reports__nav-btn" onClick={goNextPeriod} aria-label="Следующий период">
            <IcoChevronRight />
          </button>
        </div>
        <div className="tt-reports__header-right">
          <button type="button" className="tt-reports__btn tt-reports__btn--outline">
            Сохранить отчёт
          </button>
          <div className="tt-reports__period-dropdown-wrap" ref={periodDropdownRef}>
            <button
              type="button"
              className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown"
              onClick={() => setPeriodDropdown((v) => !v)}
              aria-expanded={periodDropdown}
              aria-haspopup="listbox"
            >
              {PERIOD_OPTIONS.find((o) => o.id === periodGranularity)?.label ?? 'Месяц'} <IcoChevronDown />
            </button>
            {periodDropdown && (
              <div className="tt-reports__period-dropdown" role="listbox">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={periodGranularity === opt.id}
                    className={`tt-reports__period-opt${periodGranularity === opt.id ? ' tt-reports__period-opt--active' : ''}`}
                    onClick={() => {
                      setPeriodGranularity(opt.id)
                      setPeriodDropdown(false)
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
<div className="tt-reports__summary">
        <div className="tt-reports__summary-card tt-reports__summary-hours">
          <span className="tt-reports__summary-label">Всего часов</span>
          <span className="tt-reports__summary-value">{fmtHours(animTotalHours)}</span>
        </div>
        <div className="tt-reports__summary-card tt-reports__summary-chart">
          <div className="tt-reports__pie-wrap">
            <svg viewBox="0 0 36 36" className="tt-reports__pie">
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="var(--app-accent, #4f46e5)"
                strokeWidth="3"
                strokeDasharray={`${animBillablePct} ${100 - animBillablePct}`}
                strokeDashoffset="0"
                transform="rotate(-90 18 18)"
              />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="var(--app-accent-light-bg, rgba(37,99,235,0.3))"
                strokeWidth="3"
                strokeDasharray={`${100 - animBillablePct} ${animBillablePct}`}
                strokeDashoffset={-animBillablePct}
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span className="tt-reports__pie-label">{Math.round(animBillablePct)}%</span>
          </div>
          <div className="tt-reports__pie-legend">
            <span className="tt-reports__legend-item">
              <span className="tt-reports__legend-dot tt-reports__legend-dot--billable" />
              Оплачиваемые: {fmtHours(animBillableHours)}
            </span>
            <span className="tt-reports__legend-item">
              <span className="tt-reports__legend-dot tt-reports__legend-dot--nonbillable" />
              Неоплачиваемые: {fmtHours(animNonBillableHours)}
            </span>
          </div>
        </div>
        <div className="tt-reports__summary-card tt-reports__summary-amount">
          <span className="tt-reports__summary-label">Оплачиваемая сумма</span>
          <span className="tt-reports__summary-value">{fmtAmt(Math.round(animAmountUzs))}</span>
          <span className="tt-reports__summary-sub">{fmtAmt(Math.round(animAmountEur), 'EUR')} — {fmtAmt(Math.round(animAmountUsd), 'USD')}</span>
          <label className="tt-reports__summary-check">
            <input type="checkbox" defaultChecked />
            Включить проекты с фикс. оплатой
          </label>
        </div>
        <div className="tt-reports__summary-card tt-reports__summary-uninvoiced">
          <span className="tt-reports__summary-label">Не выставленная сумма</span>
          <span className="tt-reports__summary-value">{fmtAmt(Math.round(animAmountUzs))}</span>
          <span className="tt-reports__summary-sub">{fmtAmt(Math.round(animAmountEur), 'EUR')} — {fmtAmt(Math.round(animAmountUsd), 'USD')}</span>
          <span className="tt-reports__summary-note">Исключая проекты с фикс. оплатой</span>
        </div>
      </div>
<nav className="tt-reports__group-nav" role="tablist">
        {REPORT_GROUPS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={reportGroup === tab.id}
            className={`tt-reports__group-tab${reportGroup === tab.id ? ' tt-reports__group-tab--active' : ''}`}
            onClick={() => setReportGroup(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
{reportGroup === 'tasks' && (
        <div className="tt-reports__content">
          <div className="tt-reports__content-header">
            <div className="tt-reports__breakdown-bar-wrap">
              <span className="tt-reports__breakdown-label">Разбивка по задачам, отсортированная по часам.</span>
              <div className="tt-reports__breakdown-bar">
                {tasks.slice(0, 6).map((t, i) => (
                  <span
                    key={t.name}
                    className="tt-reports__breakdown-segment"
                    style={{
                      width: maxTaskHours > 0 ? `${(t.hours / maxTaskHours) * 100}%` : '0%',
                      backgroundColor: `hsl(${220 - i * 25}, 70%, 55%)`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="tt-reports__content-actions">
              <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon">
                <IcoFileText /> Детальный отчёт
              </button>
              <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon">
                <IcoDownload /> Экспорт
              </button>
              <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" aria-label="Печать">
                <IcoPrinter />
              </button>
            </div>
          </div>

          <div className="tt-reports__table-wrap">
            <table className="tt-reports__table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th className="tt-reports__th--sortable">
                    Часы <IcoSortUp />
                  </th>
                  <th>Оплачиваемые часы</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const pct = task.hours > 0 ? Math.round((task.billableHours / task.hours) * 100) : 0
                  const barPct = maxTaskHours > 0 ? (task.hours / maxTaskHours) * 100 : 0
                  return (
                    <tr key={task.name}>
                      <td>{task.name}</td>
                      <td>
                        <span className="tt-reports__hours-link">{fmtHours(task.hours)}</span>
                        <span className="tt-reports__hours-bar" style={{ width: `${barPct}%` }} />
                      </td>
                      <td>
                        {fmtHours(task.billableHours)} ({pct}%)
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
{reportGroup !== 'tasks' && (
        <div className="tt-reports__content tt-reports__content--placeholder">
          <p className="tt-reports__placeholder-text">
            Раздел «{REPORT_GROUPS.find((g) => g.id === reportGroup)?.label}» в разработке
          </p>
        </div>
      )}
    </div>
  )
}
