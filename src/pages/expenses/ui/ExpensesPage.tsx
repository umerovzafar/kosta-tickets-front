import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import { useMediaQuery } from '@shared/hooks'
import { getSidebarCollapsed, setSidebarCollapsed } from '@shared/lib/sidebarCollapsed'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { ExpensesFormPanel, type PanelMode } from './ExpensesFormPanel'
import { ExpensesReportModal } from './ExpensesReportModal'
import type { ExpenseRequest, ExpenseFormValues, ExpenseStatus, ExpenseType } from '../model/types'
import { STATUS_META, TYPE_META, REIMBURSABLE_META } from '../model/constants'
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  submitExpense,
  uploadAttachment,
} from '../model/expensesApi'
import './ExpensesPage.css'

type FilterPeriod = 'all' | 'today' | 'week' | 'month'
type ActiveFilter = 'status' | 'type' | 'reimbursable' | 'period' | null

const TODAY = new Date().toISOString().slice(0, 10)

function getWeekStart() {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function getMonthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function fmtUzs(n: number) {
  return n.toLocaleString('ru-RU')
}

function formValuesToApiBody(values: ExpenseFormValues) {
  return {
    description: values.description,
    expenseDate: values.expenseDate,
    amountUzs: parseFloat(values.amountUzs) || 0,
    exchangeRate: parseFloat(values.exchangeRate) || 0,
    expenseType: values.expenseType,
    expenseSubtype: values.expenseSubtype || undefined,
    isReimbursable: values.isReimbursable ?? false,
    paymentMethod: values.paymentMethod || undefined,
    projectId: values.projectId || undefined,
    vendor: values.vendor || undefined,
    businessPurpose: values.businessPurpose || undefined,
    comment: values.comment || undefined,
  }
}

// ——— Sub-components ———

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const meta = STATUS_META[status]
  return <span className={`exp-status exp-status--${status}`}>{meta?.label ?? status}</span>
}

function TableHead() {
  return (
    <div className="exp-table__head" role="rowgroup" aria-label="Заголовки столбцов">
      <div className="exp-table__row exp-table__row--head" role="row">
        <div className="exp-table__th exp-table__th--num" role="columnheader">№</div>
        <div className="exp-table__th exp-table__th--desc" role="columnheader">Описание</div>
        <div className="exp-table__th exp-table__th--date" role="columnheader">Дата</div>
        <div className="exp-table__th exp-table__th--type" role="columnheader">Тип</div>
        <div className="exp-table__th exp-table__th--reimb" role="columnheader">Возмещение</div>
        <div className="exp-table__th exp-table__th--uzs" role="columnheader">Сумма, UZS</div>
        <div className="exp-table__th exp-table__th--usd" role="columnheader">Эквивалент</div>
        <div className="exp-table__th exp-table__th--status" role="columnheader">Статус</div>
        <div className="exp-table__th exp-table__th--action" role="columnheader"/>
      </div>
    </div>
  )
}

function TableRow({ req, onOpen }: { req: ExpenseRequest; onOpen: (r: ExpenseRequest) => void }) {
  const typeLabel = TYPE_META[req.expenseType as ExpenseType]?.label ?? req.expenseType
  const reimbLabel = req.isReimbursable
    ? REIMBURSABLE_META['reimbursable'].label
    : REIMBURSABLE_META['non_reimbursable'].label
  const reimbKey = req.isReimbursable ? 'reimbursable' : 'non_reimbursable'

  return (
    <div className="exp-table__row" role="row" onClick={() => onOpen(req)}>
      <div className="exp-table__td exp-table__td--num" role="cell">
        <span className="exp-table__num">{req.id}</span>
      </div>
      <div className="exp-table__td exp-table__td--desc" role="cell">
        <span className="exp-table__desc">{req.description}</span>
      </div>
      <div className="exp-table__td exp-table__td--date" role="cell">{fmtDate(req.expenseDate)}</div>
      <div className="exp-table__td exp-table__td--type" role="cell">{typeLabel}</div>
      <div className="exp-table__td exp-table__td--reimb" role="cell">
        <span className={`exp-reimb exp-reimb--${reimbKey}`}>{reimbLabel}</span>
      </div>
      <div className="exp-table__td exp-table__td--uzs" role="cell">{fmtUzs(req.amountUzs)}</div>
      <div className="exp-table__td exp-table__td--usd" role="cell">
        {req.equivalentAmount > 0 ? `${req.equivalentAmount.toFixed(2)} USD` : '—'}
      </div>
      <div className="exp-table__td exp-table__td--status" role="cell">
        <StatusBadge status={req.status} />
      </div>
      <div className="exp-table__td exp-table__td--action" role="cell">
        <button type="button" className="exp-table__open-btn" onClick={e => { e.stopPropagation(); onOpen(req) }}>
          Открыть
        </button>
      </div>
    </div>
  )
}

