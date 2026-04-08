import { useState, useEffect, useMemo } from 'react'
import { getUsers } from '@entities/user'
import { useCurrentUser } from '@shared/hooks'
import { canManageUserProjectAccess } from '../model/timeManagerClientsAccess'
import { TimeUserProjectAccessModal } from './TimeUserProjectAccessModal'

type PickerRow = { id: number; name: string }

const IcoSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

export function TimeTrackingProjectAccessPanel() {
  const { user: currentUser } = useCurrentUser()
  const [rows, setRows] = useState<PickerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [modalUser, setModalUser] = useState<PickerRow | null>(null)

  const canSaveProjectAccess = canManageUserProjectAccess(
    currentUser?.role,
    currentUser?.time_tracking_role ?? null,
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getUsers()
      .then((users) => {
        if (cancelled) return
        const list = users
          .filter((u) => u.time_tracking_role != null)
          .map((u) => ({
            id: u.id,
            name: (u.display_name ?? u.email).trim() || `Пользователь #${u.id}`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        setRows(list)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось загрузить пользователей')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, query])

  return (
    <div className="tt-settings__content tt-project-access-settings">
      <h1 className="tt-settings__page-title">Доступ к проектам</h1>
      <p className="tt-settings__desc">
        Какие клиентские проекты видит сотрудник в учёте времени. Совпадает с вкладкой «Проекты» в редактировании
        пользователя.
      </p>

      {error && (
        <p className="tt-settings__banner-error" role="alert">
          {error}
        </p>
      )}

      <div className="tt-settings__actions-row">
        <div className="tt-settings__search-wrap">
          <span className="tt-settings__search-icon" aria-hidden>
            <IcoSearch />
          </span>
          <input
            type="search"
            className="tt-settings__search"
            placeholder="Поиск по имени…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
        </div>
      </div>

      {loading ? (
        <div className="tt-settings__list-loading" role="status">
          Загрузка…
        </div>
      ) : filtered.length === 0 ? (
        <div className="tt-settings__rates-empty tt-settings__list-empty-inner">
          {rows.length === 0
            ? 'Нет сотрудников с ролью в учёте времени'
            : 'Никого не найдено по запросу'}
        </div>
      ) : (
        <div className="tt-settings__list tt-settings__list--simple">
          {filtered.map((r) => (
            <div key={r.id} className="tt-settings__list-row tt-settings__list-row--simple">
              <span className="tt-settings__row-name">{r.name}</span>
              <button type="button" className="tt-settings__row-edit" onClick={() => setModalUser(r)}>
                Доступ к проектам
              </button>
            </div>
          ))}
        </div>
      )}

      {modalUser && (
        <TimeUserProjectAccessModal
          authUserId={modalUser.id}
          userLabel={modalUser.name}
          canSave={canSaveProjectAccess}
          onClose={() => setModalUser(null)}
        />
      )}
    </div>
  )
}
