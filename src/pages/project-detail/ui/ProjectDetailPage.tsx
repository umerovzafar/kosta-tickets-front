import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea,
  Dot,
} from 'recharts'
import { MOCK_PROJECTS } from '../../time-tracking/model/constants'
import './ProjectDetailPage.css'

function fmtAmt(n: number, cur = 'UZS') {
  return `${n.toLocaleString('ru-RU')} ${cur}`
}
function fmtAmtShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

type WeekPoint = {
  idx: number
  dayLabel: string
  value: number
  isThisWeek: boolean
  isMonthStart: boolean
  monthName: string
  year: string
}

function buildWeeks(weeks: number): WeekPoint[] {
  const now = new Date()
  let prevMonth = -1
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (weeks - 1 - i) * 7)
    const month = d.getMonth()
    const isMonthStart = month !== prevMonth
    prevMonth = month
    const dayLabel  = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    const monthName = d.toLocaleDateString('ru-RU', { month: 'short' })
    const year      = String(d.getFullYear())
    return { idx: i, dayLabel, value: 0, isThisWeek: i === weeks - 1, isMonthStart, monthName, year }
  })
}

function genProgressData(spent: number): WeekPoint[] {
  const base = buildWeeks(13)
  return base.map((w, i) => ({
    ...w,
    value: Math.round(spent * Math.pow((i + 1) / base.length, 0.75)),
  }))
}

function genHoursData(spent: number): WeekPoint[] {
  const base = buildWeeks(13)
  const avg = (spent / 10_000) * 8
  return base.map((w, i) => ({
    ...w,
    value: +(avg * (0.4 + ((i * 17 + 7) % 10) / 10 * 0.8)).toFixed(1),
  }))
}

function MonthWeekTick(props: {
  x?: number | string; y?: number | string; payload?: { value: number }
  chartData: WeekPoint[]
}) {
  const { x = 0, y = 0, payload, chartData } = props
  const item = chartData[payload?.value ?? 0]
  if (!item) return null

  if (item.isMonthStart) {
    return (
      <g transform={`translate(${x},${y})`}>
        <line x1={0} y1={0} x2={0} y2={8} stroke="#d1d5db" strokeWidth={1} />
        <text x={0} y={22} textAnchor="middle" fill="#6b7280"
          fontSize={11} fontWeight={600} fontFamily="inherit">
          {item.monthName}
        </text>
        <text x={0} y={34} textAnchor="middle" fill="#9ca3af"
          fontSize={10} fontFamily="inherit">
          {item.year}
        </text>
      </g>
    )
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1={0} y1={0} x2={0} y2={4} stroke="#e5e7eb" strokeWidth={1} />
    </g>
  )
}

