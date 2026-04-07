import { useState, useEffect, useCallback, useId } from 'react'
import {
  listTimeManagerClients,
  listClientExpenseCategories,
  createClientExpenseCategory,
  patchClientExpenseCategory,
  deleteClientExpenseCategory,
  isForbiddenError,
  type TimeManagerClientRow,
  type TimeManagerClientExpenseCategoryRow,
} from '@entities/time-tracking'
import { useCurrentUser } from '@shared/hooks'
import { canManageTimeManagerClients } from '../model/timeManagerClientsAccess'

function sortCategories(a: TimeManagerClientExpenseCategoryRow, b: TimeManagerClientExpenseCategoryRow): number {
  const oa = a.sort_order ?? 9999
  const ob = b.sort_order ?? 9999
  if (oa !== ob) return oa - ob
  return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
}

type CatFormState = {
  name: string
  hasUnitPrice: boolean
  isArchived: boolean
  sortOrder: string
}

function emptyCatForm(): CatFormState {
  return {
    name: '',
    hasUnitPrice: false,
    isArchived: false,
    sortOrder: '',
  }
}

function rowToCatForm(c: TimeManagerClientExpenseCategoryRow): CatFormState {
  return {
    name: c.name,
    hasUnitPrice: c.has_unit_price,
    isArchived: c.is_archived,
    sortOrder: c.sort_order != null ? String(c.sort_order) : '',
  }
}

type ExpenseCatModalProps = {
  mode: 'create' | 'edit'
  clientId: string
  initial: TimeManagerClientExpenseCategoryRow | null
  onClose: () => void
  onSaved: (row: TimeManagerClientExpenseCategoryRow) => void
}

