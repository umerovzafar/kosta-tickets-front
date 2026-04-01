import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type {
  ExpenseRequest, ExpenseFormValues, ExpenseFormErrors,
  ExpenseType,
} from '../model/types'
import { EXPENSE_TYPES, SUBTYPES, PAYMENT_METHODS, STATUS_META } from '../model/constants'

export type PanelMode = 'create' | 'edit' | 'view'

type Props = {
  isOpen: boolean
  mode: PanelMode
  editingRequest?: ExpenseRequest | null
  onClose: () => void
  onSaveDraft: (values: ExpenseFormValues, files: File[]) => void
  onSubmit: (values: ExpenseFormValues, files: File[]) => void
}

const EMPTY: ExpenseFormValues = {
  description: '',
  expenseDate: '',
  expenseType: '',
  expenseSubtype: '',
  isReimbursable: null,
  amountUzs: '',
  exchangeRate: '',
  paymentMethod: '',
  projectId: '',
  vendor: '',
  businessPurpose: '',
  comment: '',
}

function validate(v: ExpenseFormValues): ExpenseFormErrors {
  const e: ExpenseFormErrors = {}
  if (!v.description.trim()) e.description = 'Обязательное поле'
  if (!v.expenseDate) e.expenseDate = 'Укажите дату'
  if (!v.expenseType) e.expenseType = 'Выберите тип расхода'
  if (v.isReimbursable === null) e.isReimbursable = 'Выберите вариант возмещения'
  const amt = parseFloat(v.amountUzs)
  if (!v.amountUzs || isNaN(amt) || amt <= 0) e.amountUzs = 'Укажите сумму больше 0'
  const rate = parseFloat(v.exchangeRate)
  if (!v.exchangeRate || isNaN(rate) || rate <= 0) e.exchangeRate = 'Укажите курс больше 0'
  return e
}