function ExpenseCard({ req, onOpen }: { req: ExpenseRequest; onOpen: (r: ExpenseRequest) => void }) {
  const typeLabel = TYPE_META[req.expenseType as ExpenseType]?.label ?? req.expenseType
  const reimbLabel = req.isReimbursable
    ? REIMBURSABLE_META['reimbursable'].label
    : REIMBURSABLE_META['non_reimbursable'].label
  const reimbKey = req.isReimbursable ? 'reimbursable' : 'non_reimbursable'

  return (
    <div className="exp-card" role="article" onClick={() => onOpen(req)}>
      <div className="exp-card__head">
        <span className="exp-card__num">{req.id}</span>
        <StatusBadge status={req.status} />
      </div>
      <p className="exp-card__desc">{req.description}</p>
      <div className="exp-card__meta">
        <span>{fmtDate(req.expenseDate)}</span>
        <span className="exp-card__sep">·</span>
        <span>{typeLabel}</span>
        <span className="exp-card__sep">·</span>
        <span className={`exp-reimb exp-reimb--${reimbKey}`}>{reimbLabel}</span>
      </div>
      <div className="exp-card__amounts">
        <span className="exp-card__uzs">{fmtUzs(req.amountUzs)} UZS</span>
        {req.equivalentAmount > 0 && (
          <span className="exp-card__usd">≈ {req.equivalentAmount.toFixed(2)} USD</span>
        )}
      </div>
      <div className="exp-card__ft">
        <button
          type="button" className="exp-card__open-btn"
          onClick={e => { e.stopPropagation(); onOpen(req) }}
        >
          Открыть
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function EmptyState({ hasFilters, onCreate }: { hasFilters: boolean; onCreate: () => void }) {
  return (
    <div className="exp-empty">
      <div className="exp-empty__icon">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="10" width="32" height="36" rx="3"/>
          <line x1="16" y1="20" x2="32" y2="20"/>
          <line x1="16" y1="27" x2="28" y2="27"/>
          <line x1="16" y1="34" x2="24" y2="34"/>
          <circle cx="38" cy="10" r="8" fill="var(--app-accent)" stroke="none"/>
          <line x1="38" y1="7" x2="38" y2="13" stroke="white" strokeWidth="2"/>
          <line x1="35" y1="10" x2="41" y2="10" stroke="white" strokeWidth="2"/>
        </svg>
      </div>
      {hasFilters ? (
        <>
          <p className="exp-empty__title">Заявок не найдено</p>
          <p className="exp-empty__desc">Попробуйте изменить фильтры или поисковый запрос</p>
        </>
      ) : (
        <>
          <p className="exp-empty__title">Заявок пока нет</p>
          <p className="exp-empty__desc">Создайте первую заявку на расход</p>
          <button type="button" className="exp-empty__btn" onClick={onCreate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Создать заявку
          </button>
        </>
      )}
    </div>
  )
}

// ——— Filter dropdown ———

type FilterDropProps = {
  label: string
  active: boolean
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}

function FilterDrop({ label, active, isOpen, onToggle, children }: FilterDropProps) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className={`exp-filter${active ? ' exp-filter--active' : ''}`} ref={ref}>
      <button type="button" className="exp-filter__btn" onClick={onToggle}>
        {label}
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <polyline points={isOpen ? '4 10 8 6 12 10' : '4 6 8 10 12 6'}/>
        </svg>
      </button>
      {isOpen && <div className="exp-filter__drop">{children}</div>}
    </div>
  )
}

// ——— Skeleton components ———

function SkeletonCell({ w, h = 14, style }: { w: string | number; h?: number; style?: CSSProperties }) {
  return <span className="exp-skel" style={{ width: w, height: h, ...style }} />
}

function SkeletonTableRow() {
  return (
    <div className="exp-table__row exp-table__row--skel" role="row" aria-hidden>
      <div className="exp-table__td exp-table__td--num"><SkeletonCell w={36} /></div>
      <div className="exp-table__td exp-table__td--desc"><SkeletonCell w="70%" /><SkeletonCell w="40%" h={10} /></div>
      <div className="exp-table__td exp-table__td--date"><SkeletonCell w={72} /></div>
      <div className="exp-table__td exp-table__td--type"><SkeletonCell w={80} /></div>
      <div className="exp-table__td exp-table__td--reimb"><SkeletonCell w={90} /></div>
      <div className="exp-table__td exp-table__td--uzs" style={{ justifyContent: 'flex-end' }}><SkeletonCell w={64} /></div>
      <div className="exp-table__td exp-table__td--usd" style={{ justifyContent: 'flex-end' }}><SkeletonCell w={56} /></div>
      <div className="exp-table__td exp-table__td--status"><SkeletonCell w={88} h={22} style={{ borderRadius: 20 }} /></div>
      <div className="exp-table__td exp-table__td--action" style={{ justifyContent: 'flex-end' }}><SkeletonCell w={60} h={28} style={{ borderRadius: 8 }} /></div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="exp-card exp-card--skel" aria-hidden>
      <div className="exp-card__head">
        <SkeletonCell w={52} h={13} />
        <SkeletonCell w={88} h={22} />
      </div>
      <SkeletonCell w="80%" h={14} />
      <SkeletonCell w="55%" h={11} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <SkeletonCell w={100} h={16} />
        <SkeletonCell w={70} h={16} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <SkeletonCell w={76} h={30} style={{ borderRadius: 8 }} />
      </div>
    </div>
  )
}

function SkeletonContent({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <div className="exp-stats-row" aria-hidden>
        <SkeletonCell w={80} h={13} />
        <SkeletonCell w={130} h={13} />
      </div>
      {isMobile ? (
        <div className="exp-cards">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="exp-table" role="table" aria-busy>
          <TableHead />
          <div className="exp-table__body" role="rowgroup">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} />)}
          </div>
        </div>
      )}
    </>
  )
}

