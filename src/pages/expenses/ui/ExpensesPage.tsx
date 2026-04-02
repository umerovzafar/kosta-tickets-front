import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { routes } from '@shared/config'
import { useCurrentUser, useMediaQuery } from '@shared/hooks'
import { getSidebarCollapsed, setSidebarCollapsed } from '@shared/lib/sidebarCollapsed'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { ExpensesFormPanel, type PanelMode } from './ExpensesFormPanel'
import { ExpensesReportModal } from './ExpensesReportModal'
import type {
  ExpenseRequest,
  ExpenseFormValues,
  ExpenseFilesByKind,
  ExpenseStatus,
  ExpenseType,
  ExpenseCreatedBy,
} from '../model/types'
import {
  EXPENSE_REGISTRY_STATUSES,
  EXPENSE_REGISTRY_STATUS_SET,
  STATUS_META,
  TYPE_META,
  REIMBURSABLE_META,
} from '../model/constants'
import {
  fetchExpenses,
  fetchExpenseById,
  createExpense,
  updateExpense,
  submitExpense,
  uploadAttachment,
  approveExpense,
  rejectExpense,
  reviseExpense,
} from '../model/expensesApi'
import { computeAmountUzsForApi } from '../model/expenseCurrency'
import { asExpenseNumber, normalizeExpenseRequest } from '../model/coerceExpense'
import { getUser } from '@entities/user'
import {
  expenseAuthorSearchText,
  formatExpenseAuthorLabel,
  mergeExpenseAuthorFromCache,
  needsAuthorEnrichment,
} from '../model/expenseAuthor'
import { canViewExpensesRequestsAndReport } from '../model/expenseModeration'
import { ExpensesPageBoundary } from './ExpensesPageBoundary'
import './ExpensesPage.css'

export type ExpensesPageVariant = 'default' | 'moderationQueue'

export type ExpensesPageProps = { variant?: ExpensesPageVariant }

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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function expenseDateKey(raw: unknown): string {
  const s = String(raw ?? '').slice(0, 10)
  return ISO_DATE_RE.test(s) ? s : ''
}

function fmtExpenseDateCell(raw: unknown): string {
  const k = expenseDateKey(raw)
  return k ? fmtDate(k) : '—'
}

function paymentDeadlineCell(raw: unknown): string {
  if (raw == null || raw === '') return '—'
  const s = typeof raw === 'string' ? raw : String(raw)
  const prefix = s.slice(0, 10)
  return ISO_DATE_RE.test(prefix) ? fmtDate(prefix) : '—'
}

function fmtUzs(raw: unknown) {
  return asExpenseNumber(raw).toLocaleString('ru-RU')
}

function formValuesToApiBody(values: ExpenseFormValues) {
  const paymentDeadline = values.paymentDeadline.trim() ? values.paymentDeadline : null
  return {
    description: values.description,
    expenseDate: values.expenseDate,
    paymentDeadline,
    amountUzs: computeAmountUzsForApi(
      values.amountCurrency,
      values.amountUzs,
      values.exchangeRate,
      values.foreignPerUsd,
    ),
    exchangeRate: parseFloat(values.exchangeRate) || 0,
    expenseType: values.expenseType,
    isReimbursable: values.isReimbursable ?? false,
    paymentMethod: values.paymentMethod || undefined,
    projectId: values.projectId || undefined,
    vendor: values.vendor || undefined,
    businessPurpose: values.businessPurpose || undefined,
    comment: values.comment || undefined,
  }
}

// ——— Sub-components ———

function IconModerationCheck() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconModerationCross() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const meta = STATUS_META[status]
  return <span className={`exp-status exp-status--${status}`}>{meta?.label ?? status}</span>
}

function CardFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="exp-card__fact">
      <span className="exp-card__fact-label">{label}</span>
      <span className="exp-card__fact-value">{children}</span>
    </div>
  )
}

