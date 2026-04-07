import type { CSSProperties } from 'react'
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  VACATION_ABSENCE_LEGEND,
  VACATION_KIND_COLORS,
  VACATION_MONTH_NAMES,
  loadVacationMarks,
  parseVacationCellKey,
  saveVacationMarks,
  vacationCellKey,
  vacationDayIsWeekendRu,
  vacationMonthHeaderSpans,
  vacationWeekdayShortRu,
  vacationYearDayColumns,
  type VacationAbsenceKind,
  type VacationMarksState,
  type VacationScheduleEmployeeRow,
  type VacationYearDayColumn,
} from '../lib/vacationScheduleModel'
import './VacationContinuousTable.css'

type Anchor = { userIndex: number; colIndex: number }

type VacationContinuousTableProps = {
  year: number
  employees: VacationScheduleEmployeeRow[]
}

type DayColMeta = {
  wknd: boolean
  monthStart: boolean
}

function keysInRectangle(
  year: number,
  employees: VacationScheduleEmployeeRow[],
  dayColumns: VacationYearDayColumn[],
  a: Anchor,
  b: Anchor,
): string[] {
  const r0 = Math.min(a.userIndex, b.userIndex)
  const r1 = Math.max(a.userIndex, b.userIndex)
  const c0 = Math.min(a.colIndex, b.colIndex)
  const c1 = Math.max(a.colIndex, b.colIndex)
  const keys: string[] = []
  for (let r = r0; r <= r1; r += 1) {
    const uid = employees[r]?.id
    if (uid == null) continue
    for (let c = c0; c <= c1; c += 1) {
      const dc = dayColumns[c]
      if (!dc) continue
      keys.push(vacationCellKey(uid, year, dc.monthIndex, dc.day))
    }
  }
  return keys
}

/** Счётчики по сотруднику за один проход по marks (без O(сотр × дни) на кадр) */
function buildUserMarkStats(
  marks: VacationMarksState,
  year: number,
  employeeIds: Set<number>,
): Map<number, { months: number[]; year: number }> {
  const stats = new Map<number, { months: number[]; year: number }>()
  for (const id of employeeIds) {
    stats.set(id, { months: Array(12).fill(0), year: 0 })
  }
  for (const key of Object.keys(marks)) {
    const p = parseVacationCellKey(key)
    if (!p || p.year !== year) continue
    const s = stats.get(p.userId)
    if (!s) continue
    s.months[p.monthIndex] += 1
    s.year += 1
  }
  return stats
}

type VacationDayCellProps = {
  userId: number
  colIndex: number
  kind: VacationAbsenceKind | undefined
  isSelected: boolean
  isWeekendEmpty: boolean
  isMonthStart: boolean
  onCellMouseDown: (e: React.MouseEvent, userId: number, colIndex: number) => void
  onCellMouseEnter: (userId: number, colIndex: number) => void
}

const VacationDayCell = memo(function VacationDayCell({
  userId,
  colIndex,
  kind,
  isSelected,
  isWeekendEmpty,
  isMonthStart,
  onCellMouseDown,
  onCellMouseEnter,
}: VacationDayCellProps) {
  const bg = kind ? VACATION_KIND_COLORS[kind] : undefined
  return (
    <td
      role="gridcell"
      aria-selected={isSelected}
      className={[
        'vac-cont__cell',
        isWeekendEmpty && 'vac-cont__cell--weekend',
        isMonthStart && 'vac-cont__cell--month-start',
        isSelected && 'vac-cont__cell--selected',
      ]
        .filter(Boolean)
        .join(' ')}
      style={bg ? ({ backgroundColor: bg } as CSSProperties) : undefined}
      onMouseDown={(e) => onCellMouseDown(e, userId, colIndex)}
      onMouseEnter={() => onCellMouseEnter(userId, colIndex)}
    />
  )
})

