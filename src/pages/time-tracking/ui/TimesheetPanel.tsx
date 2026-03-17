import { useState, useMemo, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { TimesheetSkeleton } from './TimesheetSkeleton'

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
  if (h === 0) return '0:00'
  const wh = Math.floor(h)
  const wm = Math.round((h - wh) * 60)
  return `${wh}:${String(wm).padStart(2, '0')}`
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
  task: string
  notes: string
  hours: number
  billable: boolean
  color: string
  running?: boolean
}

const FORM_PROJECTS: { id: string; name: string; client: string; color: string }[] = []
const FORM_TASKS: string[] = []

type EntryForm = { projectId: string; task: string; date: string; hours: string; notes: string; billable: boolean }

function EntryModal({ entry, defaultDate, onClose, onSave }: {
  entry?: TimeEntry
  defaultDate: string
  onClose: () => void
  onSave: (e: TimeEntry) => void
}) {
  const uid = useId()
  const initProj = entry
    ? (FORM_PROJECTS.find(p => p.name === entry.project) ?? FORM_PROJECTS[0])
    : FORM_PROJECTS[0]

  const [form, setForm] = useState<EntryForm>({
    projectId: initProj?.id ?? '',
    task:      entry?.task     ?? (FORM_TASKS[0] ?? ''),
    date:      entry?.date     ?? defaultDate,
    hours:     entry ? fmtHours(entry.hours) : '',
    notes:     entry?.notes    ?? '',
    billable:  entry?.billable ?? true,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  const proj = FORM_PROJECTS.find(p => p.id === form.projectId) ?? FORM_PROJECTS[0]

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

  function handleSave() {
    if (!proj) { setError('Нет доступных проектов'); return }
    const h = parseHours(form.hours)
    if (form.hours && (isNaN(h) || h < 0)) { setError('Некорректный формат (например: 1:30, 1 30 или 1.5)'); return }
    onSave({
      id:       entry?.id ?? `te_${Date.now()}`,
      date:     form.date,
      project:  proj.name,
      client:   proj.client,
      task:     form.task,
      notes:    form.notes,
      hours:    form.hours ? h : 0,
      billable: form.billable,
      color:    proj.color,
    })
    onClose()
  }

  if (!proj) {
    return createPortal(
      <div className="tsp-ov" onClick={onClose}>
        <div className="tsp-m" onClick={e => e.stopPropagation()}>
          <div className="tsp-m__head">
            <h3 className="tsp-m__title">Добавить время</h3>
            <button className="tsp-m__x" onClick={onClose} aria-label="Закрыть">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="tsp-m__body">
            <p className="tsp-m__err">Нет доступных проектов. Добавьте проекты в разделе Проекты.</p>
          </div>
          <div className="tsp-m__foot">
            <button className="tsp-m__btn tsp-m__btn--cancel" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>,
      document.body
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
          <div className="tsp-m__f">
            <label className="tsp-m__lbl" htmlFor={`${uid}-p`}>Проект</label>
            <select id={`${uid}-p`} className="tsp-m__sel" value={form.projectId}
              onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
              {FORM_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name} · {p.client}</option>)}
            </select>
          </div>
          <div className="tsp-m__f">
            <label className="tsp-m__lbl" htmlFor={`${uid}-t`}>Задача</label>
            <select id={`${uid}-t`} className="tsp-m__sel" value={form.task}
              onChange={e => setForm(f => ({ ...f, task: e.target.value }))}>
              {FORM_TASKS.map(t => <option key={t}>{t}</option>)}
            </select>
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
          <button className="tsp-m__btn tsp-m__btn--ok" onClick={handleSave}>
            {entry ? 'Сохранить' : 'Добавить'}
          </button>
          <button className="tsp-m__btn tsp-m__btn--cancel" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function TimesheetPanel() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const [loading,   setLoading]   = useState(true)
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [viewMode,  setViewMode]  = useState<'day' | 'week'>('day')
  const [entries,   setEntries]   = useState<TimeEntry[]>([])

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])
  const [modal,     setModal]     = useState<{ open: boolean; date: string; edit?: TimeEntry }>({ open: false, date: formatDate(today) })
  const [activeDay, setActiveDay] = useState<Date>(today)
  const [running,   setRunning]   = useState<string | null>(null)

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

  function saveEntry(e: TimeEntry) {
    setEntries(prev => {
      const idx = prev.findIndex(x => x.id === e.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = e; return next }
      return [...prev, e]
    })
  }
  function deleteEntry(id: string) { setEntries(prev => prev.filter(e => e.id !== id)) }
  function toggleRun(id: string) { setRunning(r => r === id ? null : id) }

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

  if (loading) return <TimesheetSkeleton />

  const headDate = viewMode === 'day'
    ? fmtDateHeading(activeDay)
    : (isCurrentWeek
        ? `Эта неделя · ${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
        : `${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`)

  return (
    <div className="tsp">

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
                      const isRun = running === e.id
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
                            <span className="tsp__row-h">{fmtHours(e.hours)}</span>
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
                            <button className="tsp__row-del" onClick={() => deleteEntry(e.id)} aria-label="Удалить">
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
          onClose={closeModal}
          onSave={saveEntry}
        />
      )}
    </div>
  )
}
