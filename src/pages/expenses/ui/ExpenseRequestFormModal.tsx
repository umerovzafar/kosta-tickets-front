import { useMemo, useState } from 'react'
import { useCurrentUser } from '@shared/hooks'
import type { ExpenseCategory, ExpenseRequestExpenseType } from '../model/types'
import type { NewExpenseRequestInput } from '../model/expenseRequestsStorage'
import { DEFAULT_CURRENCY, EXPENSE_CATEGORIES, EXPENSE_REQUEST_DEPARTMENT_HINTS } from '../model/constants'
import './ExpensesPage.css'
import './ExpensesRequestsPage.css'

type ExpenseRequestFormModalProps = {
  onClose: () => void
  onSubmit: (data: NewExpenseRequestInput) => void | Promise<void>
}

const CURRENCIES = ['UZS', 'RUB', 'USD', 'EUR'] as const

export function ExpenseRequestFormModal({ onClose, onSubmit }: ExpenseRequestFormModalProps) {
  const requestDate = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const { user, loading: userLoading } = useCurrentUser()
  const initiatorName = user?.display_name?.trim() || user?.email || ''
  const [department, setDepartment] = useState('')
  const [budgetCategory, setBudgetCategory] = useState<ExpenseCategory | ''>('')
  const [budgetOther, setBudgetOther] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [description, setDescription] = useState('')
  const [expenseOrPaymentDate, setExpenseOrPaymentDate] = useState(requestDate)
  const [attachments, setAttachments] = useState<string[]>([])
  const [expenseType, setExpenseType] = useState<ExpenseRequestExpenseType>('reimbursable')
  const [submitPending, setSubmitPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setAttachments((prev) => [...prev, ...Array.from(files).map((f) => f.name)])
    e.target.value = ''
  }

  const removeAttachment = (name: string) => {
    setAttachments((prev) => prev.filter((n) => n !== name))
  }

  const resolvedBudgetItem = useMemo(() => {
    if (!budgetCategory) return ''
    if (budgetCategory === 'Прочее') {
      const t = budgetOther.trim()
      return t || 'Прочее'
    }
    return budgetCategory
  }, [budgetCategory, budgetOther])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(amt) || amt <= 0) return
    if (!initiatorName.trim() || !description.trim() || !budgetCategory) return
    setSubmitError(null)
    setSubmitPending(true)
    try {
      await onSubmit({
        requestDate,
        initiator: initiatorName.trim(),
        department: department.trim() || '—',
        budgetItem: resolvedBudgetItem,
        counterparty: counterparty.trim() || '—',
        amount: amt,
        currency,
        description: description.trim(),
        expenseOrPaymentDate,
        attachments: [...attachments],
        expenseType,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить заявку.')
    } finally {
      setSubmitPending(false)
    }
  }

  return (
    <div className="exp-modal" role="dialog" aria-modal="true" aria-labelledby="exp-req-form-title">
      <div className="exp-modal__backdrop" onClick={onClose} />
      <div className="exp-modal__dialog exp-modal__dialog--wide exp-modal__dialog--tall">
        <div className="exp-modal__head">
          <h3 id="exp-req-form-title" className="exp-modal__title">
            Новая заявка на расход
          </h3>
          <p className="exp-modal__date">Заполните поля по корпоративной модели</p>
          <button type="button" className="exp-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form className="exp-modal__form exp-req-form" onSubmit={handleSubmit}>
          <p className="exp-req-form__hint">
            Номер и статус заявки выставляются при отправке (по умолчанию — на согласование). В карточке отображаются те же поля, что ниже — заполните их так, как должно быть в учёте.
          </p>
          {submitError && (
            <p className="exp-req-form__submit-error" role="alert">
              {submitError}
            </p>
          )}

          <datalist id="exp-req-departments">
            {EXPENSE_REQUEST_DEPARTMENT_HINTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>

          <div className="exp-req-form__grid">
            <div className="exp-req-form__section exp-req-form__span-4">
              <h4 className="exp-req-form__section-title">Заявка</h4>
            </div>
            <div className="exp-req-form__row-2 exp-req-form__span-4">
              <label className="exp-modal__field">
                <span className="exp-modal__label">Дата заявки</span>
                <input type="date" className="exp-modal__input" value={requestDate} readOnly disabled tabIndex={-1} aria-readonly="true" />
              </label>
              <label className="exp-modal__field">
                <span className="exp-modal__label">Инициатор</span>
                <input
                  type="text"
                  className="exp-modal__input"
                  value={initiatorName}
                  readOnly
                  disabled
                  placeholder={userLoading ? 'Загрузка…' : 'Не удалось определить пользователя'}
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </label>
            </div>
            <div className="exp-req-form__section exp-req-form__span-4">
              <h4 className="exp-req-form__section-title">Учёт и контрагент</h4>
            </div>
            <div className="exp-req-form__row-2 exp-req-form__span-4">
              <label className="exp-modal__field">
                <span className="exp-modal__label">Подразделение</span>
                <input
                  type="text"
                  className="exp-modal__input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  list="exp-req-departments"
                  placeholder="Отдел или направление"
                  autoComplete="organization"
                />
              </label>
              <div className="exp-modal__field">
                <span className="exp-modal__label">
                  Статья бюджета <span className="exp-req-form__req">*</span>
                </span>
                <select
                  className="exp-modal__input"
                  value={budgetCategory}
                  onChange={(e) => setBudgetCategory(e.target.value as ExpenseCategory | '')}
                  required
                  aria-required="true"
                >
                  <option value="">Выберите статью</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {budgetCategory === 'Прочее' && (
              <label className="exp-modal__field exp-req-form__span-4">
                <span className="exp-modal__label">Уточнение статьи</span>
                <input
                  type="text"
                  className="exp-modal__input"
                  value={budgetOther}
                  onChange={(e) => setBudgetOther(e.target.value)}
                  placeholder="Кратко: на что именно бюджет"
                />
              </label>
            )}
            <label className="exp-modal__field exp-req-form__span-4">
              <span className="exp-modal__label">Контрагент / кому платим</span>
              <input
                type="text"
                className="exp-modal__input"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Юрлицо, ИП или ФИО; можно оставить «—» если неизвестно"
              />
            </label>
            <div className="exp-req-form__section exp-req-form__span-4">
              <h4 className="exp-req-form__section-title">Сумма и сроки</h4>
            </div>
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
                <input type="date" className="exp-modal__input" value={expenseOrPaymentDate} onChange={(e) => setExpenseOrPaymentDate(e.target.value)} required />
              </label>
            </div>
            <div className="exp-req-form__section exp-req-form__span-4">
              <h4 className="exp-req-form__section-title">Содержание</h4>
            </div>
            <label className="exp-modal__field exp-req-form__span-4">
              <span className="exp-modal__label">
                Описание расхода <span className="exp-req-form__req">*</span>
              </span>
              <textarea
                className="exp-modal__input exp-modal__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Назначение платежа, основание — как в карточке заявки для согласующего"
                rows={3}
                required
              />
            </label>
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
            <div className="exp-req-form__section exp-req-form__span-4">
              <h4 className="exp-req-form__section-title">Документы</h4>
            </div>
            <div className="exp-modal__field exp-req-form__span-4 exp-req-form__field--drop">
              <span className="exp-modal__label">Прикреплённые документы</span>
              <input type="file" className="exp-modal__file-input" multiple onChange={handleFiles} id="exp-req-files" />
              <label htmlFor="exp-req-files" className="exp-modal__photo-label exp-req-form__dropzone">
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
          </div>

          <div className="exp-modal__foot">
            <button type="button" className="exp-modal__btn exp-modal__btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className="exp-modal__btn exp-modal__btn--primary"
              disabled={submitPending || userLoading || !initiatorName || !budgetCategory}
            >
              {submitPending ? 'Отправка…' : 'Отправить заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