function ExpenseCard({
  req,
  onOpen,
  canModerate,
  moderationBusyId,
  onApprove,
  onRejectClick,
  onReviseClick,
}: {
  req: ExpenseRequest
  onOpen: (r: ExpenseRequest) => void
  canModerate: boolean
  moderationBusyId: string | null
  onApprove: (r: ExpenseRequest) => void
  onRejectClick: (r: ExpenseRequest) => void
  onReviseClick: (r: ExpenseRequest) => void
}) {
  const typeLabel = TYPE_META[req.expenseType as ExpenseType]?.label ?? req.expenseType
  const reimbLabel = req.isReimbursable
    ? REIMBURSABLE_META['reimbursable'].label
    : REIMBURSABLE_META['non_reimbursable'].label
  const reimbKey = req.isReimbursable ? 'reimbursable' : 'non_reimbursable'
  const uzsAmt = asExpenseNumber(req.amountUzs)
  const equivUsd = asExpenseNumber(req.equivalentAmount)
  const rate = asExpenseNumber(req.exchangeRate)
  const payDueLabel = paymentDeadlineCell(req.paymentDeadline)
  const showMod = canModerate && req.status === 'pending_approval'
  const busy = moderationBusyId === req.id

  return (
    <div className="exp-card" role="article" onClick={() => onOpen(req)}>
      <div className="exp-card__head">
        <span className="exp-card__num">{req.id}</span>
        <StatusBadge status={req.status} />
      </div>
      <p className="exp-card__desc">{String(req.description ?? '')}</p>
      <p className="exp-card__author-line">
        <span className="exp-card__author-label">Автор</span>
        <span className="exp-card__author-name">{formatExpenseAuthorLabel(req)}</span>
      </p>

      <div className="exp-card__facts" role="group" aria-label="Реквизиты заявки">
        <CardFact label="Дата расхода">{fmtExpenseDateCell(req.expenseDate)}</CardFact>
        <CardFact label="Срок оплаты">{payDueLabel}</CardFact>
        <CardFact label="Тип расхода">{typeLabel}</CardFact>
        <CardFact label="Возмещение">
          <span className={`exp-reimb exp-reimb--${reimbKey}`}>{reimbLabel}</span>
        </CardFact>
      </div>

      <div className="exp-card__money" role="group" aria-label="Суммы и курс">
        <div className="exp-card__money-cell">
          <span className="exp-card__money-label">Сумма, UZS</span>
          <span className="exp-card__money-value exp-card__money-value--uzs">
            <span className="exp-card__money-num">{fmtUzs(uzsAmt)}</span>
            <span className="exp-card__money-suffix">UZS</span>
          </span>
        </div>
        <div className="exp-card__money-cell">
          <span className="exp-card__money-label">Эквивалент</span>
          <span className="exp-card__money-value exp-card__money-value--usd">
            {equivUsd > 0 ? (
              <>
                <span className="exp-card__money-num">
                  {equivUsd.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="exp-card__money-suffix">USD</span>
              </>
            ) : (
              <span className="exp-card__money-empty">—</span>
            )}
          </span>
        </div>
        <div className="exp-card__money-cell">
          <span className="exp-card__money-label">Курс UZS/USD</span>
          <span className="exp-card__money-value exp-card__money-value--rate">
            {rate > 0 ? (
              <>
                <span className="exp-card__money-num">
                  {rate.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 4 })}
                </span>
                <span className="exp-card__money-suffix exp-card__money-suffix--hint">за 1 USD</span>
              </>
            ) : (
              <span className="exp-card__money-empty">—</span>
            )}
          </span>
        </div>
      </div>

      <div className="exp-card__ft" onClick={e => e.stopPropagation()}>
        {showMod && (
          <div className="exp-card__mod-row">
            <button
              type="button"
              className="exp-card__mod-btn exp-card__mod-btn--icon exp-card__mod-btn--approve"
              disabled={busy}
              title="Одобрить"
              aria-label="Одобрить заявку"
              onClick={() => onApprove(req)}
            >
              <IconModerationCheck />
            </button>
            <button
              type="button"
              className="exp-card__mod-btn exp-card__mod-btn--icon exp-card__mod-btn--reject"
              disabled={busy}
              title="Отклонить"
              aria-label="Отклонить заявку"
              onClick={() => onRejectClick(req)}
            >
              <IconModerationCross />
            </button>
            <button type="button" className="exp-card__mod-btn exp-card__mod-btn--revise" disabled={busy} onClick={() => onReviseClick(req)}>
              На доработку
            </button>
          </div>
        )}
        <button
          type="button"
          className="exp-card__open-btn"
          disabled={busy}
          onClick={() => onOpen(req)}
        >
          Открыть
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function EmptyState({
  hasFilters,
  onCreate,
  moderationQueue,
}: {
  hasFilters: boolean
  onCreate: () => void
  moderationQueue?: boolean
}) {
  if (moderationQueue) {
    return (
      <div className="exp-empty">
        <div className="exp-empty__icon">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="10" width="32" height="36" rx="3"/>
            <line x1="16" y1="20" x2="32" y2="20"/>
            <line x1="16" y1="27" x2="28" y2="27"/>
            <line x1="16" y1="34" x2="24" y2="34"/>
          </svg>
        </div>
        {hasFilters ? (
          <>
            <p className="exp-empty__title">Заявок не найдено</p>
            <p className="exp-empty__desc">Попробуйте изменить поиск или фильтры</p>
          </>
        ) : (
          <>
            <p className="exp-empty__title">Нет заявок на согласовании</p>
            <p className="exp-empty__desc">Отправленные сотрудниками заявки появятся в этом списке</p>
          </>
        )}
      </div>
    )
  }
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
        <span className="exp-filter__btn-text">{label}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <polyline points={isOpen ? '4 10 8 6 12 10' : '4 6 8 10 12 6'}/>
        </svg>
      </button>
      {isOpen && <div className="exp-filter__drop">{children}</div>}
    </div>
  )
}

