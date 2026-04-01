import { useState, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getUser,
  type User,
} from '@entities/user'
import './UserEditPage.css'

type TabId = 'basic' | 'rates' | 'projects'

type RateType = 'billable' | 'cost'
type Rate = {
  id: string
  type: RateType
  amount: number
  currency: string
  startDate: string | null
  endDate: string | null
}

function ratesKey(userId: number) { return `uep_rates_${userId}` }
function loadRates(userId: number): Rate[] {
  try { return JSON.parse(localStorage.getItem(ratesKey(userId)) ?? '[]') } catch { return [] }
}
function saveRates(userId: number, rates: Rate[]) {
  localStorage.setItem(ratesKey(userId), JSON.stringify(rates))
}

type Project = { id: string; name: string; client: string; color: string }
const MOCK_PROJECTS: Project[] = [
  { id: 'p1',  name: 'ACWA Power',                       client: 'ACWA Power',           color: '#4f46e5' },
  { id: 'p2',  name: 'ACWA Power Sirdarya',               client: 'ACWA Power Sirdarya',  color: '#7c3aed' },
  { id: 'p3',  name: 'AGRI SOLAR SPV',                    client: 'AGRI SOLAR SPV',       color: '#0891b2' },
  { id: 'p4',  name: 'AKA Bank',                          client: 'AKA Bank',             color: '#b45309' },
  { id: 'p5',  name: 'ALLIED GREEN AMMONIA',              client: 'ALLIED GREEN AMMONIA', color: '#dc2626' },
  { id: 'p6',  name: 'Agritek Agricultural',              client: 'Agritek Agricultural', color: '#9333ea' },
  { id: 'p7',  name: 'General Legal Services',            client: 'Kosta Legal',          color: '#16a34a' },
  { id: 'p8',  name: 'Independent opinion',               client: 'UzQSB',                color: '#0f766e' },
  { id: 'p9',  name: 'Onshore Account Pledge/Amendment',  client: 'Agritek Agricultural', color: '#64748b' },
  { id: 'p10', name: 'Restructuring',                     client: 'AKA Bank',             color: '#0891b2' },
  { id: 'p11', name: 'LLC Establishment',                 client: 'ALLIED GREEN AMMONIA', color: '#f59e0b' },
  { id: 'p12', name: 'UzQSB Advisory',                    client: 'UzQSB',                color: '#06b6d4' },
]

type AssignedProject = { id: string; manages: boolean }

function assignKey(userId: number) { return `uep_projects_${userId}` }
function loadAssigned(userId: number): AssignedProject[] {
  try { return JSON.parse(localStorage.getItem(assignKey(userId)) ?? '[]') } catch { return [] }
}
function saveAssigned(userId: number, list: AssignedProject[]) {
  localStorage.setItem(assignKey(userId), JSON.stringify(list))
}

const CAPACITY_DEFAULT = 35
const CAPACITY_OPTIONS = [20, 25, 30, 35, 40, 45, 50]

function capacityKey(userId: number) { return `uep_capacity_${userId}` }
function loadCapacity(userId: number): number {
  const v = localStorage.getItem(capacityKey(userId))
  const n = v ? parseInt(v, 10) : NaN
  return isNaN(n) ? CAPACITY_DEFAULT : n
}
function saveCapacity(userId: number, hours: number) {
  localStorage.setItem(capacityKey(userId), String(hours))
}

function getInitials(name: string | null | undefined, email?: string): string {
  const src = name ?? email ?? ''
  const parts = src.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.charAt(0).toUpperCase() || '?'
}