export function VacationContinuousTable({ year, employees }: VacationContinuousTableProps) {
  const dayColumns = useMemo(() => vacationYearDayColumns(year), [year])
  const monthSpans = useMemo(() => vacationMonthHeaderSpans(dayColumns), [dayColumns])
  const dayColsByMonth = useMemo(() => {
    const buckets: VacationYearDayColumn[][] = Array.from({ length: 12 }, () => [])
    for (const col of dayColumns) {
      buckets[col.monthIndex]!.push(col)
    }
    return buckets
  }, [dayColumns])

  const dayMeta = useMemo<DayColMeta[]>(
    () =>
      dayColumns.map((col) => ({
        wknd: vacationDayIsWeekendRu(year, col.monthIndex, col.day),
        monthStart: col.day === 1 && col.monthIndex > 0,
      })),
    [dayColumns, year],
  )

  const userIndexById = useMemo(() => {
    const m = new Map<number, number>()
    employees.forEach((e, i) => m.set(e.id, i))
    return m
  }, [employees])

  const employeeIdSet = useMemo(() => new Set(employees.map((e) => e.id)), [employees])

  const [marks, setMarks] = useState<VacationMarksState>(() => loadVacationMarks(year))
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const anchorRef = useRef<Anchor | null>(null)
  const isDraggingRef = useRef(false)
  const ctrlDragRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectionRafRef = useRef<number | null>(null)
  const pendingSelectionRef = useRef<Set<string> | null>(null)

  const ixRef = useRef({
    year,
    employees,
    dayColumns,
    userIndexById,
  })
  ixRef.current = { year, employees, dayColumns, userIndexById }

  const userStats = useMemo(
    () => buildUserMarkStats(marks, year, employeeIdSet),
    [marks, year, employeeIdSet],
  )

  useEffect(() => {
    setMarks(loadVacationMarks(year))
    setSelected(new Set())
    anchorRef.current = null
  }, [year])

  useEffect(
    () => () => {
      if (selectionRafRef.current !== null) {
        cancelAnimationFrame(selectionRafRef.current)
        selectionRafRef.current = null
      }
    },
    [],
  )

  const scheduleSave = useCallback(
    (next: VacationMarksState) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => saveVacationMarks(year, next), 350)
    },
    [year],
  )

  const setMarksAndPersist = useCallback(
    (updater: (prev: VacationMarksState) => VacationMarksState) => {
      setMarks((prev) => {
        const next = updater(prev)
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave],
  )

  useEffect(() => {
    const onUp = () => {
      isDraggingRef.current = false
      ctrlDragRef.current = false
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(new Set())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const flushSelectionRaf = useCallback(() => {
    selectionRafRef.current = null
    const p = pendingSelectionRef.current
    pendingSelectionRef.current = null
    if (p) setSelected(new Set(p))
  }, [])

  const queueSelection = useCallback(
    (next: Set<string>) => {
      pendingSelectionRef.current = next
      if (selectionRafRef.current === null) {
        selectionRafRef.current = requestAnimationFrame(flushSelectionRaf)
      }
    },
    [flushSelectionRaf],
  )

  const findCellPosition = useCallback((userId: number, colIndex: number): Anchor | null => {
    const { userIndexById: map, dayColumns: cols } = ixRef.current
    const userIndex = map.get(userId)
    if (userIndex === undefined || colIndex < 0 || colIndex >= cols.length) return null
    return { userIndex, colIndex }
  }, [])

  const handleCellMouseDown = useCallback((e: React.MouseEvent, userId: number, colIndex: number) => {
    e.preventDefault()
    const { year: y, employees: em, dayColumns: cols } = ixRef.current
    const pos = findCellPosition(userId, colIndex)
    if (!pos) return
    const key = vacationCellKey(userId, y, cols[colIndex]!.monthIndex, cols[colIndex]!.day)

    if (e.shiftKey && anchorRef.current) {
      const keys = keysInRectangle(y, em, cols, anchorRef.current, pos)
      setSelected(new Set(keys))
      isDraggingRef.current = false
      return
    }

    if (e.metaKey || e.ctrlKey) {
      setSelected((prev) => {
        const n = new Set(prev)
        if (n.has(key)) n.delete(key)
        else n.add(key)
        return n
      })
      anchorRef.current = pos
      isDraggingRef.current = true
      ctrlDragRef.current = true
      return
    }

    anchorRef.current = pos
    isDraggingRef.current = true
    ctrlDragRef.current = false
    setSelected(new Set([key]))
  }, [findCellPosition])

  const handleCellMouseEnter = useCallback(
    (userId: number, colIndex: number) => {
      if (!isDraggingRef.current) return
      const { year: y, employees: em, dayColumns: cols } = ixRef.current
      const pos = findCellPosition(userId, colIndex)
      if (!pos || !anchorRef.current) return

      if (ctrlDragRef.current) {
        const key = vacationCellKey(userId, y, cols[colIndex]!.monthIndex, cols[colIndex]!.day)
        setSelected((prev) => {
          const n = new Set(prev)
          n.add(key)
          return n
        })
        return
      }

      const keys = keysInRectangle(y, em, cols, anchorRef.current, pos)
      queueSelection(new Set(keys))
    },
    [findCellPosition, queueSelection],
  )

  const applyKind = useCallback(
    (kind: VacationAbsenceKind | null) => {
      if (selected.size === 0) return
      setMarksAndPersist((prev) => {
        const n = { ...prev }
        for (const k of selected) {
          if (kind === null) delete n[k]
          else n[k] = kind
        }
        return n
      })
    },
    [selected, setMarksAndPersist],
  )

  const legendStrip = (
    <ul className="vac-cont__legend" aria-label="Виды отсутствия">
      {VACATION_ABSENCE_LEGEND.map((item) => (
        <li
          key={item.kind}
          className="vac-cont__legend-item"
          style={{ '--vac-legend-bg': item.color } as CSSProperties}
        >
          <span className="vac-cont__legend-dash">—</span>
          {item.label}
        </li>
      ))}
    </ul>
  )

  const toolbar =
    selected.size > 0 ? (
      <div className="vac-cont__toolbar" role="toolbar" aria-label="Отметить выбранные ячейки">
        <span className="vac-cont__toolbar-label">Выбрано: {selected.size}</span>
        <div className="vac-cont__toolbar-swatches">
          {VACATION_ABSENCE_LEGEND.map((item) => (
            <button
              key={item.kind}
              type="button"
              className="vac-cont__swatch"
              style={{ background: item.color }}
              title={item.label}
              aria-label={item.label}
              onClick={() => applyKind(item.kind)}
            />
          ))}
          <button type="button" className="vac-cont__swatch vac-cont__swatch--clear" onClick={() => applyKind(null)}>
            Снять
          </button>
        </div>
      </div>
    ) : null

  if (employees.length === 0) {
    return (
      <div className="vac-cont">
        {legendStrip}
        <p className="vac-cont__empty">Нет сотрудников для отображения</p>
      </div>
    )
  }

  return (
    <div className="vac-cont">
      {legendStrip}
      {toolbar}
      <div className="vac-cont__scroll">
        <table className="vac-cont__table" role="grid" aria-multiselectable="true">
          <thead>
            <tr>
              <th className="vac-cont__sticky-corner" colSpan={2} scope="colgroup">
                {year}
              </th>
              {monthSpans.map((s) => (
                <Fragment key={`mh-${s.monthIndex}`}>
                  <th
                    scope="colgroup"
                    colSpan={s.span}
                    className={[
                      'vac-cont__month-title',
                      s.monthIndex > 0 && 'vac-cont__month-title--boundary',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {VACATION_MONTH_NAMES[s.monthIndex]}
                  </th>
                  <th className="vac-cont__month-sum-head" rowSpan={3} scope="col">
                    <span className="vac-cont__head-vertical">Кол-во</span>
                  </th>
                </Fragment>
              ))}
              <th className="vac-cont__year-sum-head" rowSpan={3} scope="col">
                <span className="vac-cont__head-vertical vac-cont__head-vertical--wide">Всего</span>
              </th>
            </tr>
            <tr>
              <th className="vac-cont__sticky-num" rowSpan={2} scope="col">
                №
              </th>
              <th className="vac-cont__sticky-name" rowSpan={2} scope="col">
                ФИО
              </th>
              {dayColumns.map((col, i) => {
                const meta = dayMeta[i]!
                return (
                  <th
                    key={`d-${col.colIndex}`}
                    scope="col"
                    className={[
                      'vac-cont__th-day',
                      meta.wknd && 'vac-cont__th-day--weekend',
                      meta.monthStart && 'vac-cont__th-day--month-start',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.day}
                  </th>
                )
              })}
            </tr>
            <tr>
              {dayColumns.map((col, i) => {
                const meta = dayMeta[i]!
                return (
                  <th
                    key={`w-${col.colIndex}`}
                    scope="col"
                    className={[
                      'vac-cont__th-wd',
                      meta.wknd && 'vac-cont__th-wd--weekend',
                      meta.monthStart && 'vac-cont__th-wd--month-start',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {vacationWeekdayShortRu(year, col.monthIndex, col.day)}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, userIndex) => {
              const st = userStats.get(emp.id)
              const yearTotal = st?.year ?? 0
              return (
                <tr key={emp.id} className="vac-cont__body-row">
                  <td className="vac-cont__sticky-num">{userIndex + 1}</td>
                  <td className="vac-cont__sticky-name vac-cont__name-cell">{emp.label}</td>
                  {dayColsByMonth.map((cols, monthIndex) => (
                    <Fragment key={`mrow-${emp.id}-${monthIndex}`}>
                      {cols.map((col) => {
                        const key = vacationCellKey(emp.id, year, col.monthIndex, col.day)
                        const kind = marks[key]
                        const meta = dayMeta[col.colIndex]!
                        return (
                          <VacationDayCell
                            key={key}
                            userId={emp.id}
                            colIndex={col.colIndex}
                            kind={kind}
                            isSelected={selected.has(key)}
                            isWeekendEmpty={meta.wknd && !kind}
                            isMonthStart={meta.monthStart}
                            onCellMouseDown={handleCellMouseDown}
                            onCellMouseEnter={handleCellMouseEnter}
                          />
                        )
                      })}
                      <td className="vac-cont__sum-month" title={`Отмечено дней в ${VACATION_MONTH_NAMES[monthIndex]}`}>
                        {st?.months[monthIndex] ?? 0}
                      </td>
                    </Fragment>
                  ))}
                  <td className="vac-cont__sum-year" title="Всего отмеченных дней за год">
                    {yearTotal}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="vac-cont__hint-mini">
        Выделение: протащить мышью, Shift+клик — прямоугольник от якоря, Ctrl+клик — добавить ячейку. Esc — снять
        выделение. Колонки «Кол-во» — по месяцам, «Всего» — за год. Выходные подсвечены. Данные в браузере по году.
      </p>
    </div>
  )
}
