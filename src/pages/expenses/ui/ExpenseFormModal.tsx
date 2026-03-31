import { useState, useEffect, useMemo } from 'react'
import { useCurrentUser } from '@shared/hooks'
import { createExpenseRequest } from '@entities/expenses'
import { useExpenses } from '../model/ExpensesContext'
import type { ExpenseItem, ExpenseCategory, ExpenseRequestExpenseType } from '../model/types'
import { appendExpenseRequest } from '../model/expenseRequestsStorage'
import { DEFAULT_CURRENCY, EXPENSE_CATEGORIES } from '../model/constants'
import { isExpenseEditable } from '../model/utils'
import './ExpensesPage.css'
import './ExpensesRequestsPage.css'

type ExpenseFormModalProps = {
  date: string
  initialExpense?: ExpenseItem | null
  onClose: () => void
  onSaveExpense: (item: Omit<ExpenseItem, 'id'>) => void
  onUpdateExpense: (id: string, patch: Partial<ExpenseItem>) => void
}

const CURRENCIES = ['UZS', 'RUB', 'USD', 'EUR'] as const

function mapBudgetToCategory(budgetItem: string): ExpenseCategory {
  const t = budgetItem.trim()
  const found = EXPENSE_CATEGORIES.find((c) => c === t)
  return found ?? 'Прочее'
}