// ——— Service unavailable state ———

function ServiceUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  const isServiceDown = /unavailable|503|недоступ/i.test(message)
  return (
    <div className="exp-service-err">
      <div className="exp-service-err__icon">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="32" r="28"/>
          <path d="M20 26c0-6.627 5.373-12 12-12s12 5.373 12 12c0 4-2 7-5 9l-1 7H26l-1-7c-3-2-5-5-5-9z"/>
          <line x1="32" y1="50" x2="32" y2="52"/>
        </svg>
      </div>
      <h2 className="exp-service-err__title">
        {isServiceDown ? 'Сервис временно недоступен' : 'Не удалось загрузить данные'}
      </h2>
      <p className="exp-service-err__desc">
        {isServiceDown
          ? 'Сервис расходов сейчас не отвечает. Попробуйте обновить страницу или повторите попытку через несколько минут.'
          : message}
      </p>
      <button type="button" className="exp-service-err__btn" onClick={onRetry}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Повторить попытку
      </button>
    </div>
  )
}

// ——— Skeleton components ———

function SkeletonCell({ w, h = 14, style }: { w: string | number; h?: number; style?: CSSProperties }) {
  return <span className="exp-skel" style={{ width: w, height: h, ...style }} />
}

function SkeletonCard() {
  return (
    <div className="exp-card exp-card--skel" aria-hidden>
      <div className="exp-card__head">
        <SkeletonCell w={52} h={13} />
        <SkeletonCell w={88} h={22} style={{ borderRadius: 20 }} />
      </div>
      <SkeletonCell w="90%" h={14} />
      <SkeletonCell w="75%" h={14} />
      <div className="exp-card__facts exp-card__facts--skel">
        <SkeletonCell w="100%" h={32} />
        <SkeletonCell w="100%" h={32} />
        <SkeletonCell w="100%" h={32} />
        <SkeletonCell w="100%" h={32} />
      </div>
      <div className="exp-card__money exp-card__money--skel">
        <SkeletonCell w="100%" h={40} />
        <SkeletonCell w="100%" h={40} />
        <SkeletonCell w="100%" h={40} />
      </div>
      <div className="exp-card__ft exp-card__ft--skel">
        <SkeletonCell w={120} h={36} style={{ borderRadius: 10 }} />
      </div>
    </div>
  )
}

