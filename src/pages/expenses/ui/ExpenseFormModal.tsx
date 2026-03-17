import { useState } from 'react'
import type { ExpenseItem } from '../model/types'

type ExpenseFormModalProps = {
  date: string
  initialExpense?: ExpenseItem | null
  onClose: () => void
  onSave: (data: { category: string; amount: number; title?: string; description: string; receiptPhoto?: string }) => void
  categories: string[]
  categoryMeta: Record<string, { color: string; bg: string }>
}

export function ExpenseFormModal({
  date,
  initialExpense,
  onClose,
  onSave,
  categories,
  categoryMeta,
}: ExpenseFormModalProps) {
  const [category, setCategory] = useState((initialExpense?.category ?? categories[0]) || '')
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amount) : '')
  const [title, setTitle] = useState(initialExpense?.title ?? '')
  const [description, setDescription] = useState(initialExpense?.description ?? '')
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(initialExpense?.receiptPhoto ?? null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setReceiptPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(amt) || amt <= 0) return
    onSave({
      category,
      amount: amt,
      title: title.trim() || undefined,
      description: description.trim(),
      receiptPhoto: receiptPhoto || undefined,
    })
  }

  const d = new Date(date + 'T00:00:00')
  const dateLabel = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  const isEdit = !!initialExpense

  return (
    <div className="exp-modal" role="dialog" aria-modal="true">
      <div className="exp-modal__backdrop" onClick={onClose} />
      <div className="exp-modal__dialog">
        <div className="exp-modal__head">
          <h3 className="exp-modal__title">{isEdit ? 'Редактировать расход' : 'Новый расход'}</h3>
          <p className="exp-modal__date">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</p>
          <button type="button" className="exp-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <form className="exp-modal__form" onSubmit={handleSubmit}>
          <label className="exp-modal__field">
            <span className="exp-modal__label">Заголовок</span>
            <input
              type="text"
              className="exp-modal__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Краткое название расхода"
            />
          </label>
          <div className="exp-modal__field">
            <span className="exp-modal__label">Категория</span>
            <div className="exp-modal__categories" role="group" aria-label="Выбор категории">
              {categories.map((c) => {
                const meta = categoryMeta[c]
                const isSelected = category === c
                return (
                  <button
                    key={c}
                    type="button"
                    className={`exp-modal__category ${isSelected ? 'exp-modal__category--selected' : ''}`}
                    style={{
                      color: meta?.color ?? 'inherit',
                      background: isSelected ? meta?.bg ?? 'var(--app-surface-soft)' : 'transparent',
                      borderColor: isSelected ? meta?.color ?? 'var(--app-accent)' : 'var(--app-border)',
                    }}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>
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
            <span className="exp-modal__label">Описание</span>
            <textarea
              className="exp-modal__input exp-modal__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Комментарий (необязательно)"
              rows={2}
            />
          </label>
          <div className="exp-modal__field">
            <span className="exp-modal__label">Фото чека</span>
            <div className="exp-modal__photo-wrap">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="exp-modal__file-input"
                onChange={handleFileChange}
                id="exp-receipt-photo"
              />
              <label htmlFor="exp-receipt-photo" className="exp-modal__photo-label">
                {receiptPhoto ? (
                  <img src={receiptPhoto} alt="Чек" className="exp-modal__photo-preview" />
                ) : (
                  <span className="exp-modal__photo-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Добавить фото
                  </span>
                )}
              </label>
              {receiptPhoto && (
                <button type="button" className="exp-modal__photo-remove" onClick={() => setReceiptPhoto(null)} aria-label="Удалить фото">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>
          <div className="exp-modal__foot">
            <button type="button" className="exp-modal__btn exp-modal__btn--ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="exp-modal__btn exp-modal__btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  )
}
