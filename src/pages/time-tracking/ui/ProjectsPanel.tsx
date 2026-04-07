import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatedLink } from '@shared/ui'
import { useNavigate } from 'react-router-dom'
import {
  listTimeManagerClients,
  listClientProjects,
  isForbiddenError,
  type TimeManagerClientRow,
} from '@entities/time-tracking'
import { useCurrentUser } from '@shared/hooks'
import { canManageTimeManagerClients } from '../model/timeManagerClientsAccess'
import { mapClientProjectToProjectRow } from '../model/mapClientProjectToProjectRow'
import type { ProjectRow, ProjectStatus, ProjectType } from '../model/types'
import { getProjectDetailUrl } from '@shared/config'
import { ProjectsSkeleton } from './ProjectsSkeleton'
import { ClientProjectModal } from './TimeTrackingClientProjectModal'

function fmtAmt(n: number, cur = 'UZS') {
  return `${n.toLocaleString('ru-RU')} ${cur}`
}
function remainingPct(budget: number, spent: number) {
  return Math.round(((budget - spent) / budget) * 100)
}
function spentPct(budget: number, spent: number) {
  return Math.min((spent / budget) * 100, 100)
}

const PP_ACTIONS_MENU_MIN_W = 168

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Активные',
  paused: 'На паузе',
  archived: 'Архив',
}
const STATUS_DOT: Record<ProjectStatus, string> = {
  active: '#22c55e',
  paused: '#f59e0b',
  archived: '#94a3b8',
}
const TYPE_COLOR: Record<ProjectType, { color: string; bg: string }> = {
  'Время и материалы': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
  'Фиксированная ставка': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  'Без бюджета': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}
const STATUS_OPTIONS: ProjectStatus[] = ['active', 'paused', 'archived']

const IcoChevron = ({ cls = '' }: { cls?: string }) => (
  <svg
    className={cls}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)
const IcoPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const IcoCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const IcoFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

