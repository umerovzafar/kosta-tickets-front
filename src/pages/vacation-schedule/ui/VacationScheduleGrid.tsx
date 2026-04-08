import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteVacationAbsenceDay,
  getVacationKindCodes,
  getVacationKindLegend,
  listVacationAbsenceDays,
  listVacationScheduleEmployees,
  patchVacationAbsenceDay,
  postVacationEmployeeAbsenceDay,
} from '@entities/vacation'
import { useCurrentUser } from '@shared/hooks'
import { canEditVacationSchedule } from '../model/vacationScheduleAccess'
import {
  coerceVacationAbsenceDayRow,
  vacationCellKey,
  vacationIsoDateFromParts,
  vacationMarksFromAbsenceDays,
  vacationUiLegendFromKindCodes,
  vacationUiLegendFromKindLegendApi,
  type VacationMarkCell,
  type VacationMarksState,
  type VacationScheduleEmployeeRow,
  type VacationUiLegendItem,
} from '../lib/vacationScheduleModel'
import type { VacationAbsenceDayApi } from '@entities/vacation'
import { VacationAddEmployeeModal } from './VacationAddEmployeeModal'
import { VacationContinuousTable } from './VacationContinuousTable'
import { VacationDayEditPopover } from './VacationDayEditPopover'
import { VacationEmployeeDetailModal } from './VacationEmployeeDetailModal'
import { VacationScheduleImportModal } from './VacationScheduleImportModal'
import { VacationScheduleSkeleton } from './VacationScheduleSkeleton'
import './VacationScheduleGrid.css'

function clampYear(y: number): number {
  return Math.min(2100, Math.max(2000, y))
}

type DayPickerState = {
  employeeId: number
  monthIndex: number
  day: number
  clientX: number
  clientY: number
  current: VacationMarkCell | undefined
}

