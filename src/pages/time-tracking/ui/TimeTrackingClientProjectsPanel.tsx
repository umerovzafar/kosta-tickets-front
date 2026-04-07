import { useState, useEffect, useCallback } from 'react'
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
        if (prev && rows.some((c) => c.id === prev)) return prev
        return rows[0]?.id ?? ''
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
    if (!cid) {
      setProjects([])
      return
    }
    setProjectsLoading(true)
    setProjectsError(null)
    try {
      const rows = await listClientProjects(cid)
      rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
      setProjects(rows)
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
      if (idx < 0) {
        const next = [...prev, row]
        next.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
        return next
      }
      const next = [...prev]
      next[idx] = row
      return next
    })
  }

  const handleDelete = async (p: TimeManagerClientProjectRow) => {
    if (!p.deletable && p.usage_count > 0) {
      window.alert('Проект нельзя удалить: есть записи времени.')
      return
    }
    if (!window.confirm(`Удалить проект «${p.name}»?`)) return
    try {
      await deleteClientProject(clientId, p.id)
      setProjects((prev) => prev.filter((x) => x.id !== p.id))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  const selectedClient = clients.find((c) => c.id === clientId)

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
              clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          type="button"
          className="tt-settings__btn tt-settings__btn--primary tt-projects-page__toolbar-cta"
          disabled={!canManage || !clientId}
          title={!canManage ? 'Доступно главному администратору, администратору и партнёру' : undefined}
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

      {!projectsError && selectedClient && (
        <h2 className="tt-tasks-page__list-heading">
          Проекты <span className="tt-tasks-page__list-heading-client">{selectedClient.name}</span>
        </h2>
      )}

      {!projectsError && (
        <div className="tt-settings__list tt-tasks-page__list">
          {projectsLoading && (
            <div className="tt-settings__list-loading" role="status">
              Загрузка проектов…
            </div>
          )}
          {!projectsLoading && clientId && projects.length === 0 && (
            <div className="tt-settings__rates-empty tt-settings__list-empty-inner tt-tasks-page__empty">
              Для этого клиента пока нет проектов. Нажмите «Новый проект».
            </div>
          )}
          {!projectsLoading &&
            projects.map((p) => (
              <div key={p.id} className="tt-settings__list-row tt-task-card tt-project-card">
                <div className="tt-task-card__body">
                  <h3 className="tt-task-card__title">
                    {p.name}
                    {p.code ? <span className="tt-project-card__code">{p.code}</span> : null}
                  </h3>
                  <p className="tt-task-card__rate tt-project-card__meta">
                    {PROJECT_TYPE_LABEL[p.project_type] ?? p.project_type}
                    {' · '}
                    {formatDateShort(p.start_date)} — {formatDateShort(p.end_date)}
                    {p.usage_count > 0 ? ` · записей времени: ${p.usage_count}` : ''}
                  </p>
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

      {modal && clientId && (
        <ClientProjectModal
          key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'}
          mode={modal.mode}
          fixedClientId={clientId}
          initial={modal.row}
          onClose={() => setModal(null)}
          onSaved={onProjectSaved}
        />
      )}
    </div>
  )
}