function SkeletonContent() {
  return (
    <>
      <div className="exp-stats-row" aria-hidden>
        <SkeletonCell w={80} h={13} />
        <SkeletonCell w={130} h={13} />
      </div>
      <div className="exp-cards exp-cards--grid" aria-busy>
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </>
  )
}

// ——— Main component ———

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  all: 'Весь период', today: 'Сегодня', week: 'Эта неделя', month: 'Этот месяц',
}

function ExpensesPageInner({ variant = 'default' }: ExpensesPageProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { user } = useCurrentUser()
  /** Очередь на согласование и действия модерации — только администраторы и партнёры */
  const canModerate = canViewExpensesRequestsAndReport(user?.role)
  const [isCollapsed, setIsCollapsed] = useState(getSidebarCollapsed)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [requests, setRequests] = useState<ExpenseRequest[]>([])
  const [authorCache, setAuthorCache] = useState<Record<number, ExpenseCreatedBy>>({})
  const authorFetchStartedRef = useRef(new Set<number>())
  const [loadKey, setLoadKey] = useState(0)
  const isModerationQueue = variant === 'moderationQueue'

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    const params = isModerationQueue
      ? { status: 'pending_approval' as const, limit: 200 }
      : { limit: 200 }
    fetchExpenses(params)
      .then(data => {
        if (!cancelled) {
          setRequests(Array.isArray(data.items) ? data.items : [])
          setIsLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки данных')
          setIsLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [loadKey, isModerationQueue])

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | ''>('')
  const [filterType, setFilterType] = useState<ExpenseType | ''>('')
  const [filterReimb, setFilterReimb] = useState<'reimbursable' | 'non_reimbursable' | ''>('')
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all')
  const [openFilter, setOpenFilter] = useState<ActiveFilter>(null)

  useEffect(() => {
    if (isModerationQueue) setFilterStatus('')
  }, [isModerationQueue])

  useEffect(() => {
    if (!isModerationQueue && filterStatus && !EXPENSE_REGISTRY_STATUS_SET.has(filterStatus)) {
      setFilterStatus('')
    }
  }, [isModerationQueue, filterStatus])

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<PanelMode>('create')
  const [editingReq, setEditingReq] = useState<ExpenseRequest | null>(null)

  /** Если микросервис expenses не получил профили из auth, подтягиваем авторов через gateway GET /api/v1/users/:id (как в тикетах). */
  useEffect(() => {
    const candidates: ExpenseRequest[] = []
    if (Array.isArray(requests)) candidates.push(...requests)
    if (editingReq) candidates.push(editingReq)
    if (candidates.length === 0) return
    const pending: number[] = []
    for (const r of candidates) {
      if (r == null || typeof r !== 'object') continue
      try {
        const n = normalizeExpenseRequest(r as ExpenseRequest)
        if (!needsAuthorEnrichment(n)) continue
        const id = n.createdByUserId
        if (authorFetchStartedRef.current.has(id)) continue
        authorFetchStartedRef.current.add(id)
        pending.push(id)
      } catch {
        /* пропускаем битую строку */
      }
    }
    if (pending.length === 0) return
    let cancelled = false
    Promise.all(
      pending.map(id =>
        getUser(id)
          .then(
            (u): ExpenseCreatedBy => ({
              id: u.id,
              displayName: u.display_name,
              email: u.email,
              picture: u.picture,
              position: u.position,
            }),
          )
          .catch(() => {
            authorFetchStartedRef.current.delete(id)
            return null
          }),
      ),
    ).then(entries => {
      if (cancelled) return
      const next: Record<number, ExpenseCreatedBy> = {}
      for (const e of entries) {
        if (e) next[e.id] = e
      }
      if (Object.keys(next).length > 0) {
        setAuthorCache(prev => ({ ...prev, ...next }))
      }
    })
    return () => { cancelled = true }
  }, [requests, editingReq])

  const [isReportOpen, setIsReportOpen] = useState(false)
  const [tableModerationBusyId, setTableModerationBusyId] = useState<string | null>(null)
  const [tableReject, setTableReject] = useState<ExpenseRequest | null>(null)
  const [tableRevise, setTableRevise] = useState<ExpenseRequest | null>(null)
  const [tableRejectReason, setTableRejectReason] = useState('')
  const [tableReviseComment, setTableReviseComment] = useState('')
  const [tableModErr, setTableModErr] = useState<string | null>(null)

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
    const mode = req.status === 'draft' || req.status === 'revision_required' ? 'edit' : 'view'
    setEditingReq(req)
    setPanelMode(mode)
    setIsPanelOpen(true)
    if (mode === 'view') {
      fetchExpenseById(req.id)
        .then(full => { setEditingReq(prev => (prev?.id === full.id ? full : prev)) })
        .catch(() => { /* данные из списка */ })
    }
  }, [])

  const handleClosePanel = useCallback(() => setIsPanelOpen(false), [])

  const applyModerationToList = useCallback(
    (r: ExpenseRequest) => {
      setRequests(prev => {
        if (isModerationQueue && r.status !== 'pending_approval') {
          return prev.filter(x => x.id !== r.id)
        }
        if (!isModerationQueue && !EXPENSE_REGISTRY_STATUS_SET.has(r.status)) {
          return prev.filter(x => x.id !== r.id)
        }
        return prev.map(x => (x.id === r.id ? r : x))
      })
      setEditingReq(prev => (prev?.id === r.id ? r : prev))
    },
    [isModerationQueue],
  )

  const handleExpenseUpdated = useCallback(
    (r: ExpenseRequest) => {
      applyModerationToList(r)
      setIsPanelOpen(false)
    },
    [applyModerationToList],
  )

  const handleTableApprove = useCallback(
    async (req: ExpenseRequest) => {
      if (tableModerationBusyId) return
      setTableModerationBusyId(req.id)
      setActionError(null)
      try {
        const r = await approveExpense(req.id)
        applyModerationToList(r)
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Не удалось одобрить заявку')
      } finally {
        setTableModerationBusyId(null)
      }
    },
    [tableModerationBusyId, applyModerationToList],
  )

  const openTableReject = useCallback((req: ExpenseRequest) => {
    setTableReject(req)
    setTableRejectReason('')
    setTableModErr(null)
  }, [])

  const openTableRevise = useCallback((req: ExpenseRequest) => {
    setTableRevise(req)
    setTableReviseComment('')
    setTableModErr(null)
  }, [])

  const confirmTableReject = useCallback(async () => {
    if (!tableReject || tableModerationBusyId) return
    const t = tableRejectReason.trim()
    if (!t) {
      setTableModErr('Укажите причину отклонения')
      return
    }
    setTableModerationBusyId(tableReject.id)
    setTableModErr(null)
    try {
      const r = await rejectExpense(tableReject.id, t)
      applyModerationToList(r)
      setTableReject(null)
      setTableRejectReason('')
    } catch (e) {
      setTableModErr(e instanceof Error ? e.message : 'Не удалось отклонить заявку')
    } finally {
      setTableModerationBusyId(null)
    }
  }, [tableReject, tableRejectReason, tableModerationBusyId, applyModerationToList])

  const confirmTableRevise = useCallback(async () => {
    if (!tableRevise || tableModerationBusyId) return
    const t = tableReviseComment.trim()
    if (!t) {
      setTableModErr('Укажите комментарий для автора')
      return
    }
    setTableModerationBusyId(tableRevise.id)
    setTableModErr(null)
    try {
      const r = await reviseExpense(tableRevise.id, t)
      applyModerationToList(r)
      setTableRevise(null)
      setTableReviseComment('')
    } catch (e) {
      setTableModErr(e instanceof Error ? e.message : 'Не удалось вернуть заявку на доработку')
    } finally {
      setTableModerationBusyId(null)
    }
  }, [tableRevise, tableReviseComment, tableModerationBusyId, applyModerationToList])

  const tableModBusy = tableModerationBusyId !== null

  const handleSaveDraft = useCallback(async (values: ExpenseFormValues, filesByKind: ExpenseFilesByKind) => {
    try {
      const body = formValuesToApiBody(values)
      let saved: ExpenseRequest
      if (editingReq) {
        saved = await updateExpense(editingReq.id, body)
      } else {
        saved = await createExpense(body)
      }
      let last: ExpenseRequest = saved
      for (const file of filesByKind.payment_document) {
        last = await uploadAttachment(last.id, file, 'payment_document')
      }
      for (const file of filesByKind.payment_receipt) {
        last = await uploadAttachment(last.id, file, 'payment_receipt')
      }
      setRequests(prev =>
        editingReq
          ? prev.map(r => r.id === last.id ? last : r)
          : [last, ...prev]
      )
      setIsPanelOpen(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка при сохранении')
    }
  }, [editingReq])

  const handleSubmit = useCallback(async (values: ExpenseFormValues, filesByKind: ExpenseFilesByKind) => {
    try {
      const body = formValuesToApiBody(values)
      let saved: ExpenseRequest
      if (editingReq) {
        saved = await updateExpense(editingReq.id, body)
      } else {
        saved = await createExpense(body)
      }
      let last: ExpenseRequest = saved
      for (const file of filesByKind.payment_document) {
        last = await uploadAttachment(last.id, file, 'payment_document')
      }
      for (const file of filesByKind.payment_receipt) {
        last = await uploadAttachment(last.id, file, 'payment_receipt')
      }
      const submitted = await submitExpense(last.id)
      setRequests(prev =>
        editingReq
          ? prev.map(r => r.id === submitted.id ? submitted : r)
          : [submitted, ...prev]
      )
      setIsPanelOpen(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка при отправке')
    }
  }, [editingReq])

  const resetFilters = useCallback(() => {
    setFilterStatus('')
    setFilterType('')
    setFilterReimb('')
    setFilterPeriod('all')
    setSearch('')
  }, [])

  /** Нормализация + отбраковка битых элементов с API, чтобы не ронять таблицу. */
  const requestsForUi = useMemo(() => {
    if (!Array.isArray(requests)) return []
    return requests
      .filter((r): r is ExpenseRequest => r != null && typeof r === 'object')
      .map(r => {
        try {
          const n = normalizeExpenseRequest(r)
          return mergeExpenseAuthorFromCache(n, authorCache)
        } catch {
          return null
        }
      })
      .filter((r): r is ExpenseRequest => r !== null)
  }, [requests, authorCache])

  const editingRequestForPanel = useMemo(() => {
    if (!editingReq) return null
    try {
      return mergeExpenseAuthorFromCache(normalizeExpenseRequest(editingReq), authorCache)
    } catch {
      return mergeExpenseAuthorFromCache(editingReq, authorCache)
    }
  }, [editingReq, authorCache])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return requestsForUi.filter(r => {
      const desc = String(r.description ?? '').toLowerCase()
      const idStr = String(r.id ?? '').toLowerCase()
      const authorHay = expenseAuthorSearchText(r)
      if (q && !desc.includes(q) && !idStr.includes(q) && !authorHay.includes(q)) return false
      if (!isModerationQueue && !EXPENSE_REGISTRY_STATUS_SET.has(r.status)) return false
      if (!isModerationQueue && filterStatus && r.status !== filterStatus) return false
      if (filterType && r.expenseType !== filterType) return false
      if (filterReimb) {
        const wantReimb = filterReimb === 'reimbursable'
        if (r.isReimbursable !== wantReimb) return false
      }
      const expD = expenseDateKey(r.expenseDate)
      if (filterPeriod === 'today' && expD !== TODAY) return false
      if (filterPeriod === 'week' && (!expD || expD < getWeekStart())) return false
      if (filterPeriod === 'month' && (!expD || expD < getMonthStart())) return false
      return true
    })
  }, [
    requestsForUi,
    search,
    filterStatus,
    filterType,
    filterReimb,
    filterPeriod,
    isModerationQueue,
  ])

  const filteredTotals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          uzs: acc.uzs + asExpenseNumber(r.amountUzs),
          usd: acc.usd + asExpenseNumber(r.equivalentAmount),
        }),
        { uzs: 0, usd: 0 },
      ),
    [filtered],
  )

  const hasFilters = isModerationQueue
    ? !!(filterType || filterReimb || filterPeriod !== 'all' || search)
    : !!(filterStatus || filterType || filterReimb || filterPeriod !== 'all' || search)

  /** Фильтр по статусу на /expenses — только статусы реестра (см. EXPENSE_REGISTRY_STATUSES). */
  const statuses: ExpenseStatus[] = EXPENSE_REGISTRY_STATUSES
  const types: ExpenseType[] = ['transport', 'food', 'accommodation', 'purchase', 'services', 'entertainment', 'client_expense', 'other']

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
            <h1 className="expenses-page__title">
              {isModerationQueue ? 'Заявки на согласование' : 'Расходы компании'}
            </h1>
            <div className="exp-header-actions">
              {canModerate && !isModerationQueue && (
                <NavLink to={routes.expensesRequests} className="exp-queue-nav">
                  На согласование
                </NavLink>
              )}
              {isModerationQueue && (
                <NavLink to={routes.expenses} className="exp-queue-nav">
                  Утверждённые расходы
                </NavLink>
              )}
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
              {!isModerationQueue && (
                <button type="button" className="exp-create-btn" onClick={handleCreate}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span className="exp-create-btn__label">Создать заявку</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="expenses-page__content">
          {actionError && (
            <div className="exp-error-banner" role="alert">
              <span>{actionError}</span>
              <button type="button" className="exp-error-banner__close" onClick={() => setActionError(null)} aria-label="Закрыть">✕</button>
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
                type="search" className="exp-search" placeholder="Поиск по описанию, номеру или автору…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="exp-filters" onMouseDown={e => e.stopPropagation()}>
              {!isModerationQueue && (
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
              )}

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
            <SkeletonContent />
          ) : loadError ? (
            <ServiceUnavailable message={loadError} onRetry={() => setLoadKey(k => k + 1)} />
          ) : (
            <>
              <div className="exp-stats-row">
                <span className="exp-stats-count">{filtered.length} заявок</span>
                {filtered.length > 0 && (
                  <span className="exp-stats-sum">
                    {fmtUzs(filteredTotals.uzs)} UZS
                    {filteredTotals.usd > 0 && (
                      <>
                        <span className="exp-stats-sum__sep"> · </span>
                        <span className="exp-stats-sum__usd">{filteredTotals.usd.toFixed(2)} USD</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              {filtered.length === 0 ? (
                <EmptyState hasFilters={hasFilters} onCreate={handleCreate} moderationQueue={isModerationQueue} />
              ) : (
                <div className="exp-cards exp-cards--grid" role="list" aria-label="Список заявок на расход">
                  {filtered.map(r => (
                    <div key={r.id} className="exp-cards__item" role="listitem">
                      <ExpenseCard
                        req={r}
                        onOpen={handleOpenReq}
                        canModerate={canModerate}
                        moderationBusyId={tableModerationBusyId}
                        onApprove={handleTableApprove}
                        onRejectClick={openTableReject}
                        onReviseClick={openTableRevise}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {tableReject && (
        <div
          className="exp-mod-backdrop"
          role="presentation"
          onClick={() => {
            if (!tableModBusy) {
              setTableReject(null)
              setTableModErr(null)
            }
          }}
        >
          <div className="exp-mod-dialog" role="dialog" aria-modal aria-labelledby="exp-table-reject-title" onClick={e => e.stopPropagation()}>
            <h3 id="exp-table-reject-title" className="exp-mod-dialog__title">Отклонить заявку</h3>
            <p className="exp-mod-dialog__sub">Заявка {tableReject.id}. Укажите причину — автор её увидит в истории.</p>
            <textarea
              className="exp-mod-dialog__textarea"
              rows={4}
              placeholder="Причина отклонения"
              value={tableRejectReason}
              onChange={e => setTableRejectReason(e.target.value)}
              disabled={tableModBusy}
            />
            {tableModErr && <p className="exp-mod-err" role="alert">{tableModErr}</p>}
            <div className="exp-mod-dialog__ft">
              <button type="button" className="exp-panel-btn exp-panel-btn--ghost" disabled={tableModBusy} onClick={() => { setTableReject(null); setTableModErr(null) }}>Отмена</button>
              <button type="button" className="exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger" disabled={tableModBusy} onClick={confirmTableReject}>Отклонить</button>
            </div>
          </div>
        </div>
      )}
      {tableRevise && (
        <div
          className="exp-mod-backdrop"
          role="presentation"
          onClick={() => {
            if (!tableModBusy) {
              setTableRevise(null)
              setTableModErr(null)
            }
          }}
        >
          <div className="exp-mod-dialog" role="dialog" aria-modal aria-labelledby="exp-table-revise-title" onClick={e => e.stopPropagation()}>
            <h3 id="exp-table-revise-title" className="exp-mod-dialog__title">Вернуть на доработку</h3>
            <p className="exp-mod-dialog__sub">Заявка {tableRevise.id}. Автор сможет исправить заявку и отправить снова.</p>
            <textarea
              className="exp-mod-dialog__textarea"
              rows={4}
              placeholder="Что нужно исправить или дополнить"
              value={tableReviseComment}
              onChange={e => setTableReviseComment(e.target.value)}
              disabled={tableModBusy}
            />
            {tableModErr && <p className="exp-mod-err" role="alert">{tableModErr}</p>}
            <div className="exp-mod-dialog__ft">
              <button type="button" className="exp-panel-btn exp-panel-btn--ghost" disabled={tableModBusy} onClick={() => { setTableRevise(null); setTableModErr(null) }}>Отмена</button>
              <button type="button" className="exp-panel-btn exp-panel-btn--primary" disabled={tableModBusy} onClick={confirmTableRevise}>Вернуть</button>
            </div>
          </div>
        </div>
      )}

      <ExpensesFormPanel
        isOpen={isPanelOpen}
        mode={panelMode}
        editingRequest={editingRequestForPanel}
        onClose={handleClosePanel}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        onExpenseSnapshotUpdated={r => {
          setEditingReq(r)
          setRequests(prev => prev.map(x => (x.id === r.id ? r : x)))
        }}
        canModerate={canModerate}
        onExpenseUpdated={handleExpenseUpdated}
      />

      <ExpensesReportModal
        isOpen={isReportOpen}
        requests={requestsForUi}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  )
}

export function ExpensesPage(props: ExpensesPageProps) {
  return (
    <ExpensesPageBoundary>
      <ExpensesPageInner {...props} />
    </ExpensesPageBoundary>
  )
}