export function VacationScheduleGrid() {
  const { user } = useCurrentUser()
  const canEditSchedule = canEditVacationSchedule(user)
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(() => clampYear(currentYear))
  const [yearInput, setYearInput] = useState(String(clampYear(currentYear)))
  const [employees, setEmployees] = useState<VacationScheduleEmployeeRow[]>([])
  const [marks, setMarks] = useState<VacationMarksState>({})
  const [legendItems, setLegendItems] = useState<VacationUiLegendItem[]>(() =>
    vacationUiLegendFromKindCodes(null),
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadToken, setLoadToken] = useState(0)
  const [detailEmployeeId, setDetailEmployeeId] = useState<number | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false)
  const [dayPicker, setDayPicker] = useState<DayPickerState | null>(null)
  const [daySaving, setDaySaving] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getVacationKindLegend()
      .then((leg) => {
        if (!cancelled) setLegendItems(vacationUiLegendFromKindLegendApi(leg))
      })
      .catch(() => {
        void getVacationKindCodes()
          .then((codes) => {
            if (!cancelled) setLegendItems(vacationUiLegendFromKindCodes(codes))
          })
          .catch(() => {
            if (!cancelled) setLegendItems(vacationUiLegendFromKindCodes(null))
          })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    setLoading(true)
    const y = year
    const from = `${y}-01-01`
    const to = `${y}-12-31`
    void Promise.all([
      listVacationScheduleEmployees(y),
      listVacationAbsenceDays(y, { dateFrom: from, dateTo: to }),
    ])
      .then(([empRows, dayRows]) => {
        if (cancelled) return
        const mapped: VacationScheduleEmployeeRow[] = empRows.map((e) => ({
          id: e.id,
          label: e.full_name,
          excelRowNo: e.excel_row_no,
          plannedPeriodNote: e.planned_period_note,
        }))
        const idSet = new Set(mapped.map((e) => e.id))
        const coerced = dayRows
          .map((row) => coerceVacationAbsenceDayRow(row))
          .filter((x): x is VacationAbsenceDayApi => x != null)
        setEmployees(mapped)
        setMarks(vacationMarksFromAbsenceDays(y, coerced, idSet))
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setEmployees([])
        setMarks({})
        setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить график отсутствий')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year, loadToken])

  const applyYearFromInput = () => {
    const n = Number.parseInt(yearInput.trim(), 10)
    if (!Number.isFinite(n)) return
    const c = clampYear(n)
    setYear(c)
    setYearInput(String(c))
  }

  const refetch = useCallback(() => setLoadToken((t) => t + 1), [])

  const closeDayPicker = useCallback(() => setDayPicker(null), [])

  const handleDayCellClick = useCallback(
    (p: { employeeId: number; monthIndex: number; day: number; clientX: number; clientY: number }) => {
      if (!canEditSchedule) return
      setMutationError(null)
      const key = vacationCellKey(p.employeeId, year, p.monthIndex, p.day)
      setDayPicker({ ...p, current: marks[key] })
    },
    [canEditSchedule, marks, year],
  )

  const handlePickKindCode = useCallback(
    async (kindCode: number) => {
      if (!dayPicker) return
      const { employeeId, monthIndex, day, current } = dayPicker
      const iso = vacationIsoDateFromParts(year, monthIndex, day)
      setMutationError(null)
      if (current?.kindCode === kindCode) {
        closeDayPicker()
        return
      }
      setDaySaving(true)
      try {
        if (!current) {
          await postVacationEmployeeAbsenceDay(employeeId, { absence_on: iso, kind_code: kindCode })
        } else if (current.absenceDayId != null) {
          await patchVacationAbsenceDay(current.absenceDayId, { kind_code: kindCode })
        } else {
          setMutationError(
            'У отметки нет id в ответе сервера. Нажмите «Показать» по году ещё раз или обновите страницу.',
          )
          return
        }
        closeDayPicker()
        refetch()
      } catch (e: unknown) {
        setMutationError(e instanceof Error ? e.message : 'Не удалось сохранить')
      } finally {
        setDaySaving(false)
      }
    },
    [closeDayPicker, dayPicker, refetch, year],
  )

  const handleClearDay = useCallback(async () => {
    if (!dayPicker?.current) return
    const aid = dayPicker.current.absenceDayId
    if (aid == null) {
      setMutationError('Нельзя снять отметку без id записи. Нажмите «Показать» по году или обновите страницу.')
      return
    }
    setDaySaving(true)
    setMutationError(null)
    try {
      await deleteVacationAbsenceDay(aid)
      closeDayPicker()
      refetch()
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Не удалось удалить отметку')
    } finally {
      setDaySaving(false)
    }
  }, [closeDayPicker, dayPicker, refetch])

  const popoverOpen = dayPicker != null && canEditSchedule

  const popoverCurrent = useMemo(() => {
    if (!dayPicker) return undefined
    return dayPicker.current
  }, [dayPicker])

  return (
    <div className="vac-vsg">
      <div className="vac-vsg__toolbar">
        <label className="vac-vsg__year-label" htmlFor="vac-year-input">
          Год графика (2000–2100)
        </label>
        <input
          id="vac-year-input"
          className="vac-vsg__year-input"
          type="number"
          min={2000}
          max={2100}
          value={yearInput}
          onChange={(e) => setYearInput(e.target.value)}
          onBlur={() => applyYearFromInput()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              applyYearFromInput()
            }
          }}
        />
        <button type="button" className="vac-vsg__year-apply" onClick={() => applyYearFromInput()}>
          Показать
        </button>
        <span className="vac-vsg__toolbar-spacer" aria-hidden />
        {canEditSchedule && (
          <>
            <button type="button" className="vac-vsg__add-emp-btn" onClick={() => setAddEmployeeOpen(true)}>
              Добавить сотрудника
            </button>
            <button type="button" className="vac-vsg__import-btn" onClick={() => setImportModalOpen(true)}>
              Загрузить график (Excel)
            </button>
          </>
        )}
      </div>

      {mutationError && (
        <p className="vac-vsg__mutation-err" role="alert">
          {mutationError}
        </p>
      )}

      {loadError && (
        <div className="vac-vsg__err-wrap" role="alert">
          <p className="vac-vsg__error">{loadError}</p>
          <button type="button" className="vac-vsg__retry" onClick={refetch}>
            Повторить запрос
          </button>
        </div>
      )}

      {loading && <VacationScheduleSkeleton />}

      {!loading && !loadError && (
        <VacationContinuousTable
          year={year}
          employees={employees}
          marks={marks}
          legendItems={legendItems}
          onEmployeeClick={(id) => setDetailEmployeeId(id)}
          emptyStateImportHint={canEditSchedule}
          readOnlyDays={!canEditSchedule}
          onDayCellClick={handleDayCellClick}
        />
      )}

      {canEditSchedule && (
        <>
          <VacationScheduleImportModal
            open={importModalOpen}
            onClose={() => setImportModalOpen(false)}
            defaultYear={year}
            onImportSuccess={refetch}
          />
          <VacationAddEmployeeModal
            open={addEmployeeOpen}
            onClose={() => setAddEmployeeOpen(false)}
            year={year}
            onSuccess={refetch}
          />
        </>
      )}

      {detailEmployeeId != null && (
        <VacationEmployeeDetailModal
          employeeId={detailEmployeeId}
          year={year}
          onClose={() => setDetailEmployeeId(null)}
          canEdit={canEditSchedule}
          onScheduleMutated={refetch}
        />
      )}

      <VacationDayEditPopover
        open={popoverOpen}
        x={dayPicker?.clientX ?? 0}
        y={dayPicker?.clientY ?? 0}
        legendItems={legendItems}
        current={popoverCurrent}
        saving={daySaving}
        onPickKindCode={(code) => void handlePickKindCode(code)}
        onClear={() => void handleClearDay()}
        onClose={closeDayPicker}
      />
    </div>
  )
}