export function ExpensesFormPanel({ isOpen, mode, editingRequest, onClose, onSaveDraft, onSubmit }: Props) {
  const [values, setValues] = useState<ExpenseFormValues>(EMPTY)
  const [errors, setErrors] = useState<ExpenseFormErrors>({})
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const equiv = useMemo(() => {
    const amt = parseFloat(values.amountUzs)
    const rate = parseFloat(values.exchangeRate)
    if (!amt || !rate || rate === 0) return ''
    return (amt / rate).toFixed(2)
  }, [values.amountUzs, values.exchangeRate])

  useEffect(() => {
    if (!isOpen) return
    if ((mode === 'edit' || mode === 'view') && editingRequest) {
      setValues({
        description: editingRequest.description,
        expenseDate: editingRequest.expenseDate,
        expenseType: editingRequest.expenseType,
        expenseSubtype: editingRequest.expenseSubtype ?? '',
        isReimbursable: editingRequest.isReimbursable,
        amountUzs: String(editingRequest.amountUzs),
        exchangeRate: String(editingRequest.exchangeRate),
        paymentMethod: editingRequest.paymentMethod ?? '',
        projectId: editingRequest.projectId ?? '',
        vendor: editingRequest.vendor ?? '',
        businessPurpose: editingRequest.businessPurpose ?? '',
        comment: editingRequest.comment ?? '',
      })
    } else {
      setValues(EMPTY)
    }
    setFiles([])
    setErrors({})
  }, [isOpen, mode, editingRequest])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const set = useCallback((field: keyof Omit<ExpenseFormValues, 'isReimbursable'>, val: string) => {
    setValues(prev => ({ ...prev, [field]: val }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }, [])

  const setReimb = useCallback((val: boolean) => {
    setValues(prev => ({ ...prev, isReimbursable: val }))
    setErrors(prev => ({ ...prev, isReimbursable: undefined }))
  }, [])

  const handleSaveDraft = useCallback(() => {
    onSaveDraft(values, files)
  }, [values, files, onSaveDraft])

  const handleSubmit = useCallback(() => {
    const errs = validate(values)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setTimeout(() => {
        bodyRef.current?.querySelector('[data-err]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }
    onSubmit(values, files)
  }, [values, files, onSubmit])

  const subtypes = values.expenseType ? (SUBTYPES[values.expenseType as ExpenseType] ?? []) : []
  const isView = mode === 'view'
  const title = mode === 'create' ? 'Новая заявка' : mode === 'edit' ? 'Редактировать заявку' : 'Просмотр заявки'

  return (
    <>
      <div
        className={`exp-panel-overlay${isOpen ? ' exp-panel-overlay--open' : ''}`}
        aria-hidden
        onClick={onClose}
      />
      <aside className={`exp-panel${isOpen ? ' exp-panel--open' : ''}`} aria-modal aria-label={title}>
        {/* Header */}
        <div className="exp-panel__hd">
          <div className="exp-panel__hd-left">
            {isView && editingRequest && (
              <span className={`exp-status exp-status--${editingRequest.status}`}>
                {STATUS_META[editingRequest.status]?.label ?? editingRequest.status}
              </span>
            )}
            <h2 className="exp-panel__title">{title}</h2>
          </div>
          <button type="button" className="exp-panel__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="exp-panel__body" ref={bodyRef}>

          {/* Block 1: Main info */}
          <div className="exp-form-block">
            <p className="exp-form-block__title">Основная информация</p>

            <div className={`exp-form-field${errors.description ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Описание расхода <span className="exp-form-req">*</span></label>
              <textarea
                className="exp-form-textarea"
                placeholder="Например: оплата такси, покупка канцтоваров, бронь гостиницы"
                value={values.description}
                onChange={e => set('description', e.target.value)}
                disabled={isView}
                rows={3}
              />
              {errors.description && <p className="exp-form-err-msg" data-err>{errors.description}</p>}
            </div>

            <div className={`exp-form-field${errors.expenseType ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Тип расхода <span className="exp-form-req">*</span></label>
              <select
                className="exp-form-select"
                value={values.expenseType}
                onChange={e => { set('expenseType', e.target.value); set('expenseSubtype', '') }}
                disabled={isView}
              >
                <option value="">Выберите тип</option>
                {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.expenseType && <p className="exp-form-err-msg" data-err>{errors.expenseType}</p>}
            </div>

            {subtypes.length > 0 && (
              <div className="exp-form-field">
                <label className="exp-form-label">Подтип</label>
                <select
                  className="exp-form-select"
                  value={values.expenseSubtype}
                  onChange={e => set('expenseSubtype', e.target.value)}
                  disabled={isView}
                >
                  <option value="">Не указан</option>
                  {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Block 2: Finances */}
          <div className="exp-form-block">
            <p className="exp-form-block__title">Финансы</p>

            <div className={`exp-form-field${errors.expenseDate ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Дата <span className="exp-form-req">*</span></label>
              <input
                type="date"
                className="exp-form-input"
                value={values.expenseDate}
                onChange={e => set('expenseDate', e.target.value)}
                disabled={isView}
              />
              {errors.expenseDate && <p className="exp-form-err-msg" data-err>{errors.expenseDate}</p>}
            </div>

            <div className={`exp-form-field${errors.amountUzs ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Сумма <span className="exp-form-req">*</span></label>
              <div className="exp-form-input-wrap">
                <input
                  type="number" min={0} className="exp-form-input" placeholder="0"
                  value={values.amountUzs}
                  onChange={e => set('amountUzs', e.target.value)}
                  disabled={isView}
                />
                <span className="exp-form-suffix">UZS</span>
              </div>
              {errors.amountUzs && <p className="exp-form-err-msg" data-err>{errors.amountUzs}</p>}
            </div>

            <div className={`exp-form-field${errors.exchangeRate ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Курс UZS / USD <span className="exp-form-req">*</span></label>
              <div className="exp-form-input-wrap">
                <input
                  type="number" min={0} className="exp-form-input" placeholder="12 800"
                  value={values.exchangeRate}
                  onChange={e => set('exchangeRate', e.target.value)}
                  disabled={isView}
                />
                <span className="exp-form-suffix">UZS</span>
              </div>
              {errors.exchangeRate && <p className="exp-form-err-msg" data-err>{errors.exchangeRate}</p>}
            </div>

            <div className="exp-form-field">
              <label className="exp-form-label">Эквивалентная сумма</label>
              <div className="exp-form-input-wrap">
                <input
                  type="text" className="exp-form-input exp-form-input--calc"
                  value={equiv || (isView ? String(editingRequest?.equivalentAmount ?? '') : '')}
                  readOnly tabIndex={-1}
                  placeholder="—"
                />
                <span className="exp-form-suffix">USD</span>
              </div>
              <p className="exp-form-hint">Рассчитывается автоматически: Сумма ÷ Курс</p>
            </div>

            <div className={`exp-form-field${errors.isReimbursable ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Возмещаемость <span className="exp-form-req">*</span></label>
              <div className="exp-form-toggle" role="group" aria-label="Выберите тип возмещения">
                <button
                  type="button"
                  className={`exp-form-toggle__btn${values.isReimbursable === true ? ' exp-form-toggle__btn--on' : ''}`}
                  onClick={() => !isView && setReimb(true)}
                  disabled={isView}
                >Возмещаемый</button>
                <button
                  type="button"
                  className={`exp-form-toggle__btn${values.isReimbursable === false ? ' exp-form-toggle__btn--on' : ''}`}
                  onClick={() => !isView && setReimb(false)}
                  disabled={isView}
                >Невозмещаемый</button>
              </div>
              {errors.isReimbursable && <p className="exp-form-err-msg" data-err>{errors.isReimbursable}</p>}
            </div>

            <div className="exp-form-field">
              <label className="exp-form-label">Способ оплаты</label>
              <select
                className="exp-form-select"
                value={values.paymentMethod}
                onChange={e => set('paymentMethod', e.target.value)}
                disabled={isView}
              >
                <option value="">Не указан</option>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {/* Block 3: Additional */}
          <div className="exp-form-block">
            <p className="exp-form-block__title">Дополнительно</p>

            <div className="exp-form-field">
              <label className="exp-form-label">Проект</label>
              <input
                type="text" className="exp-form-input" placeholder="Введите название проекта"
                value={values.projectId}
                onChange={e => set('projectId', e.target.value)}
                disabled={isView}
              />
            </div>

            <div className="exp-form-field">
              <label className="exp-form-label">Контрагент / Поставщик</label>
              <input
                type="text" className="exp-form-input" placeholder="Организация или ФИО"
                value={values.vendor}
                onChange={e => set('vendor', e.target.value)}
                disabled={isView}
              />
            </div>

            <div className="exp-form-field">
              <label className="exp-form-label">Цель расхода</label>
              <input
                type="text" className="exp-form-input" placeholder="Укажите бизнес-цель"
                value={values.businessPurpose}
                onChange={e => set('businessPurpose', e.target.value)}
                disabled={isView}
              />
            </div>

            <div className="exp-form-field">
              <label className="exp-form-label">Комментарий</label>
              <textarea
                className="exp-form-textarea"
                placeholder="Дополнительная информация"
                value={values.comment}
                onChange={e => set('comment', e.target.value)}
                disabled={isView}
                rows={3}
              />
            </div>
          </div>

          {/* Block 4: Documents */}
          <div className={`exp-form-block${values.isReimbursable === true ? ' exp-form-block--docs' : ''}`}>
            <p className="exp-form-block__title">
              Документы
              {values.isReimbursable === true && !isView && (
                <span className="exp-form-docs-badge">Обязательны для возмещения</span>
              )}
            </p>

            {!isView && (
              <div
                className="exp-form-file-zone"
                role="button" tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef} type="file" multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (!e.target.files) return
                    setFiles(prev => [...prev, ...Array.from(e.target.files!)])
                    e.target.value = ''
                  }}
                />
                <svg className="exp-form-file-zone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="exp-form-file-zone__label">Нажмите для загрузки</p>
                <p className="exp-form-file-zone__hint">PDF, JPG, PNG, XLSX · до 10 МБ</p>
              </div>
            )}

            {files.length > 0 && (
              <ul className="exp-form-file-list">
                {files.map((f, i) => (
                  <li key={i} className="exp-form-file-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="exp-form-file-item__name">{f.name}</span>
                    <span className="exp-form-file-item__size">{(f.size / 1024).toFixed(0)} КБ</span>
                    <button
                      type="button" aria-label="Удалить"
                      className="exp-form-file-item__del"
                      onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {isView && editingRequest && (
              editingRequest.attachments && editingRequest.attachments.length > 0 ? (
                <ul className="exp-form-file-list">
                  {editingRequest.attachments.map(f => (
                    <li key={f.id} className="exp-form-file-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="exp-form-file-item__name">{f.fileName}</span>
                      <span className="exp-form-file-item__size">{(f.sizeBytes / 1024).toFixed(0)} КБ</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="exp-form-no-files">Документы не прикреплены</p>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        {!isView ? (
          <div className="exp-panel__ft">
            <button type="button" className="exp-panel-btn exp-panel-btn--ghost" onClick={onClose}>Отмена</button>
            <button type="button" className="exp-panel-btn exp-panel-btn--outline" onClick={handleSaveDraft}>Сохранить черновик</button>
            <button type="button" className="exp-panel-btn exp-panel-btn--primary" onClick={handleSubmit}>Отправить</button>
          </div>
        ) : (
          <div className="exp-panel__ft exp-panel__ft--single">
            <button type="button" className="exp-panel-btn exp-panel-btn--outline" onClick={onClose}>Закрыть</button>
          </div>
        )}
      </aside>
    </>
  )
}
