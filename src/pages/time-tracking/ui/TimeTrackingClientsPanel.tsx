import { useState, useMemo, useEffect, useRef, useCallback, useId } from 'react'
import {
  listTimeManagerClients,
  createTimeManagerClient,
  patchTimeManagerClient,
  deleteTimeManagerClient,
  isForbiddenError,
  type TimeManagerClientRow,
} from '@entities/time-tracking'
import { useCurrentUser } from '@shared/hooks'
import { canManageTimeManagerClients } from '../model/timeManagerClientsAccess'

const CURRENCIES = ['USD', 'EUR', 'UZS', 'RUB', 'GBP'] as const

const IcoSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)
const IcoChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
)
const IcoArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

function pctToInput(v: string | number | null | undefined): string {
  if (v == null || v === '') return ''
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? String(n) : ''
}

function parseOptionalPercent(s: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = s.trim()
  if (!t) return { ok: true, value: null }
  const n = parseFloat(t.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, message: 'Проценты должны быть числом от 0 до 100' }
  }
  return { ok: true, value: n }
}

type FormState = {
  name: string
  address: string
  currency: string
  invoiceDueMode: string
  invoiceDueDaysAfterIssue: string
  taxPercent: string
  tax2Percent: string
  discountPercent: string
}

function emptyForm(): FormState {
  return {
    name: '',
    address: '',
    currency: 'USD',
    invoiceDueMode: 'custom',
    invoiceDueDaysAfterIssue: '15',
    taxPercent: '',
    tax2Percent: '',
    discountPercent: '',
  }
}

function rowToForm(c: TimeManagerClientRow): FormState {
  return {
    name: c.name,
    address: c.address ?? '',
    currency: c.currency || 'USD',
    invoiceDueMode: c.invoice_due_mode || 'custom',
    invoiceDueDaysAfterIssue:
      c.invoice_due_days_after_issue != null ? String(c.invoice_due_days_after_issue) : '',
    taxPercent: pctToInput(c.tax_percent),
    tax2Percent: pctToInput(c.tax2_percent),
    discountPercent: pctToInput(c.discount_percent),
  }
}

function formatClientMeta(c: TimeManagerClientRow): string {
  const parts: string[] = [c.currency]
  const t1 = pctToInput(c.tax_percent)
  if (t1) parts.push(`налог ${t1}%`)
  const t2 = pctToInput(c.tax2_percent)
  if (t2) parts.push(`налог 2: ${t2}%`)
  const d = pctToInput(c.discount_percent)
  if (d) parts.push(`скидка ${d}%`)
  if (c.invoice_due_mode === 'custom' && c.invoice_due_days_after_issue != null) {
    parts.push(`оплата через ${c.invoice_due_days_after_issue} дн.`)
  } else if (c.invoice_due_days_after_issue != null) {
    parts.push(`оплата: ${c.invoice_due_mode}, ${c.invoice_due_days_after_issue} дн.`)
  }
  return parts.join(' · ')
}

type ClientModalProps = {
  mode: 'create' | 'edit'
  initial: TimeManagerClientRow | null
  onClose: () => void
  onSaved: (row: TimeManagerClientRow) => void
}

