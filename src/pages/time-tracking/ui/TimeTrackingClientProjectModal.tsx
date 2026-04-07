import { useState, useEffect, useId } from 'react'
import {
  getClientProjectCodeHint,
  createClientProject,
  patchClientProject,
  type TimeManagerClientRow,
  type TimeManagerClientProjectRow,
  type TimeManagerClientProjectCreatePayload,
  type TimeManagerClientProjectPatchPayload,
} from '@entities/time-tracking'

type ProjectFormState = {
  name: string
  code: string
  startDate: string
  endDate: string
  notes: string
  reportVisibility: 'managers_only' | 'all_assigned'
  projectType: 'time_and_materials' | 'fixed_fee' | 'non_billable'
  billableRateType: string
  budgetType: 'no_budget' | 'total_project_fees' | 'total_project_hours'
  budgetAmount: string
  budgetHours: string
  fixedFeeAmount: string
  budgetResetsEveryMonth: boolean
  budgetIncludesExpenses: boolean
  sendBudgetAlerts: boolean
  budgetAlertThresholdPercent: string
}

function emptyProjectForm(): ProjectFormState {
  return {
    name: '',
    code: '',
    startDate: '',
    endDate: '',
    notes: '',
    reportVisibility: 'managers_only',
    projectType: 'time_and_materials',
    billableRateType: 'person_billable_rate',
    budgetType: 'no_budget',
    budgetAmount: '',
    budgetHours: '',
    fixedFeeAmount: '',
    budgetResetsEveryMonth: false,
    budgetIncludesExpenses: false,
    sendBudgetAlerts: false,
    budgetAlertThresholdPercent: '80',
  }
}

function rowToForm(row: TimeManagerClientProjectRow): ProjectFormState {
  return {
    name: row.name,
    code: row.code ?? '',
    startDate: (row.start_date ?? '').slice(0, 10),
    endDate: (row.end_date ?? '').slice(0, 10),
    notes: row.notes ?? '',
    reportVisibility:
      row.report_visibility === 'all_assigned' ? 'all_assigned' : 'managers_only',
    projectType:
      row.project_type === 'fixed_fee' || row.project_type === 'non_billable'
        ? row.project_type
        : 'time_and_materials',
    billableRateType: row.billable_rate_type ?? 'person_billable_rate',
    budgetType:
      row.budget_type === 'total_project_fees' || row.budget_type === 'total_project_hours'
        ? row.budget_type
        : 'no_budget',
    budgetAmount: row.budget_amount != null && row.budget_amount !== '' ? String(row.budget_amount) : '',
    budgetHours: row.budget_hours != null && row.budget_hours !== '' ? String(row.budget_hours) : '',
    fixedFeeAmount:
      row.fixed_fee_amount != null && row.fixed_fee_amount !== '' ? String(row.fixed_fee_amount) : '',
    budgetResetsEveryMonth: row.budget_resets_every_month,
    budgetIncludesExpenses: row.budget_includes_expenses,
    sendBudgetAlerts: row.send_budget_alerts,
    budgetAlertThresholdPercent:
      row.budget_alert_threshold_percent != null && row.budget_alert_threshold_percent !== ''
        ? String(row.budget_alert_threshold_percent)
        : '80',
  }
}

function parseOptionalDecimal(raw: string): string | number | null {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? t : null
}

function buildCreatePayload(form: ProjectFormState): TimeManagerClientProjectCreatePayload {
  const name = form.name.trim()
  const pt = form.projectType
  let billableRateType: string | null = null
  if (pt === 'time_and_materials' || pt === 'fixed_fee') {
    billableRateType = form.billableRateType.trim() || 'person_billable_rate'
  }

  let budgetAmount: string | number | null = null
  let budgetHours: string | number | null = null
  if (form.budgetType === 'total_project_fees') {
    budgetAmount = parseOptionalDecimal(form.budgetAmount)
  } else if (form.budgetType === 'total_project_hours') {
    budgetHours = parseOptionalDecimal(form.budgetHours)
  }

  const fixedFeeAmount = pt === 'fixed_fee' ? parseOptionalDecimal(form.fixedFeeAmount) : null

  const thresholdRaw = form.budgetAlertThresholdPercent.trim().replace(',', '.')
  const budgetAlertThresholdPercent =
    form.sendBudgetAlerts && thresholdRaw
      ? thresholdRaw
      : form.sendBudgetAlerts
        ? '80'
        : null

  return {
    name,
    code: form.code.trim() || null,
    startDate: form.startDate.trim() || null,
    endDate: form.endDate.trim() || null,
    notes: form.notes.trim() || null,
    reportVisibility: form.reportVisibility,
    projectType: pt,
    billableRateType,
    budgetType: form.budgetType,
    budgetAmount,
    budgetHours,
    budgetResetsEveryMonth: form.budgetResetsEveryMonth,
    budgetIncludesExpenses: form.budgetIncludesExpenses,
    sendBudgetAlerts: form.sendBudgetAlerts,
    budgetAlertThresholdPercent,
    fixedFeeAmount,
  }
}