export function ExpenseFormModal({
  date,
  initialExpense,
  onClose,
  onSaveExpense,
  onUpdateExpense,
}: ExpenseFormModalProps) {
  const { expensesOfflineMode, refetchExpensesApi } = useExpenses()
  const isEdit = !!initialExpense
  const requestDateToday = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const { user, loading: userLoading } = useCurrentUser()
  const initiatorName = user?.display_name?.trim() || user?.email || ''

  const [department, setDepartment] = useState('')
  const [budgetItem, setBudgetItem] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [description, setDescription] = useState('')
  const [expenseOrPaymentDate, setExpenseOrPaymentDate] = useState(date)
  const [attachments, setAttachments] = useState<string[]>([])
  const [expenseType, setExpenseType] = useState<ExpenseRequestExpenseType>('reimbursable')
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitPending, setSubmitPending] = useState(false)

  useEffect(() => {
    if (isEdit && initialExpense && !isExpenseEditable(initialExpense)) {
      onClose()
    }
  }, [isEdit, initialExpense, onClose])

  useEffect(() => {
    if (initialExpense) {
      setExpenseOrPaymentDate(initialExpense.date)
      setBudgetItem(initialExpense.category)
      setCounterparty(initialExpense.title ?? '')
      setDescription(initialExpense.description)
      setAmount(String(initialExpense.amount))
      setCurrency(initialExpense.currency || DEFAULT_CURRENCY)
      setReceiptPhoto(initialExpense.receiptPhoto ?? null)
      setDepartment('')
      setAttachments([])
      setExpenseType('reimbursable')
      return
    }
    setExpenseOrPaymentDate(date)
    setDepartment('')
    setBudgetItem('')
    setCounterparty('')
    setAmount('')
    setCurrency(DEFAULT_CURRENCY)
    setDescription('')
    setAttachments([])
    setExpenseType('reimbursable')
    setReceiptPhoto(null)
  }, [initialExpense, date])

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setAttachments((prev) => [...prev, ...Array.from(files).map((f) => f.name)])
    e.target.value = ''
  }

  const removeAttachment = (name: string) => {
    setAttachments((prev) => prev.filter((n) => n !== name))
  }

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setReceiptPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(amt) || amt <= 0) return
    if (!description.trim()) return
    if (!isEdit && (!initiatorName.trim() || userLoading)) return

    const category = mapBudgetToCategory(budgetItem || 'Прочее')

    if (isEdit && initialExpense) {
      if (!isExpenseEditable(initialExpense)) return
      if (!expensesOfflineMode && initialExpense.id.startsWith('er-')) {
        return
      }
      onUpdateExpense(initialExpense.id, {
        date: expenseOrPaymentDate,
        category,
        amount: amt,
        currency,
        title: counterparty.trim() || undefined,
        description: description.trim(),
        receiptPhoto: receiptPhoto || undefined,
      })
      onClose()
      return
    }

    if (!expensesOfflineMode) {
      setSubmitError(null)
      setSubmitPending(true)
      try {
        await createExpenseRequest({
          request_date: requestDateToday,
          department: department.trim() || null,
          budget_category: budgetItem.trim() || null,
          counterparty: counterparty.trim() || null,
          amount: amt,
          currency,
          expense_date: expenseOrPaymentDate,
          description: description.trim() || null,
          reimbursement_type: expenseType,
        })
        refetchExpensesApi()
        onClose()
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'Не удалось сохранить заявку.')
      } finally {
        setSubmitPending(false)
      }
      return
    }

    const req = appendExpenseRequest({
      requestDate: requestDateToday,
      initiator: initiatorName.trim(),
      department: department.trim() || '—',
      budgetItem: budgetItem.trim() || '—',
      counterparty: counterparty.trim() || '—',
      amount: amt,
      currency,
      description: description.trim(),
      expenseOrPaymentDate,
      attachments: [...attachments],
      expenseType,
    })

    onSaveExpense({
      date: expenseOrPaymentDate,
      category,
      amount: amt,
      currency,
      title: counterparty.trim() || undefined,
      description: description.trim(),
      receiptPhoto: receiptPhoto || undefined,
      requestId: req.id,
      approvalStatus: req.status,
    })
    onClose()
  }

  const d = new Date(date + 'T00:00:00')
  const dateLabel = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="exp-modal" role="dialog" aria-modal="true" aria-labelledby="exp-cal-form-title">
      <div className="exp-modal__backdrop" onClick={onClose} />
      <div className="exp-modal__dialog exp-modal__dialog--wide exp-modal__dialog--tall">
        <div className="exp-modal__head">
          <h3 id="exp-cal-form-title" className="exp-modal__title">
            {isEdit ? 'Редактировать расход' : 'Новый расход'}
          </h3>
          <p className="exp-modal__date">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</p>
          <button type="button" className="exp-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form className="exp-modal__form exp-req-form" onSubmit={handleSubmit}>
          {!isEdit && (
            <p className="exp-req-form__hint">
              {expensesOfflineMode
                ? 'Создаётся заявка на расход и запись в календаре на дату расхода / оплаты. Номер заявки присваивается при сохранении.'
                : 'Заявка отправляется на сервер; после сохранения данные подтянутся из API.'}
            </p>
          )}
          {submitError && (
            <p className="exp-req-form__submit-error" role="alert">
              {submitError}
            </p>
          )}
          {isEdit && <p className="exp-req-form__hint">Редактируется только запись в календаре. Заявка не меняется.</p>}

          <div className="exp-req-form__grid">
            <div className="exp-req-form__row-2 exp-req-form__span-4">
              <label className="exp-modal__field">
                <span className="exp-modal__label">Дата заявки</span>
                <input
                  type="date"
                  className="exp-modal__input"
                  value={isEdit && initialExpense ? initialExpense.date : requestDateToday}
                  readOnly
                  disabled
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </label>
              <label className="exp-modal__field">
                <span className="exp-modal__label">Инициатор</span>
                <input
                  type="text"
                  className="exp-modal__input"
                  value={isEdit ? '' : initiatorName}
                  readOnly
                  disabled
                  placeholder={
                    isEdit ? '—' : userLoading ? 'Загрузка…' : !initiatorName ? 'Не удалось определить пользователя' : undefined
                  }
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </label>
            </div>
            <div className="exp-req-form__row-2 exp-req-form__span-4">
              <label className="exp-modal__field">
                <span className="exp-modal__label">Подразделение</span>
                <input
                  type="text"
                  className="exp-modal__input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Отдел / направление"
                  disabled={isEdit}
                />
              </label>
              <label className="exp-modal__field">
                <span className="exp-modal__label">Статья бюджета</span>
                <input
                  type="text"
                  className="exp-modal__input"
                  value={budgetItem}
                  onChange={(e) => setBudgetItem(e.target.value)}
                  placeholder="Например: Офис, Командировка…"
                />
              </label>
            </div>
            <label className="exp-modal__field exp-req-form__span-4">
              <span className="exp-modal__label">Контрагент / кому платим</span>
              <input
                type="text"
                className="exp-modal__input"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Наименование или ФИО"
              />
            </label>
            <div className="exp-req-form__row-3">
              <label className="exp-modal__field">
                <span className="exp-modal__label">Сумма</span>
                <input
                  type="text"
                  className="exp-modal__input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d\s,.]/g, ''))}
                  placeholder="0"
                  required
                />
              </label>
              <label className="exp-modal__field">
                <span className="exp-modal__label">Валюта</span>
                <select className="exp-modal__input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="exp-modal__field">
                <span className="exp-modal__label">Дата расхода / оплаты</span>
                <input
                  type="date"
                  className="exp-modal__input"
                  value={expenseOrPaymentDate}
                  onChange={(e) => setExpenseOrPaymentDate(e.target.value)}
                  required
                />
              </label>
            </div>
            <label className="exp-modal__field exp-req-form__span-4">
              <span className="exp-modal__label">Описание расхода</span>
              <textarea
                className="exp-modal__input exp-modal__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Назначение платежа"
                rows={2}
                required
              />
            </label>
            {!isEdit && (
              <div className="exp-modal__field exp-req-form__span-4">
                <span className="exp-modal__label">Тип расхода</span>
                <div className="exp-req-form__toggle" role="group" aria-label="Тип расхода">
                  <button
                    type="button"
                    className={`exp-req-form__toggle-btn ${expenseType === 'reimbursable' ? 'exp-req-form__toggle-btn--on' : ''}`}
                    onClick={() => setExpenseType('reimbursable')}
                  >
                    Возмещаемый
                  </button>
                  <button
                    type="button"
                    className={`exp-req-form__toggle-btn ${expenseType === 'non_reimbursable' ? 'exp-req-form__toggle-btn--on' : ''}`}
                    onClick={() => setExpenseType('non_reimbursable')}
                  >
                    Невозмещаемый
                  </button>
                </div>
              </div>
            )}
            {!isEdit && (
              <div className="exp-req-form__row-2 exp-req-form__span-4">
                <div className="exp-modal__field exp-req-form__field--drop">
                  <span className="exp-modal__label">Прикреплённые документы</span>
                  <input type="file" className="exp-modal__file-input" multiple onChange={handleFiles} id="exp-cal-req-files" />
                  <label htmlFor="exp-cal-req-files" className="exp-modal__photo-label exp-req-form__dropzone">
                    Выбрать файлы
                  </label>
                  {attachments.length > 0 && (
                    <ul className="exp-req-form__files">
                      {attachments.map((name) => (
                        <li key={name}>
                          <span>{name}</span>
                          <button type="button" className="exp-req-form__file-remove" onClick={() => removeAttachment(name)} aria-label={`Удалить ${name}`}>
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="exp-modal__field exp-req-form__field--drop">
                  <span className="exp-modal__label">Фото чека</span>
                  <div className="exp-modal__photo-wrap exp-req-form__dropzone-wrap">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="exp-modal__file-input"
                      onChange={handleReceiptChange}
                      id="exp-cal-receipt-photo"
                    />
                    <label htmlFor="exp-cal-receipt-photo" className="exp-modal__photo-label exp-req-form__dropzone">
                      {receiptPhoto ? (
                        <img src={receiptPhoto} alt="Чек" className="exp-modal__photo-preview" />
                      ) : (
                        <span className="exp-modal__photo-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Добавить фото
                        </span>
                      )}
                    </label>
                    {receiptPhoto && (
                      <button type="button" className="exp-modal__photo-remove" onClick={() => setReceiptPhoto(null)} aria-label="Удалить фото">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {isEdit && (
              <div className="exp-modal__field exp-req-form__span-4 exp-req-form__field--drop">
                <span className="exp-modal__label">Фото чека</span>
                <div className="exp-modal__photo-wrap">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="exp-modal__file-input"
                    onChange={handleReceiptChange}
                    id="exp-cal-receipt-photo-edit"
                  />
                  <label htmlFor="exp-cal-receipt-photo-edit" className="exp-modal__photo-label exp-req-form__dropzone">
                    {receiptPhoto ? (
                      <img src={receiptPhoto} alt="Чек" className="exp-modal__photo-preview" />
                    ) : (
                      <span className="exp-modal__photo-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Добавить фото
                      </span>
                    )}
                  </label>
                  {receiptPhoto && (
                    <button type="button" className="exp-modal__photo-remove" onClick={() => setReceiptPhoto(null)} aria-label="Удалить фото">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="exp-modal__foot">
            <button type="button" className="exp-modal__btn exp-modal__btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className="exp-modal__btn exp-modal__btn--primary"
              disabled={submitPending || (!isEdit && (userLoading || !initiatorName))}
            >
              {submitPending ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
