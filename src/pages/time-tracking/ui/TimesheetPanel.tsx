import { useState, useMemo, useEffect, useId, useRef, useReducer } from 'react'
import { createPortal } from 'react-dom'
import {
  upsertTimeTrackingUser,
  getUserProjectAccess,
  listAllClientProjectsForPicker,
  listTimeManagerClients,
  listClientProjects,
  listClientTasks,
  listTimeEntries,
  createTimeEntry,
  patchTimeEntry,
  deleteTimeEntry,
  isForbiddenError,
  type TimeManagerClientProjectRow,
  type TimeEntryRow,
} from '@entities/time-tracking'
import type { User } from '@entities/user'
import { useCurrentUser } from '@shared/hooks'
import { TimesheetSkeleton } from './TimesheetSkeleton'
import { TimesheetSearchableSelect } from './TimesheetSearchableSelect'

function startOfWeek(d: Date): Date {
  const day = new Date(d)
  const dow = day.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  day.setDate(day.getDate() + diff)
  day.setHours(0, 0, 0, 0)
  return day
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}
function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function fmtShort(d: Date) {
  return d.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '').toUpperCase()
}
function fmtHours(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return '0:00'
  const totalMin = Math.max(0, Math.round(h * 60 + 1e-9))
  const wh = Math.floor(totalMin / 60)
  const wm = totalMin % 60
  return `${wh}:${String(wm).padStart(2, '0')}`
}

