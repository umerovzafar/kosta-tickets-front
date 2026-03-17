import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MOCK_EXPENSES, EXPENSE_STATUS_META, EXPENSE_CATEGORY_META } from '../model/constants'
import type { ExpenseStatus, ExpenseRow } from '../model/types'
import { ExpensesSkeleton } from './ExpensesSkeleton'

const TEAMMATE_OPTIONS = ['Все сотрудники', 'Только мои расходы']

const EXPENSE_CATEGORIES = [
  'Транспорт', 'Питание', 'Командировка',
  'Офис', 'ПО и сервисы', 'Представительские', 'Прочее',
]

const todayStr = new Date().toISOString().slice(0, 10)

function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function fmtWeekRange(mondayStr: string): string {
  const start = new Date(mondayStr + 'T00:00:00')
  const end   = new Date(mondayStr + 'T00:00:00')
  end.setDate(end.getDate() + 6)
  const s = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  const e = end.toLocaleDateString('ru-RU',   { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

function fmtRowDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    weekday:  d.toLocaleDateString('ru-RU', { weekday: 'short' }),
    dayMonth: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
  }
}

function fmtAmt(n: number, cur = 'UZS') {
  return `${n.toLocaleString('ru-RU')} ${cur}`
}

function weekStatus(statuses: ExpenseStatus[]): ExpenseStatus {
  if (statuses.some(s => s === 'pending'))  return 'pending'
  if (statuses.some(s => s === 'rejected')) return 'rejected'
  return 'approved'
}

const IcoPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IcoChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>
)
const IcoCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IcoPaperclip = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
)
const IcoLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