export type ClientProjectModalProps = {
  mode: 'create' | 'edit'
  /**
   * Создание: если задан — клиент фиксирован (настройки).
   * Если null — в модалке показывается выбор из `clientsForPicker` (вкладка «Проекты»).
   */
  fixedClientId: string | null
  clientsForPicker?: TimeManagerClientRow[]
  initial: TimeManagerClientProjectRow | null
  onClose: () => void
  onSaved: (row: TimeManagerClientProjectRow) => void
}

export function ClientProjectModal({
  mode,
  fixedClientId,
  clientsForPicker,
  initial,
  onClose,
  onSaved,
}: ClientProjectModalProps) {
  const uid = useId()
  const [form, setForm] = useState<ProjectFormState>(() =>
    initial ? rowToForm(initial) : emptyProjectForm(),
  )
  const [pickedClientId, setPickedClientId] = useState(() => {
    if (fixedClientId) return fixedClientId
    return clientsForPicker?.[0]?.id ?? ''
  })
  const [codeHint, setCodeHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const showClientPicker = mode === 'create' && fixedClientId == null && (clientsForPicker?.length ?? 0) > 0
  const effectiveClientId =
    mode === 'edit' && initial
      ? initial.client_id
      : fixedClientId ?? pickedClientId

  useEffect(() => {
    if (fixedClientId) setPickedClientId(fixedClientId)
    else if (clientsForPicker?.[0]) setPickedClientId((prev) => prev || clientsForPicker[0].id)
  }, [fixedClientId, clientsForPicker])

  useEffect(() => {
    if (mode !== 'create' || !effectiveClientId) return
    let cancelled = false
    getClientProjectCodeHint(effectiveClientId)
      .then((h) => {
        if (!cancelled) setCodeHint(h.suggested_next ?? null)
      })
      .catch(() => {
        if (!cancelled) setCodeHint(null)
      })
    return () => {
      cancelled = true
    }
  }, [mode, effectiveClientId])

  const handleSubmit = async () => {
    if (mode === 'create' && !effectiveClientId) {
      setError('Выберите клиента')
      return
    }
    const name = form.name.trim()
    if (!name) {
      setError('Укажите название проекта')
      return
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('Дата окончания не может быть раньше даты начала')
      return
    }
    if (form.projectType === 'fixed_fee') {
      const ff = form.fixedFeeAmount.trim()
      if (!ff) {
        setError('Для фиксированного гонорара укажите сумму')
        return
      }
    }
    setError(null)
    setSaving(true)
    try {
      const body = buildCreatePayload(form)
      if (mode === 'create') {
        const row = await createClientProject(effectiveClientId, body)
        onSaved(row)
      } else if (initial) {
        const row = await patchClientProject(
          initial.client_id,
          initial.id,
          body as TimeManagerClientProjectPatchPayload,
        )
        onSaved(row)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  const showBudgetFees = form.budgetType === 'total_project_fees'
  const showBudgetHours = form.budgetType === 'total_project_hours'
  const showFixedFee = form.projectType === 'fixed_fee'

  return (
    <div className="tt-tm-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="tt-tm-modal tt-tm-modal--project"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-proj-title`}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="tt-tm-modal__head">
          <h2 id={`${uid}-proj-title`} className="tt-tm-modal__title">
            {mode === 'create' ? 'Новый проект' : 'Изменить проект'}
          </h2>
          <button type="button" className="tt-tm-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="tt-tm-modal__body">
          {showClientPicker && (
            <div className="tt-tm-field">
              <label className="tt-tm-label" htmlFor={`${uid}-client-pick`}>
                Клиент <span className="tt-tm-req">*</span>
              </label>
              <select
                id={`${uid}-client-pick`}
                className="tt-tm-select"
                value={pickedClientId}
                onChange={(e) => setPickedClientId(e.target.value)}
              >
                {clientsForPicker!.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-name`}>
              Название проекта <span className="tt-tm-req">*</span>
            </label>
            <input
              id={`${uid}-name`}
              className="tt-tm-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-code`}>
              Код проекта
            </label>
            <input
              id={`${uid}-code`}
              className="tt-tm-input"
              placeholder="напр. NSS-06"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            {mode === 'create' && codeHint && (
              <p className="tt-tm-hint">
                Подсказка: <strong>{codeHint}</strong>{' '}
                <button
                  type="button"
                  className="tt-settings__btn tt-settings__btn--link"
                  onClick={() => setForm((f) => ({ ...f, code: codeHint }))}
                >
                  Подставить
                </button>
              </p>
            )}
          </div>

          <div className="tt-tm-field-row">
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-start`}>
                Начало
              </label>
              <input
                id={`${uid}-start`}
                type="date"
                className="tt-tm-input"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="tt-tm-field tt-tm-field--cell">
              <label className="tt-tm-label" htmlFor={`${uid}-end`}>
                Окончание
              </label>
              <input
                id={`${uid}-end`}
                type="date"
                className="tt-tm-input"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-ptype`}>
              Тип проекта
            </label>
            <select
              id={`${uid}-ptype`}
              className="tt-tm-select"
              value={form.projectType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  projectType: e.target.value as ProjectFormState['projectType'],
                }))
              }
            >
              <option value="time_and_materials">Время и материалы (T&amp;M)</option>
              <option value="fixed_fee">Фиксированный гонорар</option>
              <option value="non_billable">Не оплачиваемый</option>
            </select>
          </div>

          {showFixedFee && (
            <div className="tt-tm-field">
              <label className="tt-tm-label" htmlFor={`${uid}-fixed`}>
                Сумма фикса <span className="tt-tm-req">*</span>
              </label>
              <input
                id={`${uid}-fixed`}
                className="tt-tm-input"
                inputMode="decimal"
                placeholder="напр. 120000"
                value={form.fixedFeeAmount}
                onChange={(e) => setForm((f) => ({ ...f, fixedFeeAmount: e.target.value }))}
              />
            </div>
          )}

          {(form.projectType === 'time_and_materials' || form.projectType === 'fixed_fee') && (
            <div className="tt-tm-field">
              <label className="tt-tm-label" htmlFor={`${uid}-brate`}>
                Тип ставок
              </label>
              <select
                id={`${uid}-brate`}
                className="tt-tm-select"
                value={form.billableRateType}
                onChange={(e) => setForm((f) => ({ ...f, billableRateType: e.target.value }))}
              >
                <option value="person_billable_rate">Почасовая ставка сотрудника</option>
                <option value="project_billable_rate">Ставка проекта</option>
              </select>
            </div>
          )}

          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-vis`}>
              Видимость в отчётах
            </label>
            <select
              id={`${uid}-vis`}
              className="tt-tm-select"
              value={form.reportVisibility}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  reportVisibility: e.target.value as ProjectFormState['reportVisibility'],
                }))
              }
            >
              <option value="managers_only">Только руководители</option>
              <option value="all_assigned">Все назначенные</option>
            </select>
          </div>

          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-btype`}>
              Бюджет
            </label>
            <select
              id={`${uid}-btype`}
              className="tt-tm-select"
              value={form.budgetType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  budgetType: e.target.value as ProjectFormState['budgetType'],
                }))
              }
            >
              <option value="no_budget">Без бюджета</option>
              <option value="total_project_fees">Сумма (деньги)</option>
              <option value="total_project_hours">Лимит часов</option>
            </select>
          </div>

          {showBudgetFees && (
            <div className="tt-tm-field">
              <label className="tt-tm-label" htmlFor={`${uid}-bamt`}>
                Сумма бюджета
              </label>
              <input
                id={`${uid}-bamt`}
                className="tt-tm-input"
                inputMode="decimal"
                placeholder="напр. 50000"
                value={form.budgetAmount}
                onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))}
              />
            </div>
          )}

          {showBudgetHours && (
            <div className="tt-tm-field">
              <label className="tt-tm-label" htmlFor={`${uid}-bhrs`}>
                Часы бюджета
              </label>
              <input
                id={`${uid}-bhrs`}
                className="tt-tm-input"
                inputMode="decimal"
                placeholder="напр. 500"
                value={form.budgetHours}
                onChange={(e) => setForm((f) => ({ ...f, budgetHours: e.target.value }))}
              />
            </div>
          )}

          <fieldset className="tt-tm-fieldset">
            <legend className="tt-tm-fieldset-legend">Параметры бюджета</legend>
            <label className="tt-tm-check-row">
              <input
                type="checkbox"
                checked={form.budgetResetsEveryMonth}
                onChange={(e) => setForm((f) => ({ ...f, budgetResetsEveryMonth: e.target.checked }))}
              />
              <span>Сбрасывать бюджет каждый месяц</span>
            </label>
            <label className="tt-tm-check-row">
              <input
                type="checkbox"
                checked={form.budgetIncludesExpenses}
                onChange={(e) => setForm((f) => ({ ...f, budgetIncludesExpenses: e.target.checked }))}
              />
              <span>В бюджет входят расходы</span>
            </label>
            <label className="tt-tm-check-row">
              <input
                type="checkbox"
                checked={form.sendBudgetAlerts}
                onChange={(e) => setForm((f) => ({ ...f, sendBudgetAlerts: e.target.checked }))}
              />
              <span>Уведомления о превышении бюджета</span>
            </label>
            {form.sendBudgetAlerts && (
              <div className="tt-tm-field" style={{ marginTop: '0.5rem' }}>
                <label className="tt-tm-label" htmlFor={`${uid}-thr`}>
                  Порог алерта, %
                </label>
                <input
                  id={`${uid}-thr`}
                  className="tt-tm-input"
                  inputMode="decimal"
                  value={form.budgetAlertThresholdPercent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, budgetAlertThresholdPercent: e.target.value }))
                  }
                />
              </div>
            )}
          </fieldset>

          <div className="tt-tm-field">
            <label className="tt-tm-label" htmlFor={`${uid}-notes`}>
              Заметки
            </label>
            <textarea
              id={`${uid}-notes`}
              className="tt-tm-textarea"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
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