// ——— Main component ———

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  all: 'Весь период', today: 'Сегодня', week: 'Эта неделя', month: 'Этот месяц',
}

export function ExpensesPage() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isCollapsed, setIsCollapsed] = useState(getSidebarCollapsed)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [requests, setRequests] = useState<ExpenseRequest[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetchExpenses({ limit: 200 })
      .then(data => {
        if (!cancelled) {
          setRequests(data.items)
          setIsLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки данных')
          setIsLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | ''>('')
  const [filterType, setFilterType] = useState<ExpenseType | ''>('')
  const [filterReimb, setFilterReimb] = useState<'reimbursable' | 'non_reimbursable' | ''>('')
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all')
  const [openFilter, setOpenFilter] = useState<ActiveFilter>(null)

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<PanelMode>('create')
  const [editingReq, setEditingReq] = useState<ExpenseRequest | null>(null)
  const [isReportOpen, setIsReportOpen] = useState(false)

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!openFilter) return
    const handler = () => setOpenFilter(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openFilter])

  const toggleFilter = useCallback((f: ActiveFilter) => {
    setOpenFilter(prev => prev === f ? null : f)
  }, [])

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => { const n = !prev; setSidebarCollapsed(n); return n })
  }, [])

  const handleCreate = useCallback(() => {
    setEditingReq(null)
    setPanelMode('create')
    setIsPanelOpen(true)
  }, [])

  const handleOpenReq = useCallback((req: ExpenseRequest) => {
    setEditingReq(req)
    setPanelMode(req.status === 'draft' || req.status === 'revision_required' ? 'edit' : 'view')
    setIsPanelOpen(true)
  }, [])

  const handleClosePanel = useCallback(() => setIsPanelOpen(false), [])

  const handleSaveDraft = useCallback(async (values: ExpenseFormValues, files: File[]) => {
    try {
      const body = formValuesToApiBody(values)
      let saved: ExpenseRequest
      if (editingReq) {
        saved = await updateExpense(editingReq.id, body)
      } else {
        saved = await createExpense(body)
      }
      for (const file of files) {
        await uploadAttachment(saved.id, file)
      }
      setRequests(prev =>
        editingReq
          ? prev.map(r => r.id === saved.id ? saved : r)
          : [saved, ...prev]
      )
      setIsPanelOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении')
    }
  }, [editingReq])

  const handleSubmit = useCallback(async (values: ExpenseFormValues, files: File[]) => {
    try {
      const body = formValuesToApiBody(values)
      let saved: ExpenseRequest
      if (editingReq) {
        saved = await updateExpense(editingReq.id, body)
      } else {
        saved = await createExpense(body)
      }
      for (const file of files) {
        await uploadAttachment(saved.id, file)
      }
      const submitted = await submitExpense(saved.id)
      setRequests(prev =>
        editingReq
          ? prev.map(r => r.id === submitted.id ? submitted : r)
          : [submitted, ...prev]
      )
      setIsPanelOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при отправке')
    }
  }, [editingReq])

  const resetFilters = useCallback(() => {
    setFilterStatus('')
    setFilterType('')
    setFilterReimb('')
    setFilterPeriod('all')
    setSearch('')
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return requests.filter(r => {
      if (q && !r.description.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false
      if (filterStatus && r.status !== filterStatus) return false
      if (filterType && r.expenseType !== filterType) return false
      if (filterReimb) {
        const wantReimb = filterReimb === 'reimbursable'
        if (r.isReimbursable !== wantReimb) return false
      }
      if (filterPeriod === 'today' && r.expenseDate !== TODAY) return false
      if (filterPeriod === 'week' && r.expenseDate < getWeekStart()) return false
      if (filterPeriod === 'month' && r.expenseDate < getMonthStart()) return false
      return true
    })
  }, [requests, search, filterStatus, filterType, filterReimb, filterPeriod])

  const hasFilters = !!(filterStatus || filterType || filterReimb || filterPeriod !== 'all' || search)

  const statuses: ExpenseStatus[] = [
    'draft', 'pending_approval', 'revision_required',
    'approved', 'rejected', 'paid', 'closed', 'not_reimbursable', 'withdrawn',
  ]
  const types: ExpenseType[] = ['transport', 'food', 'accommodation', 'purchase', 'services', 'entertainment', 'other']

  return (
    <div className="expenses-page">
      <div className="expenses-page__sidebar-wrap">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
          isMobile={isMobile}
        />
      </div>

      <main className="expenses-page__main">
        <header className="expenses-page__header">
          {isMobile && (
            <button type="button" className="expenses-page__menu-btn" onClick={() => setIsMobileOpen(true)} aria-label="Открыть меню">
              <IconMenu />
            </button>
          )}
          <div className="expenses-page__header-inner">
            <h1 className="expenses-page__title">Расходы компании</h1>
            <div className="exp-header-actions">
              <button type="button" className="exp-report-btn" onClick={() => setIsReportOpen(true)} title="Создать отчёт Excel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <span className="exp-report-btn__label">Отчёт Excel</span>
              </button>
              <button type="button" className="exp-create-btn" onClick={handleCreate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span className="exp-create-btn__label">Создать заявку</span>
              </button>
            </div>
          </div>
        </header>

        <div className="expenses-page__content">
          {error && (
            <div className="exp-error-banner" role="alert">
              <span>{error}</span>
              <button type="button" className="exp-error-banner__close" onClick={() => setError(null)} aria-label="Закрыть">✕</button>
            </div>
          )}

          {/* Toolbar */}
          <div className={`exp-toolbar${isLoading ? ' exp-toolbar--loading' : ''}`}>
            <div className="exp-search-wrap">
              <svg className="exp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="search" className="exp-search" placeholder="Поиск по описанию или номеру…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="exp-filters" onMouseDown={e => e.stopPropagation()}>
              {/* Status */}
              <FilterDrop
                label={filterStatus ? STATUS_META[filterStatus].label : 'Статус'}
                active={!!filterStatus}
                isOpen={openFilter === 'status'}
                onToggle={() => toggleFilter('status')}
              >
                <button className={`exp-filter__opt${!filterStatus ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterStatus(''); setOpenFilter(null) }}>
                  Все статусы
                </button>
                {statuses.map(s => (
                  <button key={s} className={`exp-filter__opt${filterStatus === s ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterStatus(s); setOpenFilter(null) }}>
                    <span className={`exp-filter__dot exp-filter__dot--${s}`}/>
                    {STATUS_META[s].label}
                  </button>
                ))}
              </FilterDrop>

              {/* Type */}
              <FilterDrop
                label={filterType ? TYPE_META[filterType].label : 'Тип расхода'}
                active={!!filterType}
                isOpen={openFilter === 'type'}
                onToggle={() => toggleFilter('type')}
              >
                <button className={`exp-filter__opt${!filterType ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterType(''); setOpenFilter(null) }}>
                  Все типы
                </button>
                {types.map(t => (
                  <button key={t} className={`exp-filter__opt${filterType === t ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterType(t); setOpenFilter(null) }}>
                    {TYPE_META[t].label}
                  </button>
                ))}
              </FilterDrop>

              {/* Reimbursable */}
              <FilterDrop
                label={filterReimb ? REIMBURSABLE_META[filterReimb].label : 'Возмещение'}
                active={!!filterReimb}
                isOpen={openFilter === 'reimbursable'}
                onToggle={() => toggleFilter('reimbursable')}
              >
                <button className={`exp-filter__opt${!filterReimb ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterReimb(''); setOpenFilter(null) }}>
                  Любое
                </button>
                <button className={`exp-filter__opt${filterReimb === 'reimbursable' ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterReimb('reimbursable'); setOpenFilter(null) }}>
                  Возмещаемый
                </button>
                <button className={`exp-filter__opt${filterReimb === 'non_reimbursable' ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterReimb('non_reimbursable'); setOpenFilter(null) }}>
                  Невозмещаемый
                </button>
              </FilterDrop>

              {/* Period */}
              <FilterDrop
                label={PERIOD_LABELS[filterPeriod]}
                active={filterPeriod !== 'all'}
                isOpen={openFilter === 'period'}
                onToggle={() => toggleFilter('period')}
              >
                {(Object.keys(PERIOD_LABELS) as FilterPeriod[]).map(p => (
                  <button key={p} className={`exp-filter__opt${filterPeriod === p ? ' exp-filter__opt--on' : ''}`} onClick={() => { setFilterPeriod(p); setOpenFilter(null) }}>
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </FilterDrop>

              {hasFilters && (
                <button type="button" className="exp-filters-reset" onClick={resetFilters}>
                  Сбросить
                </button>
              )}
            </div>
          </div>

          {/* Stats row + Content */}
          {isLoading ? (
            <SkeletonContent isMobile={isMobile} />
          ) : (
            <>
              <div className="exp-stats-row">
                <span className="exp-stats-count">{filtered.length} заявок</span>
                {filtered.length > 0 && (
                  <span className="exp-stats-sum">
                    {fmtUzs(filtered.reduce((s, r) => s + r.amountUzs, 0))} UZS
                  </span>
                )}
              </div>

              {filtered.length === 0 ? (
                <EmptyState hasFilters={hasFilters} onCreate={handleCreate} />
              ) : isMobile ? (
                <div className="exp-cards">
                  {filtered.map(r => <ExpenseCard key={r.id} req={r} onOpen={handleOpenReq} />)}
                </div>
              ) : (
                <div className="exp-table" role="table">
                  <TableHead />
                  <div className="exp-table__body" role="rowgroup">
                    {filtered.map(r => <TableRow key={r.id} req={r} onOpen={handleOpenReq} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <ExpensesFormPanel
        isOpen={isPanelOpen}
        mode={panelMode}
        editingRequest={editingReq}
        onClose={handleClosePanel}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
      />

      <ExpensesReportModal
        isOpen={isReportOpen}
        requests={requests}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  )
}