/** Часы:минуты:секунды из миллисекунд — для живого таймера (всегда три поля: ч:мм:сс). */
function formatClockFromMs(totalMs: number): string {
  if (!Number.isFinite(totalMs) || totalMs < 0) return '0:00:00'
  const s = Math.max(0, Math.floor(totalMs / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * Округление до целых минут по правилам математики: до 30 с «вниз», от 30 с — «вверх»
 * (ближайшая минута: Math.round от длительности в минутах; ровно 30 с → 1 мин).
 */
function elapsedMsToLoggedHours(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  const minutes = Math.round(elapsedMs / 60_000)
  return minutes / 60
}
function fmtDateHeading(d: Date): string {
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase())
}

type TimeEntry = {
  id: string
  date: string
  project: string
  client: string
  /** UUID проекта в time-tracking (для редактирования и API). */
  projectId?: string
  task: string
  notes: string
  hours: number
  billable: boolean
  color: string
  running?: boolean
}

type ProjectOption = { id: string; name: string; client: string; color: string; clientId: string }

function isDraftTimeEntryId(id: string): boolean {
  return id.startsWith('te_')
}

function parseDescription(raw: string | null): { task: string; notes: string } {
  if (!raw?.trim()) return { task: '', notes: '' }
  const idx = raw.indexOf('\n')
  if (idx === -1) return { task: raw.trim(), notes: '' }
  return { task: raw.slice(0, idx).trim(), notes: raw.slice(idx + 1).trim() }
}

function buildDescription(task: string, notes: string): string | null {
  const t = task.trim()
  const n = notes.trim()
  if (!t && !n) return null
  if (!t) return n
  if (!n) return t
  return `${t}\n${n}`
}

function uniqEntriesById(list: TimeEntry[]): TimeEntry[] {
  const seen = new Set<string>()
  const out: TimeEntry[] = []
  for (const e of list) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    out.push(e)
  }
  return out
}

function mapTimeEntryRowToUi(row: TimeEntryRow, projectById: Map<string, ProjectOption>): TimeEntry {
  const pid = row.project_id ?? undefined
  const p = pid ? projectById.get(pid) : undefined
  const { task, notes } = parseDescription(row.description)
  const hRaw = row.hours
  const h = typeof hRaw === 'number' ? hRaw : parseFloat(String(hRaw))
  return {
    id: row.id,
    date: row.work_date,
    project: p?.name ?? 'Проект',
    client: p?.client ?? '',
    projectId: pid,
    task,
    notes,
    hours: Number.isFinite(h) ? h : 0,
    billable: row.is_billable,
    color: p?.color ?? hashToColor(pid ?? row.id),
  }
}

function hoursToApiPayload(hours: number): number {
  return Math.round(hours * 1_000_000) / 1_000_000
}

const TIMER_LS_PREFIX = 'tt_timesheet_timer_v1:'

function timerStorageKey(userId: number): string {
  return `${TIMER_LS_PREFIX}${userId}`
}

type TimerPersistPayload = {
  v: 1
  authUserId: number
  entryId: string
  startedAt: number
  snapshot: TimeEntry
}

function parseTimerPayload(raw: string): TimerPersistPayload | null {
  try {
    const o = JSON.parse(raw) as Partial<TimerPersistPayload>
    if (
      o.v !== 1 ||
      typeof o.authUserId !== 'number' ||
      typeof o.entryId !== 'string' ||
      typeof o.startedAt !== 'number' ||
      !o.snapshot ||
      typeof o.snapshot !== 'object'
    ) {
      return null
    }
    return o as TimerPersistPayload
  } catch {
    return null
  }
}

type RunningTimerState = { entryId: string; startedAt: number }

function groupProjectsByClient(list: ProjectOption[]): { client: string; projects: ProjectOption[] }[] {
  const m = new Map<string, ProjectOption[]>()
  for (const p of list) {
    const c = (p.client || '').trim() || '—'
    if (!m.has(c)) m.set(c, [])
    m.get(c)!.push(p)
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ru', { sensitivity: 'base' }))
    .map(([client, projs]) => ({
      client,
      projects: [...projs].sort((x, y) => x.name.localeCompare(y.name, 'ru', { sensitivity: 'base' })),
    }))
}

function hashToColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 52% 40%)`
}

async function loadTimesheetProjectOptions(user: User): Promise<{ items: ProjectOption[]; error: string | null }> {
  await upsertTimeTrackingUser(user)
  const access = await getUserProjectAccess(user.id)
  const allowed = new Set(access.projectIds)
  if (allowed.size === 0) {
    return { items: [], error: null }
  }

  const clients = await listTimeManagerClients()
  const nameById = new Map(clients.map((c) => [c.id, c.name]))

  let rows: TimeManagerClientProjectRow[] = []
  try {
    rows = await listAllClientProjectsForPicker()
  } catch {
    const chunks = await Promise.all(
      clients.map((c) =>
        listClientProjects(c.id).catch((e) => {
          if (isForbiddenError(e)) return [] as TimeManagerClientProjectRow[]
          throw e
        }),
      ),
    )
    rows = chunks.flat()
  }

  const items = rows
    .filter((p) => allowed.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      client: nameById.get(p.client_id) ?? '',
      clientId: p.client_id,
      color: hashToColor(p.id),
    }))

  if (allowed.size > 0 && items.length === 0) {
    return {
      items: [],
      error:
        'Доступ к проектам настроен, но список не удалось загрузить. Обновите страницу или проверьте права в разделе «Проекты».',
    }
  }

  return { items, error: null }
}

type EntryForm = { projectId: string; task: string; date: string; hours: string; notes: string; billable: boolean }

function resolveInitialForm(
  entry: TimeEntry | undefined,
  defaultDate: string,
  projects: ProjectOption[],
  tasksByClientId: Record<string, string[]>,
): EntryForm {
  let projectId = ''
  if (entry?.projectId && projects.some((p) => p.id === entry.projectId)) {
    projectId = entry.projectId
  } else if (entry) {
    const m = projects.find((p) => p.name === entry.project && (!entry.client || p.client === entry.client))
    projectId = m?.id ?? projects[0]?.id ?? ''
  } else {
    projectId = projects[0]?.id ?? ''
  }
  const p = projects.find((x) => x.id === projectId)
  const taskNames = p ? (tasksByClientId[p.clientId] ?? []) : []
  let task = entry?.task ?? ''
  if (taskNames.length > 0 && !taskNames.includes(task)) {
    task = taskNames[0] ?? ''
  }
  return {
    projectId,
    task,
    date: entry?.date ?? defaultDate,
    hours: entry ? fmtHours(entry.hours) : '',
    notes: entry?.notes ?? '',
    billable: entry?.billable ?? true,
  }
}

function EntryModal({
  entry,
  defaultDate,
  projects,
  projectsLoading,
  projectsLoadError,
  tasksByClientId,
  onClose,
  onSave,
}: {
  entry?: TimeEntry
  defaultDate: string
  projects: ProjectOption[]
  projectsLoading: boolean
  projectsLoadError: string | null
  tasksByClientId: Record<string, string[]>
  onClose: () => void
  onSave: (e: TimeEntry) => void | Promise<void>
}) {
  const uid = useId()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EntryForm>(() =>
    projects.length > 0 ? resolveInitialForm(entry, defaultDate, projects, tasksByClientId) : {
      projectId: '',
      task: '',
      date: defaultDate,
      hours: entry ? fmtHours(entry.hours) : '',
      notes: entry?.notes ?? '',
      billable: entry?.billable ?? true,
    },
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  const proj = projects.find((p) => p.id === form.projectId) ?? projects[0]
  const taskNames = proj ? (tasksByClientId[proj.clientId] ?? []) : []
  const projectsByClient = useMemo(() => groupProjectsByClient(projects), [projects])
  const flatProjects = useMemo(
    () => projectsByClient.flatMap(({ projects: grp }) => grp),
    [projectsByClient],
  )

  useEffect(() => {
    if (!proj) return
    const names = tasksByClientId[proj.clientId] ?? []
    if (names.length === 0) return
    setForm((f) => (names.includes(f.task) ? f : { ...f, task: names[0] ?? '' }))
  }, [proj?.clientId, proj?.id, tasksByClientId])

  function parseHours(s: string): number {
    const clean = s.trim().replace(',', '.')
    if (clean.includes(':')) {
      const [h, m] = clean.split(':').map(Number)
      return h + (m || 0) / 60
    }
    if (/^\d+\s+\d+$/.test(clean)) {
      const [h, m] = clean.split(/\s+/).map(Number)
      return h + (m || 0) / 60
    }
    return parseFloat(clean)
  }

  const hoursForTimerHint = useMemo(() => {
    const t = form.hours.trim()
    if (!t) return 0
    const h = parseHours(form.hours)
    if (Number.isNaN(h) || h < 0) return null
    return h
  }, [form.hours])

  async function handleSave() {
    if (!proj) { setError('Нет доступных проектов'); return }
    const h = parseHours(form.hours)
    if (form.hours && (isNaN(h) || h < 0)) { setError('Некорректный формат (например: 1:30, 1 30 или 1.5)'); return }
    const payload: TimeEntry = {
      id:        entry?.id ?? `te_${Date.now()}`,
      date:      form.date,
      project:   proj.name,
      client:    proj.client,
      projectId: proj.id,
      task:      form.task,
      notes:     form.notes,
      hours:     form.hours ? h : 0,
      billable:  form.billable,
      color:     proj.color,
    }
    setSaving(true)
    setError(null)
    try {
      await Promise.resolve(onSave(payload))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  if (projectsLoading) {
    return createPortal(
      <div className="tsp-ov" onClick={onClose}>
        <div className="tsp-m" onClick={(e) => e.stopPropagation()}>
          <div className="tsp-m__head">
            <h3 className="tsp-m__title">{entry ? 'Редактировать запись' : 'Добавить время'}</h3>
            <button type="button" className="tsp-m__x" onClick={onClose} aria-label="Закрыть">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="tsp-m__body">
            <p className="tsp-m__hint" role="status">Загрузка списка проектов…</p>
          </div>
          <div className="tsp-m__foot">
            <button type="button" className="tsp-m__btn tsp-m__btn--cancel" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  if (!proj) {
    return createPortal(
      <div className="tsp-ov" onClick={onClose}>
        <div className="tsp-m" onClick={(e) => e.stopPropagation()}>
          <div className="tsp-m__head">
            <h3 className="tsp-m__title">Добавить время</h3>
            <button type="button" className="tsp-m__x" onClick={onClose} aria-label="Закрыть">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="tsp-m__body">
            {projectsLoadError && <p className="tsp-m__err" role="alert">{projectsLoadError}</p>}
            <p className="tsp-m__err">
              Нет назначенных проектов для учёта времени. Попросите администратора выдать доступ к проектам
              (учёт времени → Настройки → «Доступ к проектам» или карточка пользователя → вкладка «Проекты»).
            </p>
          </div>
          <div className="tsp-m__foot">
            <button type="button" className="tsp-m__btn tsp-m__btn--cancel" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div className="tsp-ov" onClick={onClose}>
      <div className="tsp-m" onClick={e => e.stopPropagation()}>
        <div className="tsp-m__stripe" style={{ background: proj.color }} />

        <div className="tsp-m__head">
          <h3 className="tsp-m__title">{entry ? 'Редактировать запись' : 'Добавить время'}</h3>
          <button className="tsp-m__x" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="tsp-m__body">
          <div className="tsp-m__divider" />
          <div className="tsp-m__stack">
            <p className="tsp-m__stack-title">Проект и задача</p>
            <p className="tsp-m__stack-hint">Сначала выберите проект, затем задачу из справочника этого клиента.</p>

            <div className="tsp-m__f tsp-m__f--step">
              <label className="tsp-m__lbl" htmlFor={`${uid}-proj-btn`}>
                <span className="tsp-m__step-num">1</span>
                Проект
              </label>
              <TimesheetSearchableSelect<ProjectOption>
                buttonId={`${uid}-proj-btn`}
                value={form.projectId}
                items={flatProjects}
                getOptionValue={(p) => p.id}
                getOptionLabel={(p) => p.name}
                getSearchText={(p) => `${p.name} ${p.client}`}
                placeholder="Найдите или выберите проект…"
                emptyListText="Нет проектов"
                noMatchText="Ничего не найдено"
                onSelect={(p) => {
                  const names = tasksByClientId[p.clientId] ?? []
                  setForm((f) => ({
                    ...f,
                    projectId: p.id,
                    task:
                      names.length > 0
                        ? names.includes(f.task)
                          ? f.task
                          : (names[0] ?? '')
                        : '',
                  }))
                }}
                renderOption={(p) => (
                  <span className="tsp-srch__opt-rich">
                    <span className="tsp-srch__opt-name">{p.name}</span>
                    <span className="tsp-srch__opt-meta">{p.client}</span>
                  </span>
                )}
                buttonClassName="tsp-srch__btn--tall"
              />
            </div>

            <div className="tsp-m__f tsp-m__f--step">
              <label
                className="tsp-m__lbl"
                htmlFor={taskNames.length > 0 ? `${uid}-task-btn` : `${uid}-t-free`}
              >
                <span className="tsp-m__step-num">2</span>
                Задача проекта
              </label>
              {taskNames.length > 0 ? (
                <TimesheetSearchableSelect<string>
                  buttonId={`${uid}-task-btn`}
                  value={form.task}
                  items={taskNames}
                  getOptionValue={(t) => t}
                  getOptionLabel={(t) => t}
                  getSearchText={(t) => t}
                  placeholder="Найдите или выберите задачу…"
                  emptyListText="Нет задач в справочнике"
                  noMatchText="Ничего не найдено"
                  disabled={!form.projectId}
                  onSelect={(t) => setForm((f) => ({ ...f, task: t }))}
                />
              ) : (
                <input
                  id={`${uid}-t-free`}
                  type="text"
                  className="tsp-m__inp"
                  placeholder="Нет задач в справочнике — укажите вручную"
                  value={form.task}
                  disabled={!form.projectId}
                  onChange={(e) => setForm((f) => ({ ...f, task: e.target.value }))}
                />
              )}
              {proj && taskNames.length === 0 && (
                <p className="tsp-m__field-note">Для клиента не заведены задачи в настройках — введите название вручную.</p>
              )}
            </div>
          </div>
          <div className="tsp-m__row">
            <div className="tsp-m__f">
              <label className="tsp-m__lbl" htmlFor={`${uid}-d`}>Дата</label>
              <input id={`${uid}-d`} type="date" className="tsp-m__inp"
                value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="tsp-m__f">
              <label className="tsp-m__lbl" htmlFor={`${uid}-h`}>Часы <span className="tsp-m__hint">1:30 или 1.5</span></label>
              <input id={`${uid}-h`} type="text" className="tsp-m__inp tsp-m__inp--h" placeholder="0:00"
                value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
              {hoursForTimerHint === 0 && (
                <p className="tsp-m__field-note">
                  При нулевых часах запись появится в табеле и сразу запустится таймер; на сервер время уйдёт после «Стоп».
                </p>
              )}
            </div>
          </div>
          <div className="tsp-m__f">
            <label className="tsp-m__lbl" htmlFor={`${uid}-n`}>Примечание</label>
            <input id={`${uid}-n`} type="text" className="tsp-m__inp" placeholder="Краткое описание…"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {error && <p className="tsp-m__err">{error}</p>}
        </div>

        <div className="tsp-m__foot">
          <button type="button" className="tsp-m__btn tsp-m__btn--cancel" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="tsp-m__btn tsp-m__btn--ok" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Сохранение…' : entry ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function TimesheetPanel() {
  const { user: currentUser, loading: userLoading } = useCurrentUser()
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const [projectsState, setProjectsState] = useState<{
    loading: boolean
    items: ProjectOption[]
    error: string | null
  }>({ loading: true, items: [], error: null })
  const [tasksByClientId, setTasksByClientId] = useState<Record<string, string[]>>({})

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [viewMode,  setViewMode]  = useState<'day' | 'week'>('day')
  const [entries,   setEntries]   = useState<TimeEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [entriesError, setEntriesError] = useState<string | null>(null)

  const projectCatalogVersion = useMemo(
    () => projectsState.items.map((p) => p.id).join('|'),
    [projectsState.items],
  )

  useEffect(() => {
    if (userLoading) return
    if (!currentUser) {
      setProjectsState({ loading: false, items: [], error: null })
      return
    }
    let cancelled = false
    setProjectsState((s) => ({ ...s, loading: true, error: null }))
    void loadTimesheetProjectOptions(currentUser)
      .then(({ items, error }) => {
        if (cancelled) return
        setProjectsState({ loading: false, items, error })
      })
      .catch((e) => {
        if (cancelled) return
        setProjectsState({
          loading: false,
          items: [],
          error: e instanceof Error ? e.message : 'Не удалось загрузить проекты',
        })
      })
    return () => {
      cancelled = true
    }
  }, [currentUser, userLoading])

  useEffect(() => {
    const opts = projectsState.items
    if (opts.length === 0) {
      setTasksByClientId({})
      return
    }
    const clientIds = [...new Set(opts.map((p) => p.clientId))]
    let cancelled = false
    void Promise.all(
      clientIds.map(async (cid) => {
        try {
          const tasks = await listClientTasks(cid)
          return [cid, tasks.map((t) => t.name).filter(Boolean)] as const
        } catch {
          return [cid, []] as const
        }
      }),
    ).then((pairs) => {
      if (cancelled) return
      setTasksByClientId(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [projectsState.items])

  const bootLoading = userLoading || projectsState.loading || entriesLoading
  const [modal,     setModal]     = useState<{ open: boolean; date: string; edit?: TimeEntry }>({ open: false, date: formatDate(today) })
  const [activeDay, setActiveDay] = useState<Date>(today)
  const [runningTimer, setRunningTimer] = useState<RunningTimerState | null>(null)
  const runningTimerRef = useRef<RunningTimerState | null>(null)
  runningTimerRef.current = runningTimer
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const projectsCatalogRef = useRef(projectsState.items)
  projectsCatalogRef.current = projectsState.items
  /** Защита от повторного createTimeEntry по одному черновику (Strict Mode / двойной стоп). */
  const draftTimerCreateInFlightRef = useRef(new Set<string>())
  const [timerTick, bumpTimerTick] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!currentUser?.id || userLoading || projectsState.loading) return
    let cancelled = false
    setEntriesLoading(true)
    setEntriesError(null)
    const from = formatDate(weekStart)
    const to = formatDate(addDays(weekStart, 6))
    const user = currentUser
    const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]))
    void (async () => {
      try {
        /* upsert уже выполняется в loadTimesheetProjectOptions до списка проектов */
        const rows = await listTimeEntries(user.id, from, to)
        if (cancelled) return
        let mapped = rows.map((r) => mapTimeEntryRowToUi(r, byId))
        try {
          const raw = localStorage.getItem(timerStorageKey(user.id))
          const p = raw ? parseTimerPayload(raw) : null
          if (p && p.authUserId === user.id) {
            const st = Number(p.startedAt)
            if (Number.isFinite(st)) {
              setRunningTimer({ entryId: p.entryId, startedAt: st })
              if (!mapped.some((e) => e.id === p.entryId)) {
                mapped = [...mapped, p.snapshot]
              }
            } else {
              setRunningTimer(null)
            }
          } else {
            setRunningTimer(null)
          }
        } catch {
          setRunningTimer(null)
        }
        setEntries(uniqEntriesById(mapped))
      } catch (e) {
        if (!cancelled) {
          setEntriesError(e instanceof Error ? e.message : 'Не удалось загрузить записи времени')
          setEntries([])
          setRunningTimer(null)
        }
      } finally {
        if (!cancelled) setEntriesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, userLoading, projectsState.loading, weekStart, projectCatalogVersion])

  useEffect(() => {
    if (!runningTimer) return
    const t = setInterval(() => bumpTimerTick(), 1000)
    return () => clearInterval(t)
  }, [runningTimer])

  useEffect(() => {
    if (currentUser?.id) return
    setRunningTimer(null)
  }, [currentUser?.id])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const hoursPerDay = useMemo(() =>
    weekDays.map(d => entries.filter(e => e.date === formatDate(d)).reduce((s, e) => s + e.hours, 0)),
    [weekDays, entries]
  )
  const weekTotal = hoursPerDay.reduce((s, h) => s + h, 0)
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(today))

  function prevWeek() { setWeekStart(d => addDays(d, -7)) }
  function nextWeek() { setWeekStart(d => addDays(d, 7)) }
  function goToday()  { setWeekStart(startOfWeek(today)); setActiveDay(today) }

  function openAdd(date: string) { setModal({ open: true, date }) }
  function openEdit(entry: TimeEntry) { setModal({ open: true, date: entry.date, edit: entry }) }
  function closeModal() { setModal(m => ({ ...m, open: false, edit: undefined })) }

  async function persistTimerStopToApi(entryId: string, merged: TimeEntry) {
    if (!currentUser?.id) return
    const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]))
    try {
      await upsertTimeTrackingUser(currentUser)
      if (isDraftTimeEntryId(entryId)) {
        const inFlight = draftTimerCreateInFlightRef.current
        if (inFlight.has(entryId)) return
        inFlight.add(entryId)
        try {
          const row = await createTimeEntry(currentUser.id, {
            workDate: merged.date,
            hours: hoursToApiPayload(merged.hours),
            isBillable: merged.billable,
            projectId: merged.projectId ?? null,
            description: buildDescription(merged.task, merged.notes),
          })
          const next = mapTimeEntryRowToUi(row, byId)
          setEntries((prev) => {
            const stripped = prev.filter((x) => x.id !== entryId && x.id !== next.id)
            return uniqEntriesById([...stripped, next])
          })
        } finally {
          inFlight.delete(entryId)
        }
      } else {
        await patchTimeEntry(currentUser.id, entryId, {
          hours: hoursToApiPayload(merged.hours),
        })
        setEntries((prev) =>
          prev.map((x) => (x.id === entryId ? { ...x, hours: merged.hours } : x)),
        )
      }
    } catch (e) {
      setEntriesError(e instanceof Error ? e.message : 'Не удалось сохранить время с таймера')
    }
  }

  /** Остановить таймер: прибавить округлённые часы к строке, снять LS, при необходимости — API. */
  function flushStopTimer(prev: RunningTimerState) {
    const uid = currentUser?.id
    const elapsedMs = Date.now() - prev.startedAt
    const addH = elapsedMsToLoggedHours(elapsedMs)
    const prevId = prev.entryId
    const ent = entriesRef.current.find((x) => x.id === prevId)
    const merged = ent ? { ...ent, hours: ent.hours + addH } : null
    setEntries((ents) =>
      ents.map((row) => (row.id === prevId ? { ...row, hours: row.hours + addH } : row)),
    )
    if (uid) {
      try {
        localStorage.removeItem(timerStorageKey(uid))
      } catch {
        /* ignore */
      }
    }
    if (merged && addH > 0) void persistTimerStopToApi(prevId, merged)
  }

  async function saveEntry(e: TimeEntry) {
    if (!currentUser) throw new Error('Не удалось определить пользователя')
    setEntriesError(null)
    await upsertTimeTrackingUser(currentUser)
    const byId = new Map(projectsCatalogRef.current.map((p) => [p.id, p]))

    const hoursPositive = Number.isFinite(e.hours) && e.hours > 0
    if (!hoursPositive) {
      setEntries((prev) => {
        const without = prev.filter((x) => x.id !== e.id)
        return [...without, { ...e, hours: 0 }]
      })
      const uid = currentUser.id
      const prevRt = runningTimerRef.current
      if (prevRt?.entryId === e.id) {
        try {
          const payload: TimerPersistPayload = {
            v: 1,
            authUserId: uid,
            entryId: e.id,
            startedAt: prevRt.startedAt,
            snapshot: { ...e, hours: 0 },
          }
          localStorage.setItem(timerStorageKey(uid), JSON.stringify(payload))
        } catch {
          /* ignore */
        }
        return
      }
      if (prevRt) flushStopTimer(prevRt)
      const startedAt = Date.now()
      try {
        const payload: TimerPersistPayload = {
          v: 1,
          authUserId: uid,
          entryId: e.id,
          startedAt,
          snapshot: { ...e, hours: 0 },
        }
        localStorage.setItem(timerStorageKey(uid), JSON.stringify(payload))
      } catch {
        /* ignore */
      }
      setRunningTimer({ entryId: e.id, startedAt })
      return
    }

    const desc = buildDescription(e.task, e.notes)
    if (isDraftTimeEntryId(e.id)) {
      const row = await createTimeEntry(currentUser.id, {
        workDate: e.date,
        hours: hoursToApiPayload(e.hours),
        isBillable: e.billable,
        projectId: e.projectId ?? null,
        description: desc,
      })
      setEntries((prev) => [...prev.filter((x) => x.id !== e.id), mapTimeEntryRowToUi(row, byId)])
    } else {
      const row = await patchTimeEntry(currentUser.id, e.id, {
        workDate: e.date,
        hours: hoursToApiPayload(e.hours),
        isBillable: e.billable,
        projectId: e.projectId ?? null,
        description: desc,
      })
      setEntries((prev) => prev.map((x) => (x.id === e.id ? mapTimeEntryRowToUi(row, byId) : x)))
    }
  }

  async function deleteEntry(id: string) {
    setRunningTimer((rt) => {
      if (rt?.entryId === id && currentUser?.id) {
        try {
          localStorage.removeItem(timerStorageKey(currentUser.id))
        } catch {
          /* ignore */
        }
        return null
      }
      return rt
    })
    if (currentUser && !isDraftTimeEntryId(id)) {
      setEntriesError(null)
      try {
        await upsertTimeTrackingUser(currentUser)
        await deleteTimeEntry(currentUser.id, id)
      } catch (e) {
        setEntriesError(e instanceof Error ? e.message : 'Не удалось удалить запись')
        return
      }
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function toggleRun(id: string) {
    const uid = currentUser?.id
    const prev = runningTimerRef.current
    if (prev?.entryId === id) {
      flushStopTimer(prev)
      setRunningTimer(null)
      return
    }
    if (prev) {
      flushStopTimer(prev)
    }
    const startedAt = Date.now()
    const entry = entriesRef.current.find((e) => e.id === id)
    if (uid && entry) {
      try {
        const payload: TimerPersistPayload = {
          v: 1,
          authUserId: uid,
          entryId: id,
          startedAt,
          snapshot: entry,
        }
        localStorage.setItem(timerStorageKey(uid), JSON.stringify(payload))
      } catch {
        /* quota */
      }
    }
    setRunningTimer({ entryId: id, startedAt })
  }

  const displayDays = viewMode === 'week' ? weekDays : [activeDay]

  const dayGroups = useMemo(() =>
    displayDays
      .map(d => {
        const key = formatDate(d)
        const rows = entries.filter(e => e.date === key)
        return { date: d, key, rows }
      })
      .filter(g => g.rows.length > 0),
    [displayDays, entries]
  )

  const hasEntries = dayGroups.length > 0

  if (bootLoading) return <TimesheetSkeleton />

  const headDate = viewMode === 'day'
    ? fmtDateHeading(activeDay)
    : (isCurrentWeek
        ? `Эта неделя · ${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
        : `${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`)

  return (
    <div className="tsp">
      {entriesError && (
        <div className="tsp__sync-err" role="alert">
          {entriesError}
        </div>
      )}

      <div className="tsp__top">
        <div className="tsp__top-l">
          <button className="tsp__arr" onClick={prevWeek} aria-label="Назад">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button className="tsp__arr" onClick={nextWeek} aria-label="Вперёд">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>

          <h2 className="tsp__heading">{headDate}</h2>

          {!isCurrentWeek && (
            <button className="tsp__return" onClick={goToday}>Вернуться к сегодня</button>
          )}
        </div>

        <div className="tsp__top-r">
<div className="tsp__seg">
            <button className={`tsp__seg-btn${viewMode === 'day' ? ' tsp__seg-btn--on' : ''}`}
              onClick={() => setViewMode('day')}>День</button>
            <button className={`tsp__seg-btn${viewMode === 'week' ? ' tsp__seg-btn--on' : ''}`}
              onClick={() => setViewMode('week')}>Неделя</button>
          </div>
        </div>
      </div>
<div className="tsp__strip">
        {weekDays.map((d, i) => {
          const isToday  = isSameDay(d, today)
          const isActive = isSameDay(d, activeDay) && viewMode === 'day'
          const h = hoursPerDay[i]
          const isWknd = i >= 5
          const pct = Math.min(100, (h / 8) * 100)
          const isFuture = d > today && !isToday
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              className={[
                'tsp__day',
                isToday  ? 'tsp__day--today'  : '',
                isActive ? 'tsp__day--active' : '',
                isWknd   ? 'tsp__day--wknd'   : '',
                isFuture ? 'tsp__day--future' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { setActiveDay(d); setViewMode('day') }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveDay(d); setViewMode('day') } }}
              title={d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            >
              <span className="tsp__day-wk">{fmtShort(d)}</span>
              <span className="tsp__day-n">{d.getDate()}</span>

              <div className="tsp__day-bar-wrap">
                <div
                  className={`tsp__day-bar${h > 0 ? ' tsp__day-bar--on' : ''}${pct >= 100 ? ' tsp__day-bar--full' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <span className={`tsp__day-h${h > 0 ? ' tsp__day-h--on' : ''}`}>
                {h > 0 ? fmtHours(h) : <span className="tsp__day-h-zero">—</span>}
              </span>

              <button
                className="tsp__day-quick"
                onClick={e => { e.stopPropagation(); openAdd(formatDate(d)) }}
                aria-label={`Добавить время за ${fmtShort(d)}`}
                tabIndex={-1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          )
        })}

        <div className="tsp__wtotal">
          <span className="tsp__wtotal-lbl">Итого<br/>за неделю</span>
          <span className={`tsp__wtotal-n${weekTotal > 0 ? ' tsp__wtotal-n--on' : ''}`}>
            {fmtHours(weekTotal)}
          </span>
          <div className="tsp__wtotal-bar-wrap" title={`${Math.round((weekTotal/40)*100)}% от 40 часов`}>
            <div
              className="tsp__wtotal-bar"
              style={{ width: `${Math.min(100, (weekTotal / 40) * 100)}%` }}
            />
          </div>
          <span className="tsp__wtotal-cap">из 40:00</span>
        </div>
      </div>
<div className="tsp__content">
        {!hasEntries ? (
          <div className="tsp__empty">
            <div className="tsp__empty-ico-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 7v5l3.5 2"/>
              </svg>
            </div>
            <p className="tsp__empty-h">Нет записей за этот день</p>
            <p className="tsp__empty-s">Добавьте первую запись, чтобы начать отслеживать время</p>
            <button className="tsp__empty-cta" onClick={() => openAdd(formatDate(activeDay))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Добавить время
            </button>
          </div>
        ) : (
          <div className="tsp__groups">
            {dayGroups.map(g => {
              const dayTotal = g.rows.reduce((s, e) => s + e.hours, 0)
              const isToday = isSameDay(g.date, today)
              return (
                <div key={g.key} className="tsp__group">
{viewMode === 'week' && (
                    <div className={`tsp__ghd${isToday ? ' tsp__ghd--today' : ''}`}>
                      <span className="tsp__ghd-name">
                        {g.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
                          .replace(/^\w/, c => c.toUpperCase())}
                        {isToday && <span className="tsp__ghd-badge">Сегодня</span>}
                      </span>
                      <span className="tsp__ghd-total">{fmtHours(dayTotal)}</span>
                      <button className="tsp__ghd-add" onClick={() => openAdd(g.key)} aria-label="Добавить">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </button>
                    </div>
                  )}
<div className="tsp__rows">
                    {g.rows.map(e => {
                      const isRun = runningTimer?.entryId === e.id
                      const runningExtraMs =
                        isRun && runningTimer ? Date.now() - runningTimer.startedAt : 0
                      void timerTick
                      const timeLabel = isRun
                        ? formatClockFromMs(e.hours * 3_600_000 + runningExtraMs)
                        : fmtHours(e.hours)
                      return (
                        <div key={e.id} className={`tsp__row${isRun ? ' tsp__row--run' : ''}`}>
<span className="tsp__row-bar" style={{ background: e.color }} />
<div className="tsp__row-txt">
                            <p className="tsp__row-proj">
                              <strong>{e.project}</strong>
                              <span className="tsp__row-client">({e.client})</span>
                              {!e.billable && <span className="tsp__row-nb">Non-billable</span>}
                            </p>
                            <p className="tsp__row-task">{e.task}</p>
                            {e.notes && <p className="tsp__row-notes">{e.notes}</p>}
                          </div>
<div className="tsp__row-acts">
                            <span className="tsp__row-h">{timeLabel}</span>
                            <button
                              className={`tsp__row-start${isRun ? ' tsp__row-start--stop' : ''}`}
                              onClick={() => toggleRun(e.id)}
                            >
                              {isRun
                                ? <><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>Стоп</>
                                : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/></svg>Старт</>
                              }
                            </button>
                            <button className="tsp__row-edit" onClick={() => openEdit(e)}>Изменить</button>
                            <button className="tsp__row-del" onClick={() => void deleteEntry(e.id)} aria-label="Удалить">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
<div className="tsp__day-sum">
                      <button className="tsp__day-sum-add" onClick={() => openAdd(g.key)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Добавить время
                      </button>
                      <span className="tsp__day-sum-r">
                        <span>Итого:</span>
                        <span className="tsp__day-sum-n">{fmtHours(dayTotal)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
<div className="tsp__foot">
        <div className="tsp__foot-total">
          <span className="tsp__foot-total-lbl">Итого за неделю:</span>
          <span className="tsp__foot-total-n">{fmtHours(weekTotal)}</span>
        </div>
        <div className="tsp__submit-wrap">
          <button className="tsp__submit">Отправить на утверждение</button>
          <button className="tsp__submit-arr" aria-label="Опции">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>

      {modal.open && (
        <EntryModal
          key={`${modal.date}_${modal.edit?.id ?? 'new'}`}
          entry={modal.edit}
          defaultDate={modal.date}
          projects={projectsState.items}
          projectsLoading={projectsState.loading}
          projectsLoadError={projectsState.error}
          tasksByClientId={tasksByClientId}
          onClose={closeModal}
          onSave={saveEntry}
        />
      )}
    </div>
  )
}