function StatusDropdown({
  statusFilter,
  filteredCount,
  totalBeforeStatus,
  statusCounts,
  onSelect,
}: {
  statusFilter: ProjectStatus | ''
  filteredCount: number
  totalBeforeStatus: number
  statusCounts: Record<ProjectStatus, number>
  onSelect: (s: ProjectStatus | '') => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const label = statusFilter
    ? `${STATUS_LABEL[statusFilter]} (${filteredCount})`
    : `Все проекты (${filteredCount})`
  return (
    <div ref={ref} className="pp__status-wrap">
      <button type="button" className="pp__status-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label} <IcoChevron cls={`pp__status-chevron${open ? ' pp__status-chevron--open' : ''}`} />
      </button>
      {open && (
        <div className="pp__status-dropdown">
          <button
            type="button"
            className={`pp__status-opt${!statusFilter ? ' pp__status-opt--on' : ''}`}
            onClick={() => {
              onSelect('')
              setOpen(false)
            }}
          >
            {!statusFilter && <IcoCheck />} Все проекты ({totalBeforeStatus})
          </button>
          {STATUS_OPTIONS.map((s) => {
            const cnt = statusCounts[s]
            return (
              <button
                key={s}
                type="button"
                className={`pp__status-opt${statusFilter === s ? ' pp__status-opt--on' : ''}`}
                onClick={() => {
                  onSelect(s)
                  setOpen(false)
                }}
              >
                <span className="pp__status-dot" style={{ background: STATUS_DOT[s] }} />
                {statusFilter === s && <IcoCheck />} {STATUS_LABEL[s]} ({cnt})
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const active = !!value
  return (
    <div ref={ref} className="pp__filter-wrap">
      <button
        type="button"
        className={`pp__filter-btn${active ? ' pp__filter-btn--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {value || label}
        <IcoChevron cls={`pp__filter-chevron${open ? ' pp__filter-chevron--open' : ''}`} />
      </button>
      {open && (
        <div className="pp__filter-menu">
          <button
            type="button"
            className={`pp__filter-opt${!value ? ' pp__filter-opt--on' : ''}`}
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            {!value && <IcoCheck />} Все
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`pp__filter-opt${value === opt ? ' pp__filter-opt--on' : ''}`}
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
            >
              {value === opt && <IcoCheck />} {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BudgetBar({ budget, spent }: { budget: number; spent: number }) {
  const over = spent > budget
  const bluePct = over ? 100 : spentPct(budget, spent)
  const redPct = over ? Math.min(((spent - budget) / budget) * 80, 45) : 0
  return (
    <div className="pp__bar-wrap" title={`Потрачено: ${fmtAmt(spent)} / Бюджет: ${fmtAmt(budget)}`}>
      <div className="pp__bar">
        <div className="pp__bar-fill pp__bar-fill--blue" style={{ width: `${bluePct}%` }} />
        {over && <div className="pp__bar-fill pp__bar-fill--red" style={{ width: `${redPct}%` }} />}
      </div>
    </div>
  )
}

export function ProjectsPanel() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const canManage = canManageTimeManagerClients(user?.role)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [apiClients, setApiClients] = useState<TimeManagerClientRow[]>([])

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('active')
  const [clientFilter, setClientFilter] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [actionOpen, setActionOpen] = useState<string | null>(null)
  const [menuPlacement, setMenuPlacement] = useState<{
    top: number
    left: number
    minWidth: number
  } | null>(null)
  const actionRef = useRef<HTMLDivElement>(null)
  const menuPortalRef = useRef<HTMLDivElement>(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalKey, setCreateModalKey] = useState(0)

  const reloadProjects = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const clients = await listTimeManagerClients()
      clients.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
      setApiClients(clients)
      const out: ProjectRow[] = []
      for (const c of clients) {
        try {
          const projs = await listClientProjects(c.id)
          for (const p of projs) {
            out.push(mapClientProjectToProjectRow(p, c))
          }
        } catch (e) {
          if (!isForbiddenError(e)) throw e
        }
      }
      setRows(out)
    } catch (e) {
      setRows([])
      setApiClients([])
      setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить проекты')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadProjects()
  }, [reloadProjects])

  const clientNames = useMemo(() => [...new Set(rows.map((p) => p.client))].sort(), [rows])
  const managers = useMemo(() => {
    const all = rows.flatMap((p) => p.managers ?? [])
    return [...new Set(all)].sort()
  }, [rows])

  const baseFiltered = useMemo(
    () =>
      rows.filter((p) => {
        if (clientFilter && p.client !== clientFilter) return false
        if (managerFilter && !(p.managers ?? []).includes(managerFilter)) return false
        return true
      }),
    [rows, clientFilter, managerFilter],
  )

  const statusCounts = useMemo(
    () => ({
      active: baseFiltered.filter((p) => p.status === 'active').length,
      paused: baseFiltered.filter((p) => p.status === 'paused').length,
      archived: baseFiltered.filter((p) => p.status === 'archived').length,
    }),
    [baseFiltered],
  )

  const filtered = useMemo(
    () => baseFiltered.filter((p) => !statusFilter || p.status === statusFilter),
    [baseFiltered, statusFilter],
  )

  const fixedClientIdForCreate = useMemo(() => {
    if (!clientFilter) return null
    const c = apiClients.find((x) => x.name === clientFilter)
    return c?.id ?? null
  }, [clientFilter, apiClients])

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectRow[]>()
    for (const p of filtered) {
      if (!map.has(p.client)) map.set(p.client, [])
      map.get(p.client)!.push(p)
    }
    return Array.from(map.entries())
  }, [filtered])

  const openActionProject = useMemo(
    () => (actionOpen ? rows.find((r) => r.id === actionOpen) ?? null : null),
    [actionOpen, rows],
  )

  useEffect(() => {
    if (actionOpen && !rows.some((r) => r.id === actionOpen)) setActionOpen(null)
  }, [actionOpen, rows])

  useLayoutEffect(() => {
    if (!actionOpen) {
      setMenuPlacement(null)
      return
    }
    const wrap = actionRef.current
    const btn = wrap?.querySelector('.pp__actions-btn')
    if (!(btn instanceof HTMLElement)) {
      setMenuPlacement(null)
      return
    }
    const r = btn.getBoundingClientRect()
    const w = Math.max(PP_ACTIONS_MENU_MIN_W, r.width)
    let left = r.right - w
    const maxL = window.innerWidth - w - 8
    left = Math.max(8, Math.min(left, maxL))
    setMenuPlacement({ top: r.bottom + 5, left, minWidth: w })
  }, [actionOpen])

  useEffect(() => {
    if (!actionOpen) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (actionRef.current?.contains(t)) return
      if (menuPortalRef.current?.contains(t)) return
      setActionOpen(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [actionOpen])

  useEffect(() => {
    if (!actionOpen) return
    const close = () => setActionOpen(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [actionOpen])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function toggleCollapse(client: string) {
    setCollapsed((prev) => {
      const n = new Set(prev)
      n.has(client) ? n.delete(client) : n.add(client)
      return n
    })
  }

  function openCreateModal() {
    setCreateModalKey((k) => k + 1)
    setCreateModalOpen(true)
  }

  if (loading) return <ProjectsSkeleton />

  return (
    <div className="pp">
      {loadError && (
        <p className="tt-settings__banner-error pp__load-error" role="alert">
          {loadError}
        </p>
      )}
      <div className="pp__topbar">
        <div className="pp__topbar-left">
          <h1 className="pp__title">Проекты</h1>
          <StatusDropdown
            statusFilter={statusFilter}
            filteredCount={filtered.length}
            totalBeforeStatus={baseFiltered.length}
            statusCounts={statusCounts}
            onSelect={setStatusFilter}
          />
        </div>
        <div className="pp__topbar-right">
          <FilterDropdown label="По клиенту" options={clientNames} value={clientFilter} onChange={setClientFilter} />
          {managers.length > 0 && (
            <FilterDropdown label="По менеджеру" options={managers} value={managerFilter} onChange={setManagerFilter} />
          )}
          <button
            type="button"
            className="pp__new-btn"
            disabled={!canManage || apiClients.length === 0}
            title={
              !canManage
                ? 'Доступно главному администратору, администратору и партнёру'
                : apiClients.length === 0
                  ? 'Сначала добавьте клиента'
                  : undefined
            }
            onClick={openCreateModal}
          >
            <IcoPlus /> Новый проект
          </button>
        </div>
      </div>
      <div className="pp__table-wrap">
        <div className="pp__table">
          <div className="pp__thead">
            <span className="pp__th pp__th--check">
              <span className="pp__checkbox" />
            </span>
            <span className="pp__th pp__th--name">Клиент / Проект</span>
            <span className="pp__th pp__th--budget">Бюджет</span>
            <span className="pp__th pp__th--spent">Потрачено</span>
            <span className="pp__th pp__th--bar" />
            <span className="pp__th pp__th--remaining">Остаток</span>
            <span className="pp__th pp__th--costs">Затраты</span>
            <span className="pp__th pp__th--actions" />
          </div>
          {grouped.length === 0 && (
            <div className="pp__empty">
              <IcoFolder />
              <span>
                {rows.length === 0
                  ? 'Нет проектов. Создайте первый через «Новый проект».'
                  : 'Нет проектов по выбранным фильтрам'}
              </span>
            </div>
          )}
          {grouped.map(([client, projects]) => {
            const isCollapsed = collapsed.has(client)
            const groupTotal = projects.reduce((s, p) => s + p.spent, 0)
            return (
              <div key={client} className={`pp__group${isCollapsed ? ' pp__group--collapsed' : ''}`}>
                <div
                  className="pp__client-row"
                  onClick={() => toggleCollapse(client)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isCollapsed}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCollapse(client)}
                >
                  <span className={`pp__client-chevron${!isCollapsed ? ' pp__client-chevron--open' : ''}`}>
                    <IcoChevron />
                  </span>
                  <span className="pp__client-name">{client}</span>
                  <span className="pp__client-meta">
                    {projects.length} {projects.length === 1 ? 'проект' : projects.length < 5 ? 'проекта' : 'проектов'}
                  </span>
                  {isCollapsed && (
                    <span className="pp__client-total">{fmtAmt(groupTotal, projects[0].currency)}</span>
                  )}
                </div>
                {!isCollapsed &&
                  projects.map((p) => {
                    const hasBudget = p.budget != null
                    const over = hasBudget && p.spent > p.budget!
                    const rem = hasBudget ? p.budget! - p.spent : null
                    const pct = hasBudget ? remainingPct(p.budget!, p.spent) : null
                    const typeMeta = TYPE_COLOR[p.type]
                    const isSelected = selectedIds.has(p.id)
                    const isActOpen = actionOpen === p.id

                    return (
                      <div
                        key={p.id}
                        className={`pp__row${isSelected ? ' pp__row--selected' : ''}`}
                        onClick={() => navigate(getProjectDetailUrl(p.id, p.clientId))}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="pp__td pp__td--check" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`pp__checkbox${isSelected ? ' pp__checkbox--on' : ''}`}
                            onClick={() => toggleSelect(p.id)}
                            role="checkbox"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onKeyDown={(e) => e.key === ' ' && toggleSelect(p.id)}
                          >
                            {isSelected && <IcoCheck />}
                          </span>
                        </span>
                        <span className="pp__td pp__td--name">
                          <AnimatedLink className="pp__proj-name pp__proj-name--link" to={getProjectDetailUrl(p.id, p.clientId)}>
                            <span className="pp__proj-dot" style={{ background: STATUS_DOT[p.status] }} />
                            {p.name}
                          </AnimatedLink>
                          <span className="pp__type-badge" style={{ color: typeMeta.color, background: typeMeta.bg }}>
                            {p.type}
                          </span>
                        </span>
                        <span className="pp__td pp__td--budget">
                          {hasBudget ? fmtAmt(p.budget!, p.currency) : <span className="pp__dash">—</span>}
                        </span>
                        <span className="pp__td pp__td--spent">
                          {p.spent > 0 ? fmtAmt(p.spent, p.currency) : <span className="pp__dash">—</span>}
                        </span>
                        <span className="pp__td pp__td--bar">
                          {hasBudget && p.spent > 0 && <BudgetBar budget={p.budget!} spent={p.spent} />}
                        </span>
                        <span className={`pp__td pp__td--remaining${over ? ' pp__td--over' : ''}`}>
                          {rem != null ? (
                            <>
                              <span className="pp__rem-val">
                                {over ? '−' : ''}
                                {fmtAmt(Math.abs(rem), p.currency)}
                              </span>
                              {pct != null && (
                                <span className={`pp__rem-pct${over ? ' pp__rem-pct--over' : ''}`}>
                                  ({over ? '-' : ''}
                                  {Math.abs(pct)}%)
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="pp__dash">—</span>
                          )}
                        </span>
                        <span className="pp__td pp__td--costs">
                          {p.costs > 0 ? (
                            <span className="pp__costs-val">{fmtAmt(p.costs, p.currency)}</span>
                          ) : (
                            <span className="pp__zero">0,00 {p.currency}</span>
                          )}
                        </span>
                        <span className="pp__td pp__td--actions" onClick={(e) => e.stopPropagation()}>
                          <div className="pp__actions-wrap" ref={isActOpen ? actionRef : undefined}>
                            <button
                              type="button"
                              className={`pp__actions-btn${isActOpen ? ' pp__actions-btn--open' : ''}`}
                              onClick={() => setActionOpen(isActOpen ? null : p.id)}
                            >
                              Действия <IcoChevron cls={`pp__actions-chevron${isActOpen ? ' pp__actions-chevron--open' : ''}`} />
                            </button>
                          </div>
                        </span>
                      </div>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </div>

      {createModalOpen && (
        <ClientProjectModal
          key={createModalKey}
          mode="create"
          fixedClientId={fixedClientIdForCreate}
          clientsForPicker={fixedClientIdForCreate ? undefined : apiClients}
          initial={null}
          onClose={() => setCreateModalOpen(false)}
          onSaved={(row) => {
            const c = apiClients.find((x) => x.id === row.client_id)
            if (c) {
              setRows((prev) => [...prev, mapClientProjectToProjectRow(row, c)])
            } else {
              void reloadProjects()
            }
            setCreateModalOpen(false)
          }}
        />
      )}

      {actionOpen &&
        menuPlacement &&
        openActionProject &&
        createPortal(
          <div
            ref={menuPortalRef}
            className="pp__actions-menu pp__actions-menu--portal"
            style={{
              top: menuPlacement.top,
              left: menuPlacement.left,
              minWidth: menuPlacement.minWidth,
            }}
            role="menu"
          >
            <button type="button" className="pp__actions-item" onClick={() => setActionOpen(null)}>
              Редактировать
            </button>
            <button type="button" className="pp__actions-item" onClick={() => setActionOpen(null)}>
              Открыть
            </button>
            <button type="button" className="pp__actions-item" onClick={() => setActionOpen(null)}>
              {openActionProject.status === 'archived' ? 'Восстановить' : 'В архив'}
            </button>
            <div className="pp__actions-sep" />
            <button type="button" className="pp__actions-item pp__actions-item--danger" onClick={() => setActionOpen(null)}>
              Удалить
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