function ExpenseCategoryModal({ mode, clientId, initial, onClose, onSaved }: ExpenseCatModalProps) {
  const uid = useId()
  const [form, setForm] = useState<CatFormState>(() => (initial ? rowToCatForm(initial) : emptyCatForm()))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    const name = form.name.trim()
    if (!name) {
      setError('Укажите название категории')
      return
    }
    let sortOrder: number | null = null
    const sortRaw = form.sortOrder.trim()
    if (sortRaw) {
      const n = parseInt(sortRaw, 10)
      if (Number.isNaN(n)) {
        setError('Порядок сортировки — целое число')
        return
      }
      sortOrder = n
    }
    setError(null)
    setSaving(true)
    try {
      if (mode === 'create') {
        const row = await createClientExpenseCategory(clientId, {
          name,
          hasUnitPrice: form.hasUnitPrice,
          sortOrder,
        })
        onSaved(row)
      } else if (initial) {
        const row = await patchClientExpenseCategory(clientId, initial.id, {
          name,
          hasUnitPrice: form.hasUnitPrice,
          isArchived: form.isArchived,
          sortOrder,
        })
        onSaved(row)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tt-tm-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="tt-tm-modal tt-tm-modal--task"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-ecat-title`}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-ecat-title`} className="tt-tm-modal__title">
            {mode === 'create' ? 'Новая категория расходов' : 'Редактировать категорию'}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-cname`}>
              Название <span className="tt-tm-req">*</span>
            </label>
            <input
              id={`${uid}-cname`}
              className="tt-tm-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <p className="tt-tm-hint">Имя уникально среди активных категорий этого клиента.</p>
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-sort`}>
              Порядок сортировки
            </label>
            <input
              id={`${uid}-sort`}
              type="number"
              className="tt-tm-input"
              placeholder="необязательно"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </div>
          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">Параметры</legend>
            <label className="tt-tm-check-row">
              <input
                type="checkbox"
                checked={form.hasUnitPrice}
                onChange={(e) => setForm((f) => ({ ...f, hasUnitPrice: e.target.checked }))}
              />
              <span>У расхода есть цена за единицу</span>
            </label>
            {mode === 'edit' && (
              <label className="tt-tm-check-row">
                <input
                  type="checkbox"
                  checked={form.isArchived}
                  onChange={(e) => setForm((f) => ({ ...f, isArchived: e.target.checked }))}
                />
                <span>В архиве</span>
              </label>
            )}
          </fieldset>
          {error && (
            <p className="tt-tm-field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="tt-tm-modal__foot">
          <button type="button" className="tt-settings__btn tt-settings__btn--ghost" disabled={saving} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="tt-settings__btn tt-settings__btn--primary"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? 'Сохранение…' : mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TimeTrackingClientExpenseCategoriesPanel() {
  const { user } = useCurrentUser()
  const canManage = canManageTimeManagerClients(user?.role)

  const [clients, setClients] = useState<TimeManagerClientRow[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientsError, setClientsError] = useState<string | null>(null)

  const [clientId, setClientId] = useState<string>('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [categories, setCategories] = useState<TimeManagerClientExpenseCategoryRow[]>([])
  const [catLoading, setCatLoading] = useState(false)
  const [catError, setCatError] = useState<string | null>(null)

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: TimeManagerClientExpenseCategoryRow | null } | null>(
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

  const loadCategories = useCallback(async (cid: string, archived: boolean) => {
    if (!cid) {
      setCategories([])
      return
    }
    setCatLoading(true)
    setCatError(null)
    try {
      const rows = await listClientExpenseCategories(cid, { includeArchived: archived })
      rows.sort(sortCategories)
      setCategories(rows)
    } catch (e) {
      if (isForbiddenError(e)) {
        setCatError('Недостаточно прав для просмотра категорий.')
      } else {
        setCatError(e instanceof Error ? e.message : 'Не удалось загрузить категории')
      }
      setCategories([])
    } finally {
      setCatLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCategories(clientId, includeArchived)
  }, [clientId, includeArchived, loadCategories])

  const onSaved = (row: TimeManagerClientExpenseCategoryRow) => {
    setCategories((prev) => {
      const idx = prev.findIndex((x) => x.id === row.id)
      if (idx < 0) {
        const next = [...prev, row]
        next.sort(sortCategories)
        return next
      }
      const next = [...prev]
      next[idx] = row
      next.sort(sortCategories)
      return next
    })
  }

  const handleDelete = async (cat: TimeManagerClientExpenseCategoryRow) => {
    if (!cat.deletable) return
    if (!window.confirm(`Удалить категорию «${cat.name}»?`)) return
    try {
      await deleteClientExpenseCategory(clientId, cat.id)
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  const selectedClient = clients.find((c) => c.id === clientId)

  return (
    <div className="tt-settings__content">
      <h1 className="tt-settings__page-title">Категории расходов</h1>
      <p className="tt-settings__desc">
        Справочник категорий привязан к клиенту: выберите клиента, при необходимости включите показ архивных записей.
        Удаление возможно только при нулевом счётчике использования; иначе архивируйте категорию.
      </p>

      {clientsError && (
        <p className="tt-settings__banner-error" role="alert">
          {clientsError}
        </p>
      )}

      <div className="tt-task-client-bar">
        <label className="tt-task-client-bar__label" htmlFor="tt-ecat-client-select">
          Клиент
        </label>
        <select
          id="tt-ecat-client-select"
          className="tt-task-client-select"
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
        <label className="tt-ecat-archive-toggle">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          <span>Показать архивные</span>
        </label>
      </div>

      <div className="tt-settings__actions-row tt-settings__actions-row--tasks">
        <div className="tt-settings__toolbar-left">
          <button
            type="button"
            className="tt-settings__btn tt-settings__btn--primary"
            disabled={!canManage || !clientId}
            title={!canManage ? 'Доступно главному администратору, администратору и партнёру' : undefined}
            onClick={() => setModal({ mode: 'create', row: null })}
          >
            + Новая категория
          </button>
        </div>
      </div>

      {!canManage && !clientsLoading && clients.length > 0 && (
        <p className="tt-settings__banner-info" role="status">
          Режим просмотра: изменять категории могут главный администратор, администратор и партнёр.
        </p>
      )}

      {catError && (
        <p className="tt-settings__banner-error" role="alert">
          {catError}
        </p>
      )}

      {selectedClient && (
        <p className="tt-settings__task-client-caption">
          Категории клиента: <strong>{selectedClient.name}</strong>
        </p>
      )}

      {!catError && (
        <div className="tt-settings__list">
          {catLoading && (
            <div className="tt-settings__list-loading" role="status">
              Загрузка категорий…
            </div>
          )}
          {!catLoading && clientId && categories.length === 0 && (
            <div className="tt-settings__rates-empty tt-settings__list-empty-inner">
              Для этого клиента пока нет категорий. Нажмите «Новая категория».
            </div>
          )}
          {!catLoading &&
            categories.map((c) => (
              <div key={c.id} className="tt-settings__list-row tt-settings__list-row--client tt-settings__list-row--task">
                <div className="tt-settings__client-block">
                  <span className="tt-settings__row-name">
                    {c.name}
                    {c.is_archived && <span className="tt-ecat-badge tt-ecat-badge--arch">Архив</span>}
                  </span>
                  <span className="tt-settings__client-meta">
                    {c.has_unit_price ? 'С ценой за единицу' : 'Без цены за единицу'}
                    {c.sort_order != null ? ` · порядок ${c.sort_order}` : ''}
                    {` · использований: ${c.usage_count}`}
                    {!c.deletable && ' · удаление недоступно — архивируйте'}
                  </span>
                </div>
                <div className="tt-settings__client-actions">
                  <button
                    type="button"
                    className="tt-settings__row-edit"
                    disabled={!canManage}
                    onClick={() => setModal({ mode: 'edit', row: c })}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className="tt-settings__row-edit tt-settings__row-edit--danger"
                    disabled={!canManage || !c.deletable}
                    title={!c.deletable ? 'Сначала архив или дождитесь нулевого использования' : undefined}
                    onClick={() => void handleDelete(c)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {modal && clientId && (
        <ExpenseCategoryModal
          key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'}
          mode={modal.mode}
          clientId={clientId}
          initial={modal.row}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