function ProgressTooltip({ active, payload, currency, budget }: {
  active?: boolean
  payload?: { payload: WeekPoint; value: number }[]
  currency: string
  budget?: number
}) {
  if (!active || !payload?.length) return null
  const item  = payload[0].payload
  const spent = payload[0].value
  const remaining  = budget != null ? budget - spent : null
  const isOver     = remaining != null && remaining < 0
  const weekNum    = item.idx + 1

  return (
    <div className="pdp__tooltip pdp__tooltip--rich">
      <p className="pdp__tooltip-head">
        Нарастающим итогом на {item.dayLabel} (Нед.&nbsp;{weekNum})
      </p>
      <div className="pdp__tooltip-cols">
        <div className="pdp__tooltip-col">
          <span className="pdp__tooltip-col-label">Потрачено</span>
          <span className="pdp__tooltip-col-val">{fmtAmt(spent, currency)}</span>
        </div>
        {budget != null && (
          <div className="pdp__tooltip-col">
            <span className="pdp__tooltip-col-label">Остаток бюджета</span>
            <span className={`pdp__tooltip-col-val${isOver ? ' pdp__tooltip-col-val--red' : ' pdp__tooltip-col-val--green'}`}>
              {isOver ? '−' : ''}{fmtAmt(Math.abs(remaining!), currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function HoursTooltip({ active, payload }: {
  active?: boolean; payload?: { payload: WeekPoint; value: number }[]
}) {
  if (!active || !payload?.length) return null
  const item   = payload[0].payload
  const weekNum = item.idx + 1
  return (
    <div className="pdp__tooltip pdp__tooltip--rich">
      <p className="pdp__tooltip-head">
        {item.dayLabel} (Нед.&nbsp;{weekNum})
      </p>
      <div className="pdp__tooltip-cols">
        <div className="pdp__tooltip-col">
          <span className="pdp__tooltip-col-label">Часов за неделю</span>
          <span className="pdp__tooltip-col-val">{payload[0].value} ч</span>
        </div>
      </div>
    </div>
  )
}

function CustomBar(props: {
  x?: number; y?: number; width?: number; height?: number
  isThisWeek?: boolean
}) {
  const { x = 0, y = 0, width = 0, height = 0, isThisWeek } = props
  return (
    <rect x={x} y={y} width={width} height={height} rx={3} ry={3}
      fill={isThisWeek ? '#2563eb' : '#93c5fd'} />
  )
}

const IcoArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
)
const IcoEdit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IcoChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>
)
const IcoInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

type TaskRow = {
  id: string
  name: string
  hours: number
  billableAmt: number
  costs: number
  currency: string
  billable: boolean
  expandable: boolean
}

const BILLABLE_TASK_NAMES = [
  'Электронная переписка',
  'Исследование',
  'Анализ документов',
  'Судебное заседание',
  'Подготовка к заседанию',
  'Подача документов',
  'Составление договоров',
  'Совещания',
  'Регистрация Мой Мехнат',
  'Телефонные звонки',
]

const NON_BILLABLE_TASK_NAMES = [
  'Kosta Legal Internal',
  'Административные задачи',
]

function genTasks(totalHours: number, billable: number, spent: number, currency: string): { billable: TaskRow[]; nonBillable: TaskRow[] } {
  const hourlyRate = totalHours > 0 ? spent / billable : 0
  const dist = [0.40, 0.37, 0.23]
  const billableRows: TaskRow[] = BILLABLE_TASK_NAMES.map((name, i) => {
    const h = i < 3 ? +(billable * dist[i]).toFixed(2) : 0
    return {
      id: `bt-${i}`,
      name,
      hours: h,
      billableAmt: +(h * hourlyRate),
      costs: 0,
      currency,
      billable: true,
      expandable: h > 0,
    }
  })
  const nonBillableRows: TaskRow[] = NON_BILLABLE_TASK_NAMES.map((name, i) => ({
    id: `nbt-${i}`,
    name,
    hours: 0,
    billableAmt: 0,
    costs: 0,
    currency,
    billable: false,
    expandable: false,
  }))
  return { billable: billableRows, nonBillable: nonBillableRows }
}

type DetailTabId = 'tasks' | 'team' | 'invoices'

function TasksPanel({ rows, nonBillableRows, totalHours, totalAmt, currency }: {
  rows: TaskRow[]
  nonBillableRows: TaskRow[]
  totalHours: number
  totalAmt: number
  currency: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])

  const nonBillTotal = nonBillableRows.reduce((s, r) => s + r.hours, 0)

  return (
    <div className="pdp__tasks">
<div className="pdp__tasks-toolbar">
        <span className="pdp__tasks-heading">За всё время</span>
        <div className="pdp__tasks-toolbar-right">
          <button className="pdp__tasks-filter-btn">
            За всё время
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <button className="pdp__tasks-export-btn">
            Экспорт
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>
<table className="pdp__tasks-table">
        <thead>
          <tr className="pdp__tasks-thead">
            <th className="pdp__tasks-th pdp__tasks-th--name">
              <span className="pdp__tasks-group-label">Оплачиваемые задачи</span>
            </th>
            <th className="pdp__tasks-th pdp__tasks-th--hours">
              Часы
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="pdp__tasks-sort">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
            </th>
            <th className="pdp__tasks-th pdp__tasks-th--amt">Оплачиваемая сумма</th>
            <th className="pdp__tasks-th pdp__tasks-th--costs">Затраты</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="pdp__tasks-row">
              <td className="pdp__tasks-td pdp__tasks-td--name">
                {r.expandable ? (
                  <button
                    className={`pdp__tasks-expand${expanded.has(r.id) ? ' pdp__tasks-expand--open' : ''}`}
                    onClick={() => toggle(r.id)}
                    aria-label="Развернуть"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                ) : (
                  <span className="pdp__tasks-expand-placeholder" />
                )}
                {r.name}
              </td>
              <td className="pdp__tasks-td pdp__tasks-td--hours">
                {r.hours > 0
                  ? <button className="pdp__tasks-hours-link">{r.hours.toFixed(2)}</button>
                  : <span className="pdp__tasks-zero">0.00</span>}
              </td>
              <td className="pdp__tasks-td pdp__tasks-td--amt">
                {r.billableAmt > 0
                  ? fmtAmt(Math.round(r.billableAmt), r.currency)
                  : <span className="pdp__tasks-zero">0,00 {r.currency}</span>}
              </td>
              <td className="pdp__tasks-td pdp__tasks-td--costs">
                <span className="pdp__tasks-zero">0,00 {r.currency}</span>
              </td>
            </tr>
          ))}
<tr className="pdp__tasks-total-row">
            <td className="pdp__tasks-td pdp__tasks-td--name">
              <strong>Итого</strong>
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--hours">
              <button className="pdp__tasks-hours-link pdp__tasks-hours-link--bold">
                {totalHours.toFixed(2)}
              </button>
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--amt">
              <strong>{fmtAmt(totalAmt, currency)}</strong>
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--costs">
              <strong>0,00 {currency}</strong>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pdp__tasks-warn">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </td>
          </tr>
        </tbody>
      </table>
<table className="pdp__tasks-table pdp__tasks-table--sep">
        <thead>
          <tr className="pdp__tasks-thead">
            <th className="pdp__tasks-th pdp__tasks-th--name">
              <span className="pdp__tasks-group-label">Неоплачиваемые задачи</span>
            </th>
            <th className="pdp__tasks-th pdp__tasks-th--hours">
              Часы
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="pdp__tasks-sort">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
            </th>
            <th className="pdp__tasks-th pdp__tasks-th--amt">Оплачиваемая сумма</th>
            <th className="pdp__tasks-th pdp__tasks-th--costs">Затраты</th>
          </tr>
        </thead>
        <tbody>
          {nonBillableRows.map(r => (
            <tr key={r.id} className="pdp__tasks-row">
              <td className="pdp__tasks-td pdp__tasks-td--name">
                <span className="pdp__tasks-expand-placeholder" />
                {r.name}
              </td>
              <td className="pdp__tasks-td pdp__tasks-td--hours">
                <span className="pdp__tasks-zero">0.00</span>
              </td>
              <td className="pdp__tasks-td pdp__tasks-td--amt">
                <span className="pdp__tasks-zero">€0.00</span>
              </td>
              <td className="pdp__tasks-td pdp__tasks-td--costs">
                <span className="pdp__tasks-zero">$0.00</span>
              </td>
            </tr>
          ))}
          <tr className="pdp__tasks-total-row">
            <td className="pdp__tasks-td pdp__tasks-td--name"><strong>Итого</strong></td>
            <td className="pdp__tasks-td pdp__tasks-td--hours">
              <span className={nonBillTotal > 0 ? 'pdp__tasks-hours-link' : 'pdp__tasks-zero'}>
                {nonBillTotal.toFixed(2)}
              </span>
            </td>
            <td className="pdp__tasks-td pdp__tasks-td--amt"><strong>0,00 {currency}</strong></td>
            <td className="pdp__tasks-td pdp__tasks-td--costs"><strong>0,00 {currency}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const TYPE_COLOR: Record<string, { color: string; bg: string }> = {
  'Время и материалы':    { color: '#2563eb', bg: 'rgba(37,99,235,0.08)'  },
  'Фиксированная ставка': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  'Без бюджета':          { color: '#64748b', bg: 'rgba(100,116,139,0.08)'},
}

export function ProjectDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [chartTab,    setChartTab]    = useState<'progress' | 'hours'>('progress')
  const [actionsOpen, setActionsOpen] = useState(false)
  const [hoverIdx,    setHoverIdx]    = useState<number | null>(null)
  const [detailTab,   setDetailTab]   = useState<DetailTabId>('tasks')

  const project = MOCK_PROJECTS.find(p => p.id === id)

  if (!project) {
    return (
      <div className="pdp pdp--error">
        <p>Проект не найден</p>
        <button className="pdp__back-btn" onClick={() => navigate(-1)}>
          <IcoArrowLeft /> Назад
        </button>
      </div>
    )
  }

  const hasBudget    = project.budget != null
  const remaining    = hasBudget ? project.budget! - project.spent : null
  const remainingPct = hasBudget ? Math.round(((project.budget! - project.spent) / project.budget!) * 100) : null
  const isOver       = remaining != null && remaining < 0
  const spentPct     = hasBudget ? Math.min((project.spent / project.budget!) * 100, 100) : 0
  const overPct      = isOver && hasBudget ? Math.min(((project.spent - project.budget!) / project.budget!) * 100, 50) : 0

  const totalHours = +(project.spent / 50_000).toFixed(2)
  const billable   = +(totalHours * 0.92).toFixed(2)
  const nonBill    = +(totalHours - billable).toFixed(2)

  const progressData = useMemo(() => genProgressData(project.spent), [project.id])
  const hoursData    = useMemo(() => genHoursData(project.spent),    [project.id])
  const taskData     = useMemo(() => genTasks(totalHours, billable, project.spent, project.currency), [project.id, totalHours, billable])

  const thisWeekIdx   = progressData.length - 1
  const typeMeta      = TYPE_COLOR[project.type] ?? TYPE_COLOR['Без бюджета']

  const maxVal   = Math.max(...progressData.map(d => d.value), project.budget ?? 0) * 1.15
  const yTicks   = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * i))

  const monthBoundaries = progressData.filter(d => d.isMonthStart && d.idx > 0)

  return (
    <div className="pdp">
<header className="pdp__header">
        <div className="pdp__header-left">
          <button className="pdp__back-btn" onClick={() => navigate(-1)} aria-label="Назад">
            <IcoArrowLeft />
          </button>
          <div className="pdp__title-block">
            <p className="pdp__client">{project.client}</p>
            <div className="pdp__title-row">
              <h1 className="pdp__title">{project.name}</h1>
              <span className="pdp__type-badge" style={{ color: typeMeta.color, background: typeMeta.bg }}>
                {project.type}
              </span>
            </div>
          </div>
        </div>
        <div className="pdp__header-right">
          <button className="pdp__edit-btn">
            <IcoEdit /> Редактировать
          </button>
          <div className="pdp__actions-wrap">
            <button
              className={`pdp__actions-btn${actionsOpen ? ' pdp__actions-btn--open' : ''}`}
              onClick={() => setActionsOpen(v => !v)}
            >
              Действия <IcoChevron />
            </button>
            {actionsOpen && (
              <div className="pdp__actions-menu">
                {['Архивировать', 'Дублировать', 'Экспорт', 'Удалить'].map(a => (
                  <button
                    key={a}
                    className={`pdp__actions-item${a === 'Удалить' ? ' pdp__actions-item--danger' : ''}`}
                    onClick={() => setActionsOpen(false)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="pdp__body">
<div className="pdp__chart-card">
          <div className="pdp__chart-tabs">
            <button
              className={`pdp__chart-tab${chartTab === 'progress' ? ' pdp__chart-tab--active' : ''}`}
              onClick={() => setChartTab('progress')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Прогресс проекта
            </button>
            <button
              className={`pdp__chart-tab${chartTab === 'hours' ? ' pdp__chart-tab--active' : ''}`}
              onClick={() => setChartTab('hours')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6"  y1="20" x2="6"  y2="14"/>
              </svg>
              Часы по неделям
            </button>
          </div>

          <div className="pdp__chart-area">
{chartTab === 'progress' && (
              <ResponsiveContainer width="100%" height={310}>
                <LineChart
                  data={progressData}
                  margin={{ top: 24, right: 28, bottom: 28, left: 8 }}
                  onMouseMove={(s) => {
                    const payload = (s as { activePayload?: Array<{ payload?: { idx?: number } }> })?.activePayload?.[0]?.payload
                    const idx = payload?.idx
                    if (idx !== undefined) setHoverIdx(idx)
                  }}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <CartesianGrid stroke="#f0f0f0" strokeDasharray="0" vertical={false} />
{hoverIdx !== null && hoverIdx !== thisWeekIdx && (
                    <ReferenceArea
                      x1={hoverIdx - 0.5}
                      x2={hoverIdx + 0.5}
                      fill="rgba(0,0,0,0.05)"
                      ifOverflow="visible"
                    />
                  )}
{monthBoundaries.map(d => (
                    <ReferenceLine key={d.idx} x={d.idx} stroke="#e5e7eb" strokeWidth={1} />
                  ))}
<ReferenceArea
                    x1={thisWeekIdx - 0.5}
                    x2={thisWeekIdx + 0.5}
                    fill="rgba(37,99,235,0.08)"
                    label={{ value: 'Эта неделя', position: 'insideTopRight', fontSize: 11, fill: '#6b7280', dy: -12, dx: -4 }}
                  />
{hasBudget && (
                    <ReferenceLine
                      y={project.budget}
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      label={{
                        value: `Бюджет: ${fmtAmtShort(project.budget!)}`,
                        position: 'insideTopLeft',
                        fill: '#fff',
                        fontSize: 10.5,
                        fontWeight: 700,
                      }}
                    />
                  )}

                  <XAxis
                    dataKey="idx"
                    type="number"
                    domain={[0, progressData.length - 1]}
                    ticks={progressData.map(d => d.idx)}
                    tick={(p) => <MonthWeekTick {...p} chartData={progressData} />}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                    interval={0}
                    height={44}
                  />
                  <YAxis
                    tickFormatter={fmtAmtShort}
                    tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    ticks={yTicks}
                    domain={[0, maxVal]}
                  />
                  <Tooltip
                    content={<ProgressTooltip currency={project.currency} budget={project.budget} />}
                    cursor={false}
                    offset={12}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    dot={<Dot r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} />}
                    activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
{chartTab === 'hours' && (
              <ResponsiveContainer width="100%" height={310}>
                <BarChart
                  data={hoursData}
                  margin={{ top: 24, right: 28, bottom: 28, left: 8 }}
                  barCategoryGap="35%"
                  onMouseMove={(s) => {
                    const payload = (s as { activePayload?: Array<{ payload?: { idx?: number } }> })?.activePayload?.[0]?.payload
                    const idx = payload?.idx
                    if (idx !== undefined) setHoverIdx(idx)
                  }}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <CartesianGrid stroke="#f0f0f0" strokeDasharray="0" vertical={false} />
{monthBoundaries.map(d => (
                    <ReferenceLine key={d.idx} x={d.idx} stroke="#e5e7eb" strokeWidth={1} />
                  ))}
<ReferenceArea
                    x1={thisWeekIdx - 0.5}
                    x2={thisWeekIdx + 0.5}
                    fill="rgba(37,99,235,0.08)"
                    label={{ value: 'Эта неделя', position: 'insideTopRight', fontSize: 11, fill: '#6b7280', dy: -12, dx: -4 }}
                  />

                  <XAxis
                    dataKey="idx"
                    type="number"
                    domain={[0, hoursData.length - 1]}
                    ticks={hoursData.map(d => d.idx)}
                    tick={(p) => <MonthWeekTick {...p} chartData={hoursData} />}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                    interval={0}
                    height={44}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={v => `${v}`}
                  />
                  <Tooltip
                    content={<HoursTooltip />}
                    cursor={false}
                    offset={12}
                  />
                  <Bar dataKey="value" shape={<CustomBar />} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

          </div>
        </div>
<div className="pdp__stats">
<div className="pdp__stat-card">
            <p className="pdp__stat-label">Всего часов</p>
            <p className="pdp__stat-value">{totalHours.toFixed(2)}</p>
            <div className="pdp__stat-rows">
              <div className="pdp__stat-row">
                <span>Оплачиваемые</span>
                <span className="pdp__stat-row-val">{billable.toFixed(2)}</span>
              </div>
              <div className="pdp__stat-row">
                <span>Неоплачиваемые</span>
                <span className="pdp__stat-row-val">{nonBill.toFixed(2)}</span>
              </div>
            </div>
          </div>
<div className="pdp__stat-card">
            <p className="pdp__stat-label">
              Остаток бюджета
              {remainingPct != null && (
                <span className={isOver ? 'pdp__stat-label-pct--over' : 'pdp__stat-label-pct'}>
                  &nbsp;({isOver ? '' : '+'}{remainingPct}%)
                </span>
              )}
              {isOver && <span className="pdp__stat-info"><IcoInfo /></span>}
            </p>
            {remaining != null ? (
              <p className={`pdp__stat-value${isOver ? ' pdp__stat-value--red' : ''}`}>
                {isOver ? '−' : ''}{fmtAmt(Math.abs(remaining), project.currency)}
              </p>
            ) : (
              <p className="pdp__stat-value pdp__stat-value--na">Без бюджета</p>
            )}
            {hasBudget && (
              <div className="pdp__stat-budget-block">
                <div className="pdp__stat-budget-row">
                  <span className="pdp__stat-budget-label">Общий бюджет</span>
                  <span className="pdp__stat-budget-val">{fmtAmt(project.budget!, project.currency)}</span>
                </div>
                <div className="pdp__budget-bar">
                  <div className="pdp__budget-bar-fill pdp__budget-bar-fill--blue" style={{ width: `${spentPct}%` }} />
                  {isOver && <div className="pdp__budget-bar-fill pdp__budget-bar-fill--red" style={{ width: `${overPct}%` }} />}
                </div>
              </div>
            )}
          </div>
<div className="pdp__stat-card">
            <p className="pdp__stat-label">Внутренние затраты</p>
            {project.costs > 0 ? (
              <p className="pdp__stat-value">{fmtAmt(project.costs, project.currency)}</p>
            ) : (
              <p className="pdp__stat-value pdp__stat-value--na">N/A</p>
            )}
            <p className="pdp__stat-hint">Внутренние ставки не заданы для некоторых сотрудников.</p>
          </div>
<div className="pdp__stat-card">
            <p className="pdp__stat-label">Не выставлено счётов</p>
            <p className="pdp__stat-value">{fmtAmt(project.spent, project.currency)}</p>
            <button className="pdp__invoice-btn">Создать счёт</button>
          </div>

        </div>
<div className="pdp__detail-block">
          <nav className="pdp__detail-tabs" role="tablist">
            {([
              ['tasks',    'Задачи'],
              ['team',     'Команда'],
              ['invoices', 'Счета'],
            ] as [DetailTabId, string][]).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={detailTab === id}
                className={`pdp__detail-tab${detailTab === id ? ' pdp__detail-tab--active' : ''}`}
                onClick={() => setDetailTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          {detailTab === 'tasks' && (
            <TasksPanel
              rows={taskData.billable}
              nonBillableRows={taskData.nonBillable}
              totalHours={billable}
              totalAmt={project.spent}
              currency={project.currency}
            />
          )}

          {detailTab === 'team' && (
            <div className="pdp__detail-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <p>Участники команды появятся здесь</p>
            </div>
          )}

          {detailTab === 'invoices' && (
            <div className="pdp__detail-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <p>Счета для этого проекта не созданы</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