function TimeManagerClientModal({ mode, initial, onClose, onSaved }: ClientModalProps) {
  const uid = useId()
  const [form, setForm] = useState<FormState>(() => (initial ? rowToForm(initial) : emptyForm()))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    const name = form.name.trim()
    if (!name) {
      setError('Укажите название клиента')
      return
    }
    const daysRaw = form.invoiceDueDaysAfterIssue.trim()
    let days: number | null = null
    if (daysRaw) {
      const d = parseInt(daysRaw, 10)
      if (Number.isNaN(d) || d < 0 || d > 3650) {
        setError('Срок оплаты (дни): целое число от 0 до 3650')
        return
      }
      days = d
    }
    const tp = parseOptionalPercent(form.taxPercent)
    const t2 = parseOptionalPercent(form.tax2Percent)
    const dp = parseOptionalPercent(form.discountPercent)
    if (!tp.ok) {
      setError(tp.message)
      return
    }
    if (!t2.ok) {
      setError(t2.message)
      return
    }
    if (!dp.ok) {
      setError(dp.message)
      return
    }
    setError(null)
    setSaving(true)
    try {
      if (mode === 'create') {
        const row = await createTimeManagerClient({
          name,
          address: form.address.trim() || null,
          currency: form.currency.trim() || 'USD',
          invoiceDueMode: form.invoiceDueMode.trim() || 'custom',
          invoiceDueDaysAfterIssue: days,
          taxPercent: tp.value,
          tax2Percent: t2.value,
          discountPercent: dp.value,
        })
        onSaved(row)
      } else if (initial) {
        const row = await patchTimeManagerClient(initial.id, {
          name,
          address: form.address.trim() || null,
          currency: form.currency.trim() || 'USD',
          invoiceDueMode: form.invoiceDueMode.trim() || 'custom',
          invoiceDueDaysAfterIssue: days,
          taxPercent: tp.value,
          tax2Percent: t2.value,
          discountPercent: dp.value,
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
        className="tt-tm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-title`} className="tt-tm-modal__title">
            {mode === 'create' ? 'Новый клиент' : 'Редактировать клиента'}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-name`}>
              Название клиента <span className="tt-tm-req">*</span>
            </label>
            <input
              id={`${uid}-name`}
              className="tt-tm-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoComplete="organization"
            />
          </div>
          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-addr`}>
              Адрес
            </label>
            <textarea
              id={`${uid}-addr`}
              className="tt-tm-textarea"
              rows={2}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div className="tt-tm-field-row tt-tm-field-row--grid-3" role="group" aria-label="Валюта и срок оплаты">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-cur`}>
                Валюта счёта
              </label>
              <select
                id={`${uid}-cur`}
                className="tt-tm-select"
                value={CURRENCIES.includes(form.currency as (typeof CURRENCIES)[number]) ? form.currency : 'USD'}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-mode`}>
                Срок оплаты
              </label>
              <select
                id={`${uid}-mode`}
                className="tt-tm-select"
                value={form.invoiceDueMode}
                onChange={(e) => setForm((f) => ({ ...f, invoiceDueMode: e.target.value }))}
                title="Режим invoiceDueMode: custom — N дней после даты счёта"
              >
                <option value="custom">После даты счёта</option>
              </select>
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-days`} title="Число дней после выставления счёта">
                Дней после счёта
              </label>
              <input
                id={`${uid}-days`}
                type="number"
                min={0}
                max={3650}
                className="tt-tm-input"
                placeholder="15"
                value={form.invoiceDueDaysAfterIssue}
                onChange={(e) => setForm((f) => ({ ...f, invoiceDueDaysAfterIssue: e.target.value }))}
              />
            </div>
          </div>
          <div className="tt-tm-field-row tt-tm-field-row--grid-3" role="group" aria-label="Налоги и скидка">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-tax`}>
                Налог, %
              </label>
              <input
                id={`${uid}-tax`}
                type="text"
                inputMode="decimal"
                className="tt-tm-input"
                placeholder="напр. 12"
                value={form.taxPercent}
                onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))}
              />
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-tax2`}>
                Второй налог, %
              </label>
              <input
                id={`${uid}-tax2`}
                type="text"
                inputMode="decimal"
                className="tt-tm-input"
                placeholder="необязательно"
                value={form.tax2Percent}
                onChange={(e) => setForm((f) => ({ ...f, tax2Percent: e.target.value }))}
              />
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-disc`}>
                Скидка, %
              </label>
              <input
                id={`${uid}-disc`}
                type="text"
                inputMode="decimal"
                className="tt-tm-input"
                placeholder="напр. 5"
                value={form.discountPercent}
                onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
              />
            </div>
          </div>
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
          <button type="button" className="tt-settings__btn tt-settings__btn--primary" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Сохранение…' : mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TimeTrackingClientsPanel() {
  const { user } = useCurrentUser()
  const canManage = canManageTimeManagerClients(user?.role)

  const [clients, setClients] = useState<TimeManagerClientRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const importRef = useRef<HTMLDivElement>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: TimeManagerClientRow | null } | null>(null)

  const loadClients = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const rows = await listTimeManagerClients()
      rows.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
      setClients(rows)
    } catch (e) {
      if (isForbiddenError(e)) {
        setListError('Недостаточно прав для просмотра клиентов.')
      } else {
        setListError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов')
      }
      setClients([])
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  useEffect(() => {
    if (!importOpen) return
    const h = (e: MouseEvent) => {
      if (importRef.current && !importRef.current.contains(e.target as Node)) setImportOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [importOpen])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      const name = c.name.toLowerCase()
      const addr = (c.address ?? '').toLowerCase()
      return name.includes(q) || addr.includes(q)
    })
  }, [clients, search])

  const onSaved = (row: TimeManagerClientRow) => {
    setClients((prev) => {
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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Удалить клиента «${name}»?`)) return
    try {
      await deleteTimeManagerClient(id)
      setClients((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  return (
    <div className="tt-settings__content">
      <div className="tt-settings__header-row">
        <h1 className="tt-settings__page-title">Клиенты</h1>
        <button
          type="button"
          className="tt-settings__btn tt-settings__btn--link tt-settings__header-link"
          disabled
          title="Архив клиентов в API пока не предусмотрен"
        >
          Архивные клиенты <IcoArrowRight />
        </button>
      </div>

      <div className="tt-settings__actions-row">
        <div className="tt-settings__toolbar-left">
          <button
            type="button"
            className="tt-settings__btn tt-settings__btn--primary"
            disabled={!canManage}
            title={!canManage ? 'Доступно главному администратору, администратору и партнёру' : undefined}
            onClick={() => setModal({ mode: 'create', row: null })}
          >
            + Новый клиент
          </button>
          <button
            type="button"
            className="tt-settings__btn tt-settings__btn--outline tt-settings__btn--accent-text"
            disabled
            title="Контакты к клиентам в API пока не подключены"
          >
            + Добавить контакт
          </button>
          <div className="tt-settings__dropdown-wrap" ref={importRef}>
            <button
              type="button"
              className="tt-settings__btn tt-settings__btn--outline"
              onClick={() => setImportOpen((v) => !v)}
              aria-expanded={importOpen}
            >
              Импорт/Экспорт <IcoChevron />
            </button>
            {importOpen && (
              <div className="tt-settings__dropdown">
                <button
                  type="button"
                  className="tt-settings__dropdown-item"
                  disabled
                  title="В разработке"
                >
                  Импорт клиентов
                </button>
                <button
                  type="button"
                  className="tt-settings__dropdown-item"
                  disabled
                  title="В разработке"
                >
                  Экспорт клиентов
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="tt-settings__search-wrap">
          <span className="tt-settings__search-icon">
            <IcoSearch />
          </span>
          <input
            type="search"
            className="tt-settings__search"
            placeholder="Фильтр по названию или адресу"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Фильтр по клиенту"
          />
        </div>
      </div>

      {listError && (
        <p className="tt-settings__banner-error" role="alert">
          {listError}
        </p>
      )}

      {!listLoading && !listError && !canManage && (
        <p className="tt-settings__banner-info" role="status">
          Режим просмотра: создавать и редактировать клиентов могут главный администратор, администратор и партнёр.
        </p>
      )}

      {!listError && (
        <div className="tt-settings__list">
          {listLoading && (
            <div className="tt-settings__list-loading" role="status">
              Загрузка клиентов…
            </div>
          )}
          {!listLoading && filtered.length === 0 && (
            <div className="tt-settings__rates-empty tt-settings__list-empty-inner">
              {clients.length === 0
                ? 'Пока нет клиентов. Создайте первого кнопкой «Новый клиент».'
                : 'Ничего не найдено по фильтру.'}
            </div>
          )}
          {!listLoading &&
            filtered.map((c) => (
              <div key={c.id} className="tt-settings__list-row tt-settings__list-row--client">
                <div className="tt-settings__client-block">
                  <span className="tt-settings__row-name">{c.name}</span>
                  {c.address && <span className="tt-settings__client-address">{c.address}</span>}
                  <span className="tt-settings__client-meta">{formatClientMeta(c)}</span>
                </div>
                <div className="tt-settings__client-actions">
                  <button
                    type="button"
                    className="tt-settings__row-edit"
                    disabled={!canManage}
                    title={!canManage ? 'Недостаточно прав' : undefined}
                    onClick={() => setModal({ mode: 'edit', row: c })}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className="tt-settings__row-edit tt-settings__row-edit--danger"
                    disabled={!canManage}
                    title={!canManage ? 'Недостаточно прав' : undefined}
                    onClick={() => void handleDelete(c.id, c.name)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {modal && (
        <TimeManagerClientModal
          key={modal.mode === 'edit' && modal.row ? modal.row.id : 'create'}
          mode={modal.mode}
          initial={modal.row}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