function splitName(displayName: string | null): { first: string; last: string } {
  if (!displayName) return { first: '', last: '' }
  const parts = displayName.trim().split(/\s+/)
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type RateFormProps = {
  rate?: Rate
  type: RateType
  onSave: (r: Omit<Rate, 'id'>) => void
  onClose: () => void
}
function RateFormModal({ rate, type, onSave, onClose }: RateFormProps) {
  const [amount, setAmount]         = useState(rate ? String(rate.amount) : '')
  const [currency, setCurrency]     = useState(rate?.currency ?? 'USD')
  const [startDate, setStartDate]   = useState(rate?.startDate ?? '')
  const [endDate, setEndDate]       = useState(rate?.endDate ?? '')
  const [error, setError]           = useState<string | null>(null)
  const uid = useId()

  const handleSubmit = () => {
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) { setError('Введите корректную сумму'); return }
    onSave({ type, amount: amt, currency, startDate: startDate || null, endDate: endDate || null })
  }

  return (
    <div className="uep__modal-overlay" onClick={onClose}>
      <div className="uep__modal" onClick={(e) => e.stopPropagation()}>
        <div className="uep__modal-head">
          <h3 className="uep__modal-title">
            {rate ? 'Редактировать ставку' : `Новая ${type === 'billable' ? 'оплачиваемая' : 'себестоимость'} ставка`}
          </h3>
          <button type="button" className="uep__modal-close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="uep__modal-body">
          <div className="uep__field">
            <label className="uep__label" htmlFor={`${uid}-amount`}>Ставка в час</label>
            <div className="uep__rate-amount-row">
              <input
                id={`${uid}-amount`}
                type="number"
                min="0"
                step="0.01"
                className="uep__input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select className="uep__select uep__select--currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option>USD</option>
                <option>UZS</option>
                <option>EUR</option>
                <option>RUB</option>
              </select>
            </div>
            {error && <p className="uep__field-error">{error}</p>}
          </div>
          <div className="uep__field-row">
            <div className="uep__field">
              <label className="uep__label" htmlFor={`${uid}-start`}>Дата начала</label>
              <input id={`${uid}-start`} type="date" className="uep__input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <p className="uep__hint">Пусто — «с начала времён»</p>
            </div>
            <div className="uep__field">
              <label className="uep__label" htmlFor={`${uid}-end`}>Дата окончания</label>
              <input id={`${uid}-end`} type="date" className="uep__input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <p className="uep__hint">Пусто — «без ограничений»</p>
            </div>
          </div>
        </div>
        <div className="uep__modal-foot">
          <button type="button" className="uep__btn uep__btn--primary" onClick={handleSubmit}>
            {rate ? 'Сохранить' : 'Добавить'}
          </button>
          <button type="button" className="uep__btn uep__btn--ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

export function UserEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [user, setUser]           = useState<User | null>(null)
  const [loading, setLoading]     = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('basic')

  const [rates, setRates]         = useState<Rate[]>([])
  const [rateModal, setRateModal] = useState<{ type: RateType; rate?: Rate } | null>(null)

  const [assigned, setAssigned]           = useState<AssignedProject[]>([])
  const [projectSearch, setProjectSearch] = useState('')
  const [searchOpen, setSearchOpen]       = useState(false)
  const searchBoxRef                      = useRef<HTMLDivElement>(null)

  const [capacity,     setCapacity]     = useState<number>(CAPACITY_DEFAULT)
  const [capCustom,    setCapCustom]    = useState(false)
  const [capCustomVal, setCapCustomVal] = useState('')
  const [capSaved,     setCapSaved]     = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setFetchError(null)
    getUser(Number(id))
      .then((u) => {
        setUser(u)
        setRates(loadRates(u.id))
        setAssigned(loadAssigned(u.id))
        const cap = loadCapacity(u.id)
        setCapacity(cap)
        setCapCustom(!CAPACITY_OPTIONS.includes(cap))
        setCapCustomVal(!CAPACITY_OPTIONS.includes(cap) ? String(cap) : '')
      })
      .catch((e: unknown) => setFetchError((e as Error).message ?? 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [id])

  function handleCapacityChange(val: string) {
    if (val === '__custom__') {
      setCapCustom(true)
      setCapCustomVal('')
    } else {
      setCapCustom(false)
      const n = parseInt(val, 10)
      setCapacity(n)
      if (user) saveCapacity(user.id, n)
      setCapSaved(true)
      setTimeout(() => setCapSaved(false), 2000)
    }
  }

  function handleCapCustomSave() {
    const n = parseInt(capCustomVal, 10)
    if (isNaN(n) || n <= 0 || n > 168) return
    setCapacity(n)
    if (user) saveCapacity(user.id, n)
    setCapSaved(true)
    setTimeout(() => setCapSaved(false), 2000)
  }

  const handleSaveRate = (data: Omit<Rate, 'id'>) => {
    if (!user) return
    let next: Rate[]
    if (rateModal?.rate) {
      next = rates.map((r) => r.id === rateModal.rate!.id ? { ...r, ...data } : r)
    } else {
      next = [...rates, { ...data, id: `r_${Date.now()}` }]
    }
    setRates(next)
    saveRates(user.id, next)
    setRateModal(null)
  }

  const handleDeleteRate = (rateId: string) => {
    if (!user) return
    const next = rates.filter((r) => r.id !== rateId)
    setRates(next)
    saveRates(user.id, next)
  }

  const assignProject = (projId: string) => {
    if (!user || assigned.find((a) => a.id === projId)) return
    const next = [...assigned, { id: projId, manages: false }]
    setAssigned(next)
    saveAssigned(user.id, next)
    setProjectSearch('')
  }

  const removeProject = (projId: string) => {
    if (!user) return
    const next = assigned.filter((a) => a.id !== projId)
    setAssigned(next)
    saveAssigned(user.id, next)
  }

  const toggleManages = (projId: string, manages: boolean) => {
    if (!user) return
    const next = assigned.map((a) => a.id === projId ? { ...a, manages } : a)
    setAssigned(next)
    saveAssigned(user.id, next)
  }

  const setAllManages = (manages: boolean) => {
    if (!user) return
    const next = assigned.map((a) => ({ ...a, manages }))
    setAssigned(next)
    saveAssigned(user.id, next)
  }

  if (loading) {
    return (
      <div className="uep">
        <header className="uep__topbar">
          <span className="uep__skel uep__skel--back" />
          <div className="uep__topbar-center">
            <span className="uep__skel uep__skel--name" />
          </div>
        </header>
        <div className="uep__layout">
          <aside className="uep__sidebar">
            <div className="uep__user-card">
              <div className="uep__user-card-banner" />
              <div className="uep__user-card-body">
                <div className="uep__avatar-wrap">
                  <div className="uep__skel uep__skel--avatar" />
                </div>
                <div className="uep__user-info">
                  <span className="uep__skel uep__skel--line" />
                  <span className="uep__skel uep__skel--line uep__skel--short" />
                  <span className="uep__skel uep__skel--line uep__skel--md" />
                </div>
              </div>
            </div>
            <nav className="uep__nav">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="uep__nav-item">
                  <span className="uep__skel uep__skel--nav" />
                </div>
              ))}
            </nav>
          </aside>
          <main className="uep__main">
            <div className="uep__section">
              <div className="uep__section-head">
                <span className="uep__skel uep__skel--icon" />
                <div>
                  <span className="uep__skel uep__skel--title" />
                  <span className="uep__skel uep__skel--desc" />
                </div>
              </div>
              <div className="uep__form">
                <span className="uep__skel uep__skel--field" />
                <span className="uep__skel uep__skel--field" />
                <span className="uep__skel uep__skel--field uep__skel--wide" />
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (fetchError || !user) {
    return (
      <div className="uep">
        <div className="uep__fetch-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>{fetchError ?? 'Пользователь не найден'}</p>
          <button type="button" className="uep__back-btn" onClick={() => navigate(-1)}>← Назад</button>
        </div>
      </div>
    )
  }

  const { first, last } = splitName(user.display_name)
  const initials = getInitials(user.display_name, user.email)
  const statusKey = user.is_archived ? 'archived' : user.is_blocked ? 'blocked' : 'active'
  const statusLabel = user.is_archived ? 'В архиве' : user.is_blocked ? 'Заблокирован' : 'Активен'

  const billableRates = rates.filter((r) => r.type === 'billable')
  const costRates     = rates.filter((r) => r.type === 'cost')

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'basic', label: 'Основная информация',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    },
    {
      id: 'rates', label: 'Ставки',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
    {
      id: 'projects', label: 'Проекты',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><path d="M8 7V5a2 2 0 0 0-4 0v2"/></svg>,
    },
  ]

  return (
    <div className="uep">
<header className="uep__topbar">
        <button type="button" className="uep__back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Назад
        </button>
        <div className="uep__topbar-center">
          <span className="uep__topbar-name">{user.display_name ?? user.email}</span>
          {user.position && <span className="uep__topbar-pos">{user.position}</span>}
        </div>
        <div className="uep__topbar-actions">
          <span className={`uep__topbar-badge uep__topbar-badge--${statusKey}`}>{statusLabel}</span>
        </div>
      </header>

      <div className="uep__layout">
<aside className="uep__sidebar">
          <div className="uep__user-card">
            <div className="uep__user-card-banner" />
            <div className="uep__user-card-body">
              <div className="uep__avatar-wrap">
                {user.picture
                  ? <img src={user.picture} alt="" className="uep__avatar-img" />
                  : <span className="uep__avatar-initials">{initials}</span>}
                <span className={`uep__status-dot uep__status-dot--${statusKey}`} title={statusLabel} />
              </div>
              <div className="uep__user-info">
                <span className="uep__user-name">{user.display_name ?? user.email}</span>
                {user.position && <span className="uep__user-position">{user.position}</span>}
                <span className="uep__user-email">{user.email}</span>
              </div>
            </div>
          </div>

          <nav className="uep__nav" aria-label="Разделы профиля">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`uep__nav-item${activeTab === t.id ? ' uep__nav-item--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <span className="uep__nav-icon">{t.icon}</span>
                <span className="uep__nav-label">{t.label}</span>
                {activeTab === t.id && <span className="uep__nav-indicator" />}
              </button>
            ))}
          </nav>

          <div className="uep__sidebar-meta">
            <p className="uep__meta-heading">Информация</p>
            <div className="uep__meta-row">
              <span className="uep__meta-label">ID пользователя</span>
              <span className="uep__meta-value uep__meta-value--mono">#{user.id}</span>
            </div>
            <div className="uep__meta-row">
              <span className="uep__meta-label">Создан</span>
              <span className="uep__meta-value">{new Date(user.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
            {user.updated_at && (
              <div className="uep__meta-row">
                <span className="uep__meta-label">Обновлён</span>
                <span className="uep__meta-value">{new Date(user.updated_at).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
            <div className="uep__meta-row">
              <span className="uep__meta-label">Проектов</span>
              <span className="uep__meta-value">{assigned.length}</span>
            </div>
          </div>
        </aside>
<main className="uep__main">
{activeTab === 'basic' && (
            <div className="uep__section">
              <div className="uep__section-head">
                <div className="uep__section-head-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div className="uep__section-head-text">
                  <h1 className="uep__section-title">{first ? `${first}'s basic info` : 'Основная информация'}</h1>
                  <p className="uep__section-desc">Данные аккаунта синхронизируются из Microsoft Azure AD.</p>
                </div>
              </div>
              <div className="uep__form">
                <div className="uep__field-row">
                  <div className="uep__field">
                    <label className="uep__label">Имя</label>
                    <input type="text" className="uep__input uep__input--readonly" value={first} readOnly />
                  </div>
                  <div className="uep__field">
                    <label className="uep__label">Фамилия</label>
                    <input type="text" className="uep__input uep__input--readonly" value={last} readOnly />
                  </div>
                </div>
                <div className="uep__field">
                  <label className="uep__label">Рабочий email</label>
                  <input type="email" className="uep__input uep__input--readonly" value={user.email} readOnly />
                  <p className="uep__hint">Email привязан к корпоративному аккаунту Microsoft и не может быть изменён здесь.</p>
                </div>
<div className="uep__cap-block">
                  <div className="uep__cap-label-wrap">
                    <span className="uep__cap-label">Нагрузка</span>
                  </div>
                  <div className="uep__cap-control">
                    <div className="uep__cap-select-wrap">
                      <select
                        className="uep__cap-select"
                        value={capCustom ? '__custom__' : String(capacity)}
                        onChange={e => handleCapacityChange(e.target.value)}
                      >
                        {CAPACITY_OPTIONS.map(h => (
                          <option key={h} value={String(h)}>
                            {h}{h === CAPACITY_DEFAULT ? ' (по умолчанию)' : ''}
                          </option>
                        ))}
                        <option value="__custom__">Своё значение…</option>
                      </select>
                      <svg className="uep__cap-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>

                    {capCustom && (
                      <div className="uep__cap-custom-wrap">
                        <input
                          type="number"
                          min="1" max="168"
                          className="uep__cap-custom-inp"
                          placeholder="напр. 32"
                          value={capCustomVal}
                          onChange={e => setCapCustomVal(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleCapCustomSave()}
                        />
                        <button type="button" className="uep__cap-save-btn" onClick={handleCapCustomSave}>
                          Сохранить
                        </button>
                      </div>
                    )}

                    <span className="uep__cap-unit">часов в неделю</span>

                    {capSaved && (
                      <span className="uep__cap-saved">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Сохранено
                      </span>
                    )}
                  </div>
                  <p className="uep__cap-hint">Количество часов в неделю, которые сотрудник доступен для работы.</p>
                </div>

              </div>
            </div>
          )}
{activeTab === 'rates' && (
            <div className="uep__section">
              <div className="uep__section-head">
                <div className="uep__section-head-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <div className="uep__section-head-text">
                  <h1 className="uep__section-title">{first ? `${first}'s default rates` : 'Ставки'}</h1>
                  <p className="uep__section-desc">Почасовые ставки применяются к проектам, где используется ставка по умолчанию.</p>
                </div>
              </div>
              <div className="uep__form">
<div className="uep__rates-block">
                  <div className="uep__rates-header">
                    <div>
                      <h2 className="uep__rates-title">Оплачиваемые ставки</h2>
                      <p className="uep__rates-desc">
                        Ставка, по которой клиент оплачивает время этого сотрудника.
                        Только администраторы и менеджеры видят суммы.
                      </p>
                    </div>
                    <button type="button" className="uep__btn uep__btn--add" onClick={() => setRateModal({ type: 'billable' })}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Новая ставка
                    </button>
                  </div>
                  {billableRates.length > 0 ? (
                    <div className="uep__rates-table-wrap">
                      <table className="uep__rates-table">
                        <thead>
                          <tr>
                            <th>Ставка в час</th>
                            <th>Начало</th>
                            <th>Окончание</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {billableRates.map((r) => (
                            <tr key={r.id}>
                              <td className="uep__rate-amount">{r.amount.toFixed(2)} <span className="uep__rate-currency">{r.currency}</span></td>
                              <td className="uep__rate-date">{r.startDate ? fmtDate(r.startDate) : <span className="uep__rate-all">С начала</span>}</td>
                              <td className="uep__rate-date">{r.endDate   ? fmtDate(r.endDate)   : <span className="uep__rate-all">Без конца</span>}</td>
                              <td className="uep__rate-actions">
                                <button type="button" className="uep__rate-btn" onClick={() => setRateModal({ type: 'billable', rate: r })}>Изменить</button>
                                <button type="button" className="uep__rate-btn uep__rate-btn--del" onClick={() => handleDeleteRate(r.id)}>Удалить</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="uep__rates-empty">Нет оплачиваемых ставок</div>
                  )}
                </div>

                <div className="uep__divider" />
<div className="uep__rates-block">
                  <div className="uep__rates-header">
                    <div>
                      <h2 className="uep__rates-title">Ставки себестоимости</h2>
                      <p className="uep__rates-desc">
                        Внутренние затраты на этого сотрудника. Применяются ко всем проектам.
                        Видны только администраторам.
                      </p>
                    </div>
                    <button type="button" className="uep__btn uep__btn--add" onClick={() => setRateModal({ type: 'cost' })}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Новая ставка
                    </button>
                  </div>
                  {costRates.length > 0 ? (
                    <div className="uep__rates-table-wrap">
                      <table className="uep__rates-table">
                        <thead>
                          <tr>
                            <th>Ставка в час</th>
                            <th>Начало</th>
                            <th>Окончание</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {costRates.map((r) => (
                            <tr key={r.id}>
                              <td className="uep__rate-amount">{r.amount.toFixed(2)} <span className="uep__rate-currency">{r.currency}</span></td>
                              <td className="uep__rate-date">{r.startDate ? fmtDate(r.startDate) : <span className="uep__rate-all">С начала</span>}</td>
                              <td className="uep__rate-date">{r.endDate   ? fmtDate(r.endDate)   : <span className="uep__rate-all">Без конца</span>}</td>
                              <td className="uep__rate-actions">
                                <button type="button" className="uep__rate-btn" onClick={() => setRateModal({ type: 'cost', rate: r })}>Изменить</button>
                                <button type="button" className="uep__rate-btn uep__rate-btn--del" onClick={() => handleDeleteRate(r.id)}>Удалить</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="uep__rates-empty">Нет ставок себестоимости</div>
                  )}
                </div>

              </div>
            </div>
          )}
{activeTab === 'projects' && (() => {
            const unassigned = MOCK_PROJECTS.filter((p) => !assigned.find((a) => a.id === p.id))
            const q = projectSearch.trim().toLowerCase()
            const searchResults = q
              ? unassigned.filter((p) =>
                  p.name.toLowerCase().includes(q) ||
                  p.client.toLowerCase().includes(q)
                )
              : unassigned

            return (
              <div className="uep__proj-page">
<div className="uep__proj-header">
                  <div className="uep__proj-header-text">
                    <h1 className="uep__proj-heading">
                      {first ? `${first}'s assigned projects` : 'Назначенные проекты'}
                    </h1>
                    <p className="uep__proj-subheading">
                      {first ? first : 'Сотрудник'} может отслеживать время только по назначенным проектам.
                    </p>
                  </div>
                  {assigned.length > 0 && (
                    <button type="button" className="uep__proj-clear-btn"
                      onClick={() => { if (user) { setAssigned([]); saveAssigned(user.id, []) } }}>
                      Убрать из всех
                    </button>
                  )}
                </div>
<div className="uep__proj-search-wrap" ref={searchBoxRef}>
                  <div className="uep__proj-search-field">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="Найти проект или клиента..."
                      value={projectSearch}
                      onChange={(e) => { setProjectSearch(e.target.value); setSearchOpen(true) }}
                      onFocus={() => setSearchOpen(true)}
                      onBlur={() => setTimeout(() => setSearchOpen(false), 160)}
                    />
                    {projectSearch && (
                      <button type="button" onMouseDown={(e) => { e.preventDefault(); setProjectSearch(''); setSearchOpen(false) }} aria-label="Очистить">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
{searchOpen && projectSearch.trim() && createPortal(
                    (() => {
                      const rect = searchBoxRef.current?.getBoundingClientRect()
                      if (!rect) return null
                      return (
                        <div className="uep__proj-drop" style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}>
                          {searchResults.length === 0
                            ? <p className="uep__proj-drop-empty">Проекты не найдены</p>
                            : searchResults.map((p) => (
                              <button key={p.id} type="button" className="uep__proj-drop-item"
                                onMouseDown={() => { assignProject(p.id); setSearchOpen(false) }}>
                                <span className="uep__proj-color-dot" style={{ background: p.color }} />
                                <span className="uep__proj-drop-info">
                                  <span className="uep__proj-drop-name">{p.name}</span>
                                  <span className="uep__proj-drop-client">{p.client}</span>
                                </span>
                                <svg className="uep__proj-drop-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                              </button>
                            ))
                          }
                        </div>
                      )
                    })(),
                    document.body
                  )}
                </div>
{assigned.length === 0 ? (
                  <div className="uep__proj-empty">
                    <div className="uep__proj-empty-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2"/>
                        <path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/>
                      </svg>
                    </div>
                    <p className="uep__proj-empty-title">Проекты не назначены</p>
                    <p className="uep__proj-empty-hint">Найдите проект выше и добавьте сотрудника</p>
                  </div>
                ) : (
                  <div className="uep__proj-list">
                    <div className="uep__proj-list-head">
                      <span>Проект</span>
                      <span className="uep__proj-manages-head">
                        Руководит проектом
                        <span className="uep__proj-manages-btns">
                          <button type="button" onClick={() => setAllManages(true)}>Все</button>
                          <span>/</span>
                          <button type="button" onClick={() => setAllManages(false)}>Нет</button>
                        </span>
                      </span>
                    </div>
                    {assigned.map((a) => {
                      const p = MOCK_PROJECTS.find((x) => x.id === a.id)
                      if (!p) return null
                      return (
                        <div key={a.id} className="uep__proj-item">
                          <button type="button" className="uep__proj-item-remove"
                            onClick={() => removeProject(a.id)} title={`Убрать из ${p.name}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                          <span className="uep__proj-color-dot" style={{ background: p.color }} />
                          <span className="uep__proj-item-info">
                            <span className="uep__proj-item-name">{p.name}</span>
                            <span className="uep__proj-item-client">{p.client}</span>
                          </span>
                          <label className="uep__proj-manages-toggle" title="Руководит проектом">
                            <input type="checkbox" checked={a.manages} onChange={(e) => toggleManages(a.id, e.target.checked)} />
                            <span className="uep__proj-toggle-track">
                              <span className="uep__proj-toggle-thumb" />
                            </span>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

        </main>
      </div>
{rateModal && (
        <RateFormModal
          type={rateModal.type}
          rate={rateModal.rate}
          onSave={handleSaveRate}
          onClose={() => setRateModal(null)}
        />
      )}
    </div>
  )
}
