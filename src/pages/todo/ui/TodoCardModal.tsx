import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import {
  IconCheck,
  IconChevronDown,
  IconClose,
  IconComment,
  IconMore,
  IconPaperclip,
  IconPlus,
  IconTag,
  IconCalendar,
  IconChecklist,
  IconUsers,
} from './TodoIcons'
import type { TodoCard, TodoLabel, TodoCheckItem } from '../services/todoUtils'
import { LABEL_COLORS } from '../services/todoUtils'

type TodoCardModalProps = {
  card: TodoCard
  columnTitle: string
  onClose: () => void
  onCardUpdate: (patch: Partial<TodoCard>) => void
  onArchive?: () => void
}

type PanelType = 'labels' | 'dates' | 'checklist' | 'members' | null

export const TodoCardModal = memo(function TodoCardModal({
  card,
  columnTitle,
  onClose,
  onCardUpdate,
  onArchive,
}: TodoCardModalProps) {
  const titleId = useId()
  const [descFocused, setDescFocused] = useState(false)
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(card.title)
  const [commentText, setCommentText] = useState('')
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLTextAreaElement>(null)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  const togglePanel = useCallback((p: PanelType) => {
    setActivePanel((prev) => (prev === p ? null : p))
  }, [])

  const commitTitle = useCallback(() => {
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== card.title) onCardUpdate({ title: trimmed })
    else setTitleValue(card.title)
    setTitleEditing(false)
  }, [titleValue, card.title, onCardUpdate])

  useEffect(() => {
    if (titleEditing && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [titleEditing])

  useLayoutEffect(() => {
    if (!activePanel || !toolbarRef.current) return
    const rect = toolbarRef.current.getBoundingClientRect()
    const page = toolbarRef.current.closest('.todo-page') as HTMLElement | null
    const vars: Record<string, string> = {}
    if (page) {
      const cs = getComputedStyle(page)
      const names = ['--todo-accent', '--todo-text', '--todo-muted', '--todo-surface', '--todo-surface2', '--todo-panel-bg', '--todo-border', '--todo-shadow']
      names.forEach((n) => { vars[n] = cs.getPropertyValue(n).trim() })
    }

    const applyPosition = () => {
      let top = rect.bottom + 6
      const left = rect.left
      const pad = 10
      const panelEl = panelRef.current
      if (panelEl) {
        const h = panelEl.getBoundingClientRect().height
        const vh = window.innerHeight
        const maxTop = Math.max(pad, vh - h - pad)
        if (top > maxTop) top = maxTop
      }
      setPanelStyle({ top, left, ...vars } as React.CSSProperties)
    }

    applyPosition()
    const id = requestAnimationFrame(applyPosition)
    return () => cancelAnimationFrame(id)
  }, [activePanel])

  useEffect(() => {
    if (!activePanel) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePanel(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [activePanel])

  return (
    <div className="tcm-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="tcm" onClick={(e) => e.stopPropagation()}>

        <header className="tcm__header">
          <div className="tcm__header-left">
            <button type="button" className="tcm__list-btn" aria-haspopup="listbox">
              <span>{columnTitle}</span>
              <IconChevronDown />
            </button>
          </div>
          <div className="tcm__header-actions">
            <button type="button" className="tcm__icon-btn" aria-label="Вложения"><IconPaperclip /></button>
            <button type="button" className="tcm__icon-btn" aria-label="Ещё"><IconMore /></button>
            <div className="tcm__header-divider" />
            <button type="button" className="tcm__icon-btn tcm__icon-btn--close" aria-label="Закрыть" onClick={onClose}><IconClose /></button>
          </div>
        </header>

        <div className="tcm__body">
          <div className="tcm__main">

            <div className="tcm__title-row">
              <button
                type="button"
                className={`tcm__check${card.completed ? ' tcm__check--done' : ''}`}
                onClick={() => onCardUpdate({ completed: !card.completed })}
                aria-pressed={card.completed}
                aria-label={card.completed ? 'Снять отметку' : 'Отметить выполнено'}
              >
                {card.completed && <IconCheck />}
              </button>
              {titleEditing ? (
                <textarea
                  ref={titleInputRef}
                  id={titleId}
                  className="tcm__title-input"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTitle() }
                    if (e.key === 'Escape') { setTitleValue(card.title); setTitleEditing(false) }
                  }}
                  rows={2}
                />
              ) : (
                <h2
                  id={titleId}
                  className={`tcm__title${card.completed ? ' tcm__title--done' : ''}`}
                  onClick={() => setTitleEditing(true)}
                  title="Нажмите для редактирования"
                >
                  {card.title}
                </h2>
              )}
            </div>

            {((card.labels?.length ?? 0) > 0 || card.dueDate || card.startDate || (card.members?.length ?? 0) > 0) && (
              <div className="tcm__meta-row">
                {(card.labels?.length ?? 0) > 0 && card.labels!.map((l) => (
                  <span key={l.id} className="tcm__label-badge" style={{ background: l.color }}>{l.text}</span>
                ))}
                {(card.dueDate || card.startDate) && (
                  <span className="tcm__date-chip tcm__date-chip--group">
                    <IconCalendar />
                    {card.startDate && (
                      <span>
                        {new Date(card.startDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                    {card.startDate && card.dueDate && <span className="tcm__date-sep">→</span>}
                    {card.dueDate && (
                      <span className="tcm__date-chip--due-inner">
                        {new Date(card.dueDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </span>
                )}
                {(card.members?.length ?? 0) > 0 && card.members!.map((m) => (
                  <span key={m} className="tcm__member-chip">
                    <span className="tcm__member-chip-avatar">{m[0]?.toUpperCase()}</span>
                    {m}
                  </span>
                ))}
              </div>
            )}

            <div className="tcm__toolbar" ref={toolbarRef}>
              <button type="button" className={`tcm__tool-btn${activePanel === 'labels' ? ' tcm__tool-btn--active' : ''}`} onClick={() => togglePanel('labels')}>
                <IconTag /><span>Метки</span>
              </button>
              <button type="button" className={`tcm__tool-btn${activePanel === 'dates' ? ' tcm__tool-btn--active' : ''}`} onClick={() => togglePanel('dates')}>
                <IconCalendar /><span>Даты</span>
              </button>
              <button type="button" className={`tcm__tool-btn${activePanel === 'checklist' ? ' tcm__tool-btn--active' : ''}`} onClick={() => togglePanel('checklist')}>
                <IconChecklist /><span>Чек-лист</span>
              </button>
              <button type="button" className={`tcm__tool-btn${activePanel === 'members' ? ' tcm__tool-btn--active' : ''}`} onClick={() => togglePanel('members')}>
                <IconUsers /><span>Участники</span>
              </button>
            </div>

            {activePanel && createPortal(
              <div
                ref={panelRef}
                className={`tcm__panel${activePanel === 'dates' ? ' tcm__panel--dates' : ''}`}
                style={panelStyle}
                onClick={(e) => e.stopPropagation()}
              >
                {activePanel === 'labels' && <LabelsPanel card={card} onCardUpdate={onCardUpdate} />}
                {activePanel === 'dates' && <DatesPanel card={card} onCardUpdate={onCardUpdate} />}
                {activePanel === 'checklist' && <ChecklistPanel card={card} onCardUpdate={onCardUpdate} />}
                {activePanel === 'members' && <MembersPanel card={card} onCardUpdate={onCardUpdate} />}
              </div>,
              document.body,
            )}

            {(card.checklist?.length ?? 0) > 0 && (
              <ChecklistSection checklist={card.checklist!} onCardUpdate={onCardUpdate} />
            )}

            <section className="tcm__section">
              <h3 className="tcm__section-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/></svg>
                Описание
              </h3>
              <div className={`tcm__desc-wrap${descFocused ? ' tcm__desc-wrap--focus' : ''}`}>
                <textarea
                  className="tcm__desc"
                  placeholder="Добавить более подробное описание..."
                  value={card.description ?? ''}
                  onChange={(e) => onCardUpdate({ description: e.target.value })}
                  onFocus={() => setDescFocused(true)}
                  onBlur={() => setDescFocused(false)}
                  rows={4}
                />
              </div>
            </section>
          </div>

          <aside className="tcm__aside">
            <div className="tcm__aside-section">
              <h3 className="tcm__aside-heading">
                <IconComment />
                Активность
              </h3>

              <div className="tcm__comment-compose">
                <div className="tcm__comment-avatar tcm__comment-avatar--me">Я</div>
                <div className="tcm__comment-compose-wrap">
                  <textarea
                    className="tcm__comment-input"
                    placeholder="Написать комментарий…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setCommentText('') }
                    }}
                    aria-label="Комментарий"
                  />
                  {commentText.trim() && (
                    <button
                      type="button"
                      className="tcm__comment-send"
                      onClick={() => setCommentText('')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="tcm__activity-feed">
                <div className="tcm__activity-item">
                  <div className="tcm__activity-avatar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>
                  </div>
                  <div className="tcm__activity-body">
                    <p className="tcm__activity-text">Карточка добавлена в список <strong>«{columnTitle}»</strong></p>
                    <span className="tcm__activity-time">только что</span>
                  </div>
                </div>
              </div>
            </div>

            {onArchive && (
              <div className="tcm__aside-footer">
                <button type="button" className="tcm__archive-btn" onClick={onArchive}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>
                  Архивировать
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
})

function LabelsPanel({ card, onCardUpdate }: { card: TodoCard; onCardUpdate: (p: Partial<TodoCard>) => void }) {
  const [text, setText] = useState('')
  const [color, setColor] = useState<(typeof LABEL_COLORS)[number]>(LABEL_COLORS[5])

  const addLabel = () => {
    if (!text.trim()) return
    const label: TodoLabel = { id: Date.now().toString(), text: text.trim(), color }
    onCardUpdate({ labels: [...(card.labels ?? []), label] })
    setText('')
  }

  const removeLabel = (id: string) => {
    onCardUpdate({ labels: (card.labels ?? []).filter((l) => l.id !== id) })
  }

  return (
    <div className="tcm__panel-inner">
      <h4 className="tcm__panel-title">Метки</h4>
      {(card.labels?.length ?? 0) > 0 && (
        <div className="tcm__panel-labels">
          {card.labels!.map((l) => (
            <span key={l.id} className="tcm__panel-label" style={{ background: l.color }}>
              {l.text}
              <button type="button" onClick={() => removeLabel(l.id)} aria-label="Удалить метку">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="tcm__panel-colors">
        {LABEL_COLORS.map((c) => (
          <button key={c} type="button" className={`tcm__panel-color${c === color ? ' tcm__panel-color--active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
        ))}
      </div>
      <div className="tcm__panel-row">
        <input className="tcm__panel-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст метки..." onKeyDown={(e) => e.key === 'Enter' && addLabel()} />
        <button type="button" className="tcm__panel-add" onClick={addLabel}><IconPlus /></button>
      </div>
    </div>
  )
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function pad2(n: number) { return n.toString().padStart(2, '0') }

function dateToStr(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }

function buildCalendar(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

function DatesPanel({ card, onCardUpdate }: { card: TodoCard; onCardUpdate: (p: Partial<TodoCard>) => void }) {
  type Field = 'start' | 'due'
  const [activeField, setActiveField] = useState<Field>('start')
  const [startDate, setStartDate] = useState(card.startDate ?? '')
  const [dueDate, setDueDate] = useState(card.dueDate ?? '')
  const todayStr = dateToStr(new Date())

  const selectedStr = activeField === 'start' ? startDate : dueDate
  const parsed = selectedStr ? new Date(selectedStr) : new Date()
  const [viewYear, setViewYear] = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())

  const cells = buildCalendar(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0) }
    else setViewMonth((m) => m + 1)
  }

  const pickDate = (d: Date) => {
    const str = dateToStr(d)
    if (activeField === 'start') setStartDate(str)
    else setDueDate(str)
  }

  const apply = () => {
    onCardUpdate({
      startDate: startDate || undefined,
      startTime: undefined,
      dueDate: dueDate || undefined,
      dueTime: undefined,
    })
  }

  const clear = () => {
    onCardUpdate({ startDate: undefined, startTime: undefined, dueDate: undefined, dueTime: undefined })
    setStartDate('')
    setDueDate('')
  }

  const formatDisplay = (date: string) => {
    if (!date) return '—'
    const d = new Date(date)
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`
  }

  return (
    <div className="tcm__panel-inner tcm__panel-inner--dates">
      <h4 className="tcm__panel-title">Даты</h4>

      <div className="tcm__dp-tabs">
        <button type="button" className={`tcm__dp-tab${activeField === 'start' ? ' tcm__dp-tab--active' : ''}`} onClick={() => { setActiveField('start'); if (startDate) { const d = new Date(startDate); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) } }}>
          Начало
        </button>
        <button type="button" className={`tcm__dp-tab${activeField === 'due' ? ' tcm__dp-tab--active' : ''}`} onClick={() => { setActiveField('due'); if (dueDate) { const d = new Date(dueDate); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) } }}>
          Срок
        </button>
      </div>

      <div className="tcm__dp-cal">
        <div className="tcm__dp-nav">
          <button type="button" className="tcm__dp-nav-btn" onClick={prevMonth} aria-label="Предыдущий месяц">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="tcm__dp-month">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button type="button" className="tcm__dp-nav-btn" onClick={nextMonth} aria-label="Следующий месяц">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div className="tcm__dp-weekdays">
          {WEEKDAYS.map((w) => <span key={w} className="tcm__dp-wd">{w}</span>)}
        </div>
        <div className="tcm__dp-grid">
          {cells.map((cell, i) => {
            if (!cell) return <span key={`e${i}`} className="tcm__dp-cell tcm__dp-cell--empty" />
            const str = dateToStr(cell)
            const isSelected = str === selectedStr
            const isToday = str === todayStr
            return (
              <button
                key={str}
                type="button"
                className={[
                  'tcm__dp-cell',
                  isSelected && 'tcm__dp-cell--selected',
                  isToday && !isSelected && 'tcm__dp-cell--today',
                ].filter(Boolean).join(' ')}
                onClick={() => pickDate(cell)}
              >
                {cell.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      <div className="tcm__dp-fields">
        <div className="tcm__dp-field-group">
          <span className="tcm__dp-field-label">Начало</span>
          <div className="tcm__dp-field-row tcm__dp-field-row--date-only">
            <span className="tcm__dp-field-val">{formatDisplay(startDate)}</span>
          </div>
        </div>
        <div className="tcm__dp-field-group">
          <span className="tcm__dp-field-label">Срок</span>
          <div className="tcm__dp-field-row tcm__dp-field-row--date-only">
            <span className="tcm__dp-field-val">{formatDisplay(dueDate)}</span>
          </div>
        </div>
      </div>

      <div className="tcm__panel-actions">
        <button type="button" className="tcm__panel-btn tcm__panel-btn--primary" onClick={apply}>Сохранить</button>
        <button type="button" className="tcm__panel-btn" onClick={clear}>Очистить</button>
      </div>
    </div>
  )
}


function ChecklistPanel({ card, onCardUpdate }: { card: TodoCard; onCardUpdate: (p: Partial<TodoCard>) => void }) {
  const [text, setText] = useState('')

  const addItem = () => {
    if (!text.trim()) return
    const item: TodoCheckItem = { id: Date.now().toString(), text: text.trim(), done: false }
    onCardUpdate({ checklist: [...(card.checklist ?? []), item] })
    setText('')
  }

  return (
    <div className="tcm__panel-inner">
      <h4 className="tcm__panel-title">Добавить пункт</h4>
      <div className="tcm__panel-row">
        <input className="tcm__panel-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Новый пункт..." onKeyDown={(e) => e.key === 'Enter' && addItem()} />
        <button type="button" className="tcm__panel-add" onClick={addItem}><IconPlus /></button>
      </div>
    </div>
  )
}


function ChecklistSection({ checklist, onCardUpdate }: { checklist: TodoCheckItem[]; onCardUpdate: (p: Partial<TodoCard>) => void }) {
  const done = checklist.filter((i) => i.done).length
  const pct = checklist.length > 0 ? Math.round((done / checklist.length) * 100) : 0

  const toggle = (id: string) => {
    onCardUpdate({ checklist: checklist.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) })
  }

  const remove = (id: string) => {
    onCardUpdate({ checklist: checklist.filter((i) => i.id !== id) })
  }

  return (
    <section className="tcm__section">
      <h3 className="tcm__section-label">
        <IconChecklist />
        Чек-лист
        <span className="tcm__checklist-pct">{pct}%</span>
      </h3>
      <div className="tcm__checklist-bar">
        <div className="tcm__checklist-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="tcm__checklist-items">
        {checklist.map((item) => (
          <div key={item.id} className={`tcm__checklist-item${item.done ? ' tcm__checklist-item--done' : ''}`}>
            <button type="button" className={`tcm__checklist-check${item.done ? ' tcm__checklist-check--done' : ''}`} onClick={() => toggle(item.id)}>
              {item.done && <IconCheck />}
            </button>
            <span className="tcm__checklist-text">{item.text}</span>
            <button type="button" className="tcm__checklist-del" onClick={() => remove(item.id)} aria-label="Удалить">
              <IconClose />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function MembersPanel({ card, onCardUpdate }: { card: TodoCard; onCardUpdate: (p: Partial<TodoCard>) => void }) {
  const [name, setName] = useState('')

  const addMember = () => {
    if (!name.trim()) return
    if (card.members?.includes(name.trim())) return
    onCardUpdate({ members: [...(card.members ?? []), name.trim()] })
    setName('')
  }

  const removeMember = (m: string) => {
    onCardUpdate({ members: (card.members ?? []).filter((x) => x !== m) })
  }

  return (
    <div className="tcm__panel-inner">
      <h4 className="tcm__panel-title">Участники</h4>
      {(card.members?.length ?? 0) > 0 && (
        <div className="tcm__panel-members">
          {card.members!.map((m) => (
            <span key={m} className="tcm__panel-member">
              <span className="tcm__panel-member-avatar">{m[0].toUpperCase()}</span>
              {m}
              <button type="button" onClick={() => removeMember(m)} aria-label="Удалить">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="tcm__panel-row">
        <input className="tcm__panel-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя участника..." onKeyDown={(e) => e.key === 'Enter' && addMember()} />
        <button type="button" className="tcm__panel-add" onClick={addMember}><IconPlus /></button>
      </div>
    </div>
  )
}
