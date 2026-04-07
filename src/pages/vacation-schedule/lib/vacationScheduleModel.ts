import type { User } from '@entities/user'

export type VacationScheduleEmployeeRow = {
  id: number
  label: string
}

/** Роль, которую не показываем в графике отпусков */
export const VACATION_MAIN_ADMIN_ROLE = 'Главный администратор' as const

/** Типы отметок (порядок совпадает с легендой) */
export const VACATION_ABSENCE_KINDS = ['annual', 'sick', 'dayoff', 'business', 'remote'] as const
export type VacationAbsenceKind = (typeof VACATION_ABSENCE_KINDS)[number]

/** Легенда «Вид отсутствия в офисе» — как в типовом Excel-графике */
export const VACATION_ABSENCE_LEGEND: ReadonlyArray<{
  kind: VacationAbsenceKind
  color: string
  label: string
}> = [
  { kind: 'annual', color: '#d9b3ff', label: 'ежегодный отпуск' },
  { kind: 'sick', color: '#ff9999', label: 'отсутствие по болезни' },
  { kind: 'dayoff', color: '#33ccff', label: 'Day Off (нерабочий)' },
  { kind: 'business', color: '#99e699', label: 'командировка' },
  { kind: 'remote', color: '#ffff00', label: 'дистанционный режим' },
]

export const VACATION_KIND_COLORS: Record<VacationAbsenceKind, string> = Object.fromEntries(
  VACATION_ABSENCE_LEGEND.map((x) => [x.kind, x.color]),
) as Record<VacationAbsenceKind, string>

export const VACATION_MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const

export type VacationYearDayColumn = {
  monthIndex: number
  day: number
  /** Индекс в общем массиве дней года (0..) */
  colIndex: number
}

function userSortLabel(u: User): string {
  return (u.display_name?.trim() || u.email || '').toLowerCase()
}

/** Сотрудники для графика: без главного администратора, по ФИО/email */
export function vacationScheduleEmployees(users: User[]): { id: number; label: string }[] {
  return users
    .filter((u) => u.role !== VACATION_MAIN_ADMIN_ROLE)
    .sort((a, b) => userSortLabel(a).localeCompare(userSortLabel(b), 'ru'))
    .map((u) => ({ id: u.id, label: u.display_name?.trim() || u.email }))
}

export function vacationDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** Короткий день недели: пн … вс (неделя с понедельника) */
export function vacationWeekdayShortRu(year: number, monthIndex: number, dayOfMonth: number): string {
  const d = new Date(year, monthIndex, dayOfMonth)
  const mon0 = (d.getDay() + 6) % 7
  return ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'][mon0]!
}

/** Суббота и воскресенье (неделя с понедельника: индексы 5 и 6) */
export function vacationDayIsWeekendRu(year: number, monthIndex: number, dayOfMonth: number): boolean {
  const d = new Date(year, monthIndex, dayOfMonth)
  const mon0 = (d.getDay() + 6) % 7
  return mon0 >= 5
}

/** Все дни года подряд (для одной горизонтальной шкалы) */
export function vacationYearDayColumns(year: number): VacationYearDayColumn[] {
  const out: VacationYearDayColumn[] = []
  let colIndex = 0
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const n = vacationDaysInMonth(year, monthIndex)
    for (let day = 1; day <= n; day += 1) {
      out.push({ monthIndex, day, colIndex })
      colIndex += 1
    }
  }
  return out
}

export function vacationMonthHeaderSpans(dayColumns: VacationYearDayColumn[]): { monthIndex: number; span: number }[] {
  const spans: { monthIndex: number; span: number }[] = []
  for (const col of dayColumns) {
    const last = spans[spans.length - 1]
    if (last && last.monthIndex === col.monthIndex) last.span += 1
    else spans.push({ monthIndex: col.monthIndex, span: 1 })
  }
  return spans
}

/** Ключ ячейки: год, месяц 0-11, день, userId */
export function vacationCellKey(userId: number, year: number, monthIndex: number, day: number): string {
  return `${year}|${monthIndex}|${day}|${userId}`
}

export function parseVacationCellKey(key: string): {
  year: number
  monthIndex: number
  day: number
  userId: number
} | null {
  const parts = key.split('|')
  if (parts.length !== 4) return null
  const year = Number(parts[0])
  const monthIndex = Number(parts[1])
  const day = Number(parts[2])
  const userId = Number(parts[3])
  if (![year, monthIndex, day, userId].every((n) => Number.isFinite(n))) return null
  return { year, monthIndex, day, userId }
}

const MARKS_STORAGE_KEY = 'kl-vacation-marks-v1'
const MARKS_VERSION = 1 as const

export type VacationMarksState = Record<string, VacationAbsenceKind>

export function loadVacationMarks(year: number): VacationMarksState {
  try {
    const raw = localStorage.getItem(MARKS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const box = parsed as { version?: unknown; year?: unknown; marks?: unknown }
    if (box.version !== MARKS_VERSION || box.year !== year) return {}
    const marks = box.marks
    if (!marks || typeof marks !== 'object') return {}
    const out: VacationMarksState = {}
    for (const [k, v] of Object.entries(marks as Record<string, unknown>)) {
      if (typeof v === 'string' && (VACATION_ABSENCE_KINDS as readonly string[]).includes(v)) {
        out[k] = v as VacationAbsenceKind
      }
    }
    return out
  } catch {
    return {}
  }
}

export function saveVacationMarks(year: number, marks: VacationMarksState): void {
  try {
    localStorage.setItem(
      MARKS_STORAGE_KEY,
      JSON.stringify({ version: MARKS_VERSION, year, marks }),
    )
  } catch {
    /* quota */
  }
}

/** Сколько отмеченных дней у сотрудника за год (по текущим marks) */
export function vacationCountMarkedDaysForUser(marks: VacationMarksState, userId: number, year: number): number {
  let n = 0
  for (const key of Object.keys(marks)) {
    const p = parseVacationCellKey(key)
    if (p && p.userId === userId && p.year === year) n += 1
  }
  return n
}

/** Отмеченные дни сотрудника в одном месяце */
export function vacationCountMarkedDaysForUserInMonth(
  marks: VacationMarksState,
  userId: number,
  year: number,
  monthIndex: number,
): number {
  const nDays = vacationDaysInMonth(year, monthIndex)
  let n = 0
  for (let d = 1; d <= nDays; d += 1) {
    if (marks[vacationCellKey(userId, year, monthIndex, d)]) n += 1
  }
  return n
}
