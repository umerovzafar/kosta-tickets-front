import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  listTimeManagerClients,
  listClientProjects,
  deleteClientProject,
  isForbiddenError,
  type TimeManagerClientRow,
  type TimeManagerClientProjectRow,
} from '@entities/time-tracking'
import { useCurrentUser } from '@shared/hooks'
import { canManageTimeManagerClients } from '../model/timeManagerClientsAccess'
import { ClientProjectModal } from './TimeTrackingClientProjectModal'

const PROJECT_TYPE_LABEL: Record<string, string> = {
  time_and_materials: 'T&M',
  fixed_fee: 'Фикс',
  non_billable: 'Не оплачиваемый',
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = String(iso).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—'
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y}`
}

function formatProjectPeriod(start: string | null | undefined, end: string | null | undefined): string {
  const s = formatDateShort(start)
  const e = formatDateShort(end)
  if (s === '—' && e === '—') return 'Сроки не заданы'
  if (e === '—') return `Старт ${s} · окончание не указано`
  if (s === '—') return `До ${e}`
  return `${s} — ${e}`
}

function sortProjectsForView(
  rows: TimeManagerClientProjectRow[],
  singleClientId: string,
  clientRows: TimeManagerClientRow[],
): TimeManagerClientProjectRow[] {
  const nameById = new Map(clientRows.map((c) => [c.id, c.name]))
  const next = [...rows]
  next.sort((a, b) => {
    if (!singleClientId && clientRows.length > 0) {
      const ca = nameById.get(a.client_id) ?? ''
      const cb = nameById.get(b.client_id) ?? ''
      const cmp = ca.localeCompare(cb, 'ru', { sensitivity: 'base' })
      if (cmp !== 0) return cmp
    }
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
  })
  return next
}

export function TimeTrackingClientProjectsPanel() {
  const { user } = useCurrentUser()
  const canManage = canManageTimeManagerClients(user?.role)

  const [clients, setClients] = useState<TimeManagerClientRow[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientsError, setClientsError] = useState<string | null>(null)

  const [clientId, setClientId] = useState<string>('')
  const [projects, setProjects] = useState<TimeManagerClientProjectRow[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: TimeManagerClientProjectRow | null } | null>(
    null,
  )

  const loadClients = useCallback(async () => {
    setClientsLoading(true)
    setClientsError(null)
    try {
      const rows = await listTimeManagerClients()
      rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
      setClients(rows)
      setClientId((prev) => {
        if (prev === '') return ''
        if (prev && rows.some((c) => c.id === prev)) return prev
        return ''
      })
    } catch (e) {
      setClients([])
      setClientsError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов')
    } finally {
      setClientsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  const loadProjects = useCallback(async (cid: string) => {
    setProjectsLoading(true)
    setProjectsError(null)
    try {
      if (!cid) {
        const allClients = await listTimeManagerClients()
        if (allClients.length === 0) {
          setProjects([])
          return
        }
        const chunks = await Promise.all(
          allClients.map((c) =>
            listClientProjects(c.id).catch((err) => {
              if (isForbiddenError(err)) throw err
              return [] as TimeManagerClientProjectRow[]
            }),
          ),
        )
        const rows = chunks.flat()
        setProjects(sortProjectsForView(rows, '', allClients))
        return
      }
      const rows = await listClientProjects(cid)
      setProjects(sortProjectsForView(rows, cid, []))
    } catch (e) {
      if (isForbiddenError(e)) {
        setProjectsError('Недостаточно прав для просмотра проектов.')
      } else {
        setProjectsError(e instanceof Error ? e.message : 'Не удалось загрузить проекты')
      }
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProjects(clientId)
  }, [clientId, loadProjects])

  const onProjectSaved = (row: TimeManagerClientProjectRow) => {
    setProjects((prev) => {
      const idx = prev.findIndex((x) => x.id === row.id)
      const next = idx < 0 ? [...prev, row] : (() => {
        const copy = [...prev]
        copy[idx] = row
        return copy
      })()
      return sortProjectsForView(next, clientId, clientId ? [] : clients)
    })
  }

  const handleDelete = async (p: TimeManagerClientProjectRow) => {
    if (!p.deletable && p.usage_count > 0) {
      window.alert('Проект нельзя удалить: есть записи времени.')
      return
    }
    if (!window.confirm(`Удалить проект «${p.name}»?`)) return
    try {
      await deleteClientProject(p.client_id, p.id)
      setProjects((prev) => prev.filter((x) => x.id !== p.id))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  const selectedClient = clients.find((c) => c.id === clientId)
  const clientNameById = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients])

  return (
    <div className="tt-settings__content tt-tasks-page tt-projects-settings">
      <h1 className="tt-settings__page-title">Проекты по клиентам</h1>

      {clientsError && (
        <p className="tt-settings__banner-error" role="alert">
          {clientsError}
        </p>
      )}

      <div className="tt-projects-page__toolbar">
        <div className="tt-projects-page__toolbar-left">
          <label className="tt-projects-page__toolbar-label" htmlFor="tt-project-client-select">
            Клиент
          </label>
          <select
            id="tt-project-client-select"
            className="tt-tasks-toolbar__select tt-projects-page__toolbar-select"
            value={clientId}
            disabled={clientsLoading || clients.length === 0}
            onChange={(e) => setClientId(e.target.value)}
          >
            {clients.length === 0 && !clientsLoading ? (
              <option value="">Нет клиентов</option>
            ) : (
              <>
                <option value="">Все клиенты</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
        <button
          type="button"
          className="tt-settings__btn tt-settings__btn--primary tt-projects-page__toolbar-cta"
          disabled={!canManage || clients.length === 0}
          title={
            !canManage
              ? 'Доступно главному администратору, администратору и партнёру'
              : clients.length === 0
                ? 'Сначала добавьте клиента'
                : !clientId
                  ? 'Выберите клиента в модальном окне'
                  : undefined
          }
          onClick={() => setModal({ mode: 'create', row: null })}
        >
          + Новый проект
        </button>
      </div>
      {!clientsLoading && clients.length === 0 && !clientsError && (
        <p className="tt-projects-page__hint">Сначала добавьте клиента на вкладке «Клиенты».</p>
      )}

      {!canManage && !clientsLoading && clients.length > 0 && (
        <p className="tt-settings__banner-info tt-tasks-page__banner" role="status">
          Режим просмотра: создавать и удалять проекты могут главный администратор, администратор и партнёр.
        </p>
      )}

      {projectsError && (
        <p className="tt-settings__banner-error" role="alert">
          {projectsError}
        </p>
      )}

      {!projectsError && clients.length > 0 && (
        <h2 className="tt-tasks-page__list-heading">
          {clientId ? (
            <>
              Проекты{' '}
              <span className="tt-tasks-page__list-heading-client">{selectedClient?.name ?? '—'}</span>
            </>
          ) : (
            <>
              Проекты <span className="tt-tasks-page__list-heading-client">всех клиентов</span>
            </>
          )}
        </h2>
      )}

      {!projectsError && (
        <div className="tt-settings__list tt-tasks-page__list">
          {projectsLoading && (
            <div className="tt-settings__list-loading" role="status">
              Загрузка проектов…
            </div>
          )}
          {!projectsLoading && projects.length === 0 && clients.length > 0 && (
            <div className="tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty">
              {clientId
                ? 'Для этого клиента пока нет проектов. Нажмите «Новый проект».'
                : 'Нет ни одного проекта ни у одного клиента. Нажмите «Новый проект».'}
            </div>
          )}
          {!projectsLoading &&
            projects.map((p) => (
              <div key={p.id} className="tt-settings__list-row tt-task-card tt-project-card">
                <div className="tt-task-card__body">
                  <div className="tt-project-card__head">
                    <h3 className="tt-task-card__title tt-project-card__title-only">{p.name}</h3>
                    {p.code ? (
                      <span className="tt-project-card__code" title="Код проекта">
                        <span className="tt-project-card__code-prefix">ID</span>
                        <span className="tt-project-card__code-value">{p.code}</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="tt-project-card__details">
                    {!clientId ? (
                      <span className="tt-task-pill tt-task-pill--muted" title="Клиент">
                        {clientNameById.get(p.client_id) ?? '—'}
                      </span>
                    ) : null}
                    <span className="tt-task-pill tt-task-pill--scope">
                      {PROJECT_TYPE_LABEL[p.project_type] ?? p.project_type}
                    </span>
                    <span className="tt-project-card__period">{formatProjectPeriod(p.start_date, p.end_date)}</span>
                    {p.usage_count > 0 ? (
                      <span className="tt-project-card__usage">Записей времени: {p.usage_count}</span>
                    ) : null}
                  </div>
                </div>
                <div className="tt-task-card__actions">
                  <button
                    type="button"
                    className="tt-task-card__btn"
                    disabled={!canManage}
                    onClick={() => setModal({ mode: 'edit', row: p })}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="tt-task-card__btn tt-task-card__btn--danger"
                    disabled={!canManage || !p.deletable}
                    title={!p.deletable ? 'Есть записи времени — удаление недоступно' : undefined}
                    onClick={() => void handleDelete(p)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {modal && (modal.mode === 'edit' ? modal.row != null : clients.length > 0) && (
        <ClientProjectModal
          key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'}
          mode={modal.mode}
          fixedClientId={modal.mode === 'create' && clientId ? clientId : null}
          clientsForPicker={modal.mode === 'create' && !clientId ? clients : undefined}
          initial={modal.row}
          onClose={() => setModal(null)}
          onSaved={onProjectSaved}
        />
      )}
    </div>
  )
}