export function ExpensesPanel() {
  const [loading, setLoading] = useState(true)
  const [teammate, setTeammate] = useState(TEAMMATE_OPTIONS[0])
  const [tmOpen,   setTmOpen]   = useState(false)
  const tmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const [showForm,    setShowForm]    = useState(false)
  const [formDate,    setFormDate]    = useState(todayStr)
  const [formProject, setFormProject] = useState('')
  const [formCat,     setFormCat]     = useState('')
  const [formNotes,   setFormNotes]   = useState('')
  const [formAmount,  setFormAmount]  = useState('')
  const [formBillable,setFormBillable]= useState(true)
  const [formFile,    setFormFile]    = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [detailExp, setDetailExp] = useState<ExpenseRow | null>(null)

  useEffect(() => {
    if (!tmOpen) return
    const h = (e: MouseEvent) => {
      if (tmRef.current && !tmRef.current.contains(e.target as Node)) setTmOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [tmOpen])

  useEffect(() => {
    if (!showForm) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelForm() }
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  }, [showForm])

  useEffect(() => {
    if (!detailExp) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailExp(null) }
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  }, [detailExp])

  function openForm() {
    setFormDate(todayStr)
    setFormProject('')
    setFormCat('')
    setFormNotes('')
    setFormAmount('')
    setFormBillable(true)
    setFormFile(null)
    setShowForm(true)
  }

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleWeek(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function cancelForm() { setShowForm(false) }

  function saveForm(e: React.FormEvent) {
    e.preventDefault()
    setShowForm(false)
  }

  const grouped = useMemo(() => {
    const map = new Map<string, typeof MOCK_EXPENSES>()
    for (const exp of MOCK_EXPENSES) {
      const key = getWeekMonday(exp.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(exp)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([weekKey, exps]) => ({
        weekKey,
        label:    fmtWeekRange(weekKey),
        exps:     exps.sort((a, b) => b.date.localeCompare(a.date)),
        total:    exps.reduce((s, e) => s + e.amount, 0),
        status:   weekStatus(exps.map(e => e.status)),
        currency: exps[0]?.currency ?? 'UZS',
      }))
  }, [])

  const isEmpty = MOCK_EXPENSES.length === 0

  if (loading) return <ExpensesSkeleton />

  return (
    <div className="exp">

      <div className="exp__topbar">
        <div className="exp__topbar-left">
          <h1 className="exp__title">Расходы</h1>
          <button type="button" className="exp__track-btn" onClick={openForm}>
            <IcoPlus /> Добавить расход
          </button>
        </div>
        <div ref={tmRef} className="exp__tm-wrap">
          <button type="button" className="exp__tm-btn" onClick={() => setTmOpen(v => !v)} aria-expanded={tmOpen}>
            {teammate} <IcoChevron />
          </button>
          {tmOpen && (
            <div className="exp__tm-menu">
              {TEAMMATE_OPTIONS.map(opt => (
                <button key={opt} type="button"
                  className={`exp__tm-item${opt === teammate ? ' exp__tm-item--on' : ''}`}
                  onClick={() => { setTeammate(opt); setTmOpen(false) }}>
                  {opt === teammate && <IcoCheck />}
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && createPortal(
        <div className="exp__modal-overlay" onClick={cancelForm}>
        <form className="exp__form" onSubmit={saveForm} onClick={e => e.stopPropagation()}>
          <div className="exp__form-header">
            <h2 className="exp__form-title">Новый расход</h2>
            <button type="button" className="exp__form-close" onClick={cancelForm} aria-label="Закрыть">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="exp__form-top">
            <div className="exp__form-col exp__form-col--date">
              <label className="exp__form-label">Дата</label>
              <input
                type="date"
                className="exp__form-input"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
              />
            </div>

            <div className="exp__form-col exp__form-col--middle">
              <label className="exp__form-label">Проект / Категория</label>
              <div className="exp__form-select-wrap">
                <select
                  className="exp__form-select"
                  value={formProject}
                  onChange={e => setFormProject(e.target.value)}
                >
                  <option value="">Выберите проект...</option>
                </select>
                <span className="exp__form-select-icon"><IcoChevron /></span>
              </div>
              <div className="exp__form-select-wrap">
                <select
                  className="exp__form-select"
                  value={formCat}
                  onChange={e => setFormCat(e.target.value)}
                >
                  <option value="">Выберите категорию...</option>
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="exp__form-select-icon"><IcoChevron /></span>
              </div>
              <textarea
                className="exp__form-textarea"
                placeholder="Заметки (опционально)"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="exp__form-col exp__form-col--amount">
              <label className="exp__form-label">Сумма</label>
              <div className="exp__form-amount-wrap">
                <span className="exp__form-amount-cur">UZS</span>
                <input
                  type="number"
                  className="exp__form-amount-input"
                  placeholder="0"
                  min="0"
                  step="1"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="exp__form-attach">
            <label className="exp__form-label">Прикрепить чек</label>
            <div className="exp__form-file-row">
              <button type="button" className="exp__form-file-btn" onClick={() => fileRef.current?.click()}>
                Выберите файл
              </button>
              <span className="exp__form-file-name">
                {formFile ? formFile.name : 'Файл не выбран'}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="exp__form-file-hidden"
              onChange={e => setFormFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <label className="exp__form-billable">
            <span className={`exp__form-checkbox${formBillable ? ' exp__form-checkbox--on' : ''}`}
              onClick={() => setFormBillable(v => !v)}
              role="checkbox"
              aria-checked={formBillable}
              tabIndex={0}
              onKeyDown={e => e.key === ' ' && setFormBillable(v => !v)}
            >
              {formBillable && <IcoCheck />}
            </span>
            <input type="checkbox" checked={formBillable} onChange={e => setFormBillable(e.target.checked)} tabIndex={-1} />
            Этот расход выставляется клиенту (Billable)
          </label>

          <div className="exp__form-actions">
            <button type="submit" className="exp__form-save">Сохранить расход</button>
            <button type="button" className="exp__form-cancel" onClick={cancelForm}>Отмена</button>
          </div>
        </form>
        </div>,
        document.body
      )}

      {isEmpty && (
        <div className="exp__empty">
          <div className="exp__empty-inner">
            <svg width="220" height="185" viewBox="0 0 220 185" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="72" y="18" width="76" height="110" rx="5" fill="#1f2937"/>
              <rect x="82" y="32" width="44" height="6" rx="3" fill="#4b5563"/>
              <rect x="82" y="46" width="56" height="5" rx="2.5" fill="#374151"/>
              <rect x="82" y="57" width="42" height="5" rx="2.5" fill="#374151"/>
              <rect x="82" y="68" width="50" height="5" rx="2.5" fill="#374151"/>
              <rect x="82" y="79" width="36" height="5" rx="2.5" fill="#374151"/>
              <rect x="82" y="90" width="48" height="5" rx="2.5" fill="#374151"/>
              <rect x="82" y="104" width="32" height="6" rx="3" fill="#6b7280"/>
              <g transform="rotate(-38 155 100)">
                <rect x="148" y="62" width="14" height="72" rx="3" fill="#111827"/>
                <rect x="148" y="62" width="14" height="10" rx="3" fill="#9ca3af"/>
                <polygon points="148,134 162,134 155,148" fill="#6b7280"/>
              </g>
            </svg>
            <p className="exp__empty-text">
              Записывайте расходы на авиабилеты, питание, командировки и другие нужды,<br />
              чтобы точнее планировать бюджет проектов и выставлять счета клиентам.
            </p>
          </div>
        </div>
      )}

      {!isEmpty && grouped.map(group => {
        const statusMeta = EXPENSE_STATUS_META[group.status]
        const isCollapsed = collapsed.has(group.weekKey)
        return (
          <div key={group.weekKey} className={`exp__week${isCollapsed ? ' exp__week--collapsed' : ''}`}>

            <div
              className="exp__week-head"
              onClick={() => toggleWeek(group.weekKey)}
              role="button"
              tabIndex={0}
              aria-expanded={!isCollapsed}
              onKeyDown={e => e.key === 'Enter' || e.key === ' ' ? toggleWeek(group.weekKey) : undefined}
            >
              <div className="exp__week-head-left">
                <span className={`exp__week-chevron${isCollapsed ? '' : ' exp__week-chevron--open'}`}>
                  <IcoChevron />
                </span>
                <span className="exp__week-range">{group.label}</span>
                <span
                  className={`exp__week-badge exp__week-badge--${group.status}`}
                  style={{ color: statusMeta.color, background: statusMeta.bg }}
                >
                  {statusMeta.label}
                </span>
              </div>
              <div className="exp__week-head-right" onClick={e => e.stopPropagation()}>
                {isCollapsed && (
                  <span className="exp__week-head-total">{fmtAmt(group.total, group.currency)}</span>
                )}
                {group.status === 'approved' && (
                  <button type="button" className="exp__week-withdraw">
                    Отозвать одобрение
                  </button>
                )}
              </div>
            </div>

            {!isCollapsed && group.exps.map(exp => {
              const { weekday, dayMonth } = fmtRowDate(exp.date)
              return (
                <div
                  key={exp.id}
                  className="exp__item"
                  onClick={() => setDetailExp(exp)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setDetailExp(exp)}
                >
                  <span className="exp__item-date">
                    <span className="exp__item-weekday">{weekday},</span>
                    <span className="exp__item-day">{dayMonth}</span>
                  </span>

                  <div className="exp__item-info">
                    <div className="exp__item-line1">
                      <span className="exp__item-proj">{exp.project ?? '—'}</span>
                      {exp.client && (
                        <span className="exp__item-client">({exp.client})</span>
                      )}
                    </div>
                    <div className="exp__item-line2">
                      <span className="exp__item-cat">{exp.category}</span>
                      {exp.billable && (
                        <span className="exp__item-billable-badge">Billable</span>
                      )}
                    </div>
                    {exp.description && (
                      <div className="exp__item-notes">{exp.description}</div>
                    )}
                  </div>

                  <div className="exp__item-right" onClick={e => e.stopPropagation()}>
                    <span className="exp__item-amount">{fmtAmt(exp.amount, exp.currency)}</span>
                    <button type="button" className="exp__item-icon" title="Вложение" aria-label="Вложение">
                      <IcoPaperclip />
                    </button>
                    <button type="button" className="exp__item-icon" title="Заблокировано" aria-label="Заблокировано">
                      <IcoLock />
                    </button>
                  </div>
                </div>
              )
            })}

            {!isCollapsed && (
              <div className="exp__week-total">
                <span className="exp__week-total-label">Итого:</span>
                <span className="exp__week-total-val">{fmtAmt(group.total, group.currency)}</span>
              </div>
            )}
          </div>
        )
      })}

      {detailExp && createPortal(
        <div className="exp__detail-overlay" onClick={() => setDetailExp(null)}>
          <div className="exp__detail" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">

            <div className="exp__detail-head">
              <div className="exp__detail-head-left">
                <div
                  className="exp__detail-cat-icon"
                  style={{
                    color: EXPENSE_CATEGORY_META[detailExp.category]?.color ?? '#6b7280',
                    background: EXPENSE_CATEGORY_META[detailExp.category]?.bg ?? 'rgba(107,114,128,0.08)',
                  }}
                >
                  <IcoPaperclip />
                </div>
                <div>
                  <h2 className="exp__detail-title">{detailExp.project ?? 'Без проекта'}</h2>
                  {detailExp.client && <p className="exp__detail-client">{detailExp.client}</p>}
                </div>
              </div>
              <button type="button" className="exp__detail-close" onClick={() => setDetailExp(null)} aria-label="Закрыть">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="exp__detail-amount-hero">
              <span className="exp__detail-amount">{fmtAmt(detailExp.amount, detailExp.currency)}</span>
              <span
                className="exp__detail-status"
                style={{
                  color: EXPENSE_STATUS_META[detailExp.status].color,
                  background: EXPENSE_STATUS_META[detailExp.status].bg,
                }}
              >
                {EXPENSE_STATUS_META[detailExp.status].label}
              </span>
            </div>

            <div className="exp__detail-body">
              <div className="exp__detail-row">
                <span className="exp__detail-label">Дата</span>
                <span className="exp__detail-val">
                  {new Date(detailExp.date + 'T00:00:00').toLocaleDateString('ru-RU', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
              <div className="exp__detail-row">
                <span className="exp__detail-label">Категория</span>
                <span className="exp__detail-val">
                  <span
                    className="exp__detail-cat-tag"
                    style={{
                      color: EXPENSE_CATEGORY_META[detailExp.category]?.color,
                      background: EXPENSE_CATEGORY_META[detailExp.category]?.bg,
                    }}
                  >
                    {detailExp.category}
                  </span>
                </span>
              </div>
              <div className="exp__detail-row">
                <span className="exp__detail-label">Сотрудник</span>
                <span className="exp__detail-val">
                  <span className="exp__detail-employee">
                    <span className="exp__detail-avatar">{detailExp.initials}</span>
                    {detailExp.employee}
                  </span>
                </span>
              </div>
              {detailExp.description && (
                <div className="exp__detail-row">
                  <span className="exp__detail-label">Описание</span>
                  <span className="exp__detail-val">{detailExp.description}</span>
                </div>
              )}
              <div className="exp__detail-row">
                <span className="exp__detail-label">Выставляется клиенту</span>
                <span className="exp__detail-val">
                  <span className={`exp__detail-billable${detailExp.billable ? ' exp__detail-billable--yes' : ''}`}>
                    {detailExp.billable ? '✓ Да (Billable)' : '— Нет'}
                  </span>
                </span>
              </div>
            </div>

            <div className="exp__detail-foot">
              <button type="button" className="exp__detail-close-btn" onClick={() => setDetailExp(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
