import { useState, useCallback, useRef, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react'
import {
  type ExpenseRequest,
  type ExpenseFormValues,
  type ExpenseFormErrors,
  type ExpenseFilesByKind,
  type AttachmentItem,
  EXPENSE_ATTACHMENT_MAX_BYTES,
} from '../model/types'
import { EXPENSE_CURRENCIES, EXPENSE_TYPES, PAYMENT_METHODS, STATUS_META } from '../model/constants'
import { computeUsdEquivalent, needsForeignUsdRate } from '../model/expenseCurrency'
import { fetchCbuParsedForDate, foreignUnitsPerUsd, type CbuParsed } from '../model/cbuRates'
import type { ExpenseAmountCurrency } from '../model/types'
import {
  approveExpense,
  rejectExpense,
  reviseExpense,
  deleteAttachment,
  openExpenseAttachmentInNewTab,
} from '../model/expensesApi'
import { asExpenseNumber } from '../model/coerceExpense'
import { formatExpenseAuthorLabel } from '../model/expenseAuthor'

export type PanelMode = 'create' | 'edit' | 'view'

type Props = {
  isOpen: boolean
  mode: PanelMode
  editingRequest?: ExpenseRequest | null
  onClose: () => void
  onSaveDraft: (values: ExpenseFormValues, files: ExpenseFilesByKind) => void
  onSubmit: (values: ExpenseFormValues, files: ExpenseFilesByKind) => void
  /** Родитель: идёт сохранение черновика (create/update + вложения). */
  saveDraftPending?: boolean
  /** Родитель: идёт отправка на согласование (то же + submit). */
  submitPending?: boolean
  /** После удаления вложения с сервера — обновить заявку в родителе. */
  onExpenseSnapshotUpdated?: (expense: ExpenseRequest) => void
  /** Партнёр / администратор: кнопки согласования для статуса «На согласовании». */
  canModerate?: boolean
  onExpenseUpdated?: (expense: ExpenseRequest) => void
  /** Из письма после входа: ?intent=approve|reject — обрабатывается один раз. */
  emailModerationIntent?: 'approve' | 'reject' | null
  onEmailModerationIntentConsumed?: () => void
}

function PanelBtnSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? 'exp-panel-btn__spinner'}
      viewBox="0 0 24 24"
      aria-hidden
      width={18}
      height={18}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity={0.2} />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        d="M12 3a9 9 0 0 1 9 9"
      />
    </svg>
  )
}

/** YYYY-MM-DD по локальному времени пользователя (не UTC из toISOString). */
function todayIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** YYYY-MM-DD → DD.MM.YYYY для подписи в форме. */
function fmtIsoDateRu(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

const EMPTY: ExpenseFormValues = {
  description: '',
  expenseDate: '',
  paymentDeadline: '',
  expenseType: '',
  isReimbursable: null,
  amountCurrency: 'UZS',
  foreignPerUsd: '',
  amountUzs: '',
  exchangeRate: '',
  paymentMethod: '',
  projectId: '',
  vendor: '',
  businessPurpose: '',
  comment: '',
}

type ValidateOpts = {
  forSubmit?: boolean
  filesPaymentDoc: File[]
  filesReceipt: File[]
  serverAttachments?: AttachmentItem[]
}

function validate(v: ExpenseFormValues, opts?: ValidateOpts): ExpenseFormErrors {
  const e: ExpenseFormErrors = {}
  if (!v.description.trim()) e.description = 'Обязательное поле'
  if (!v.expenseDate) e.expenseDate = 'Укажите дату'
  if (v.paymentDeadline.trim() && v.expenseDate && v.paymentDeadline < v.expenseDate) {
    e.paymentDeadline = 'Срок оплаты не может быть раньше даты расхода'
  }
  if (!v.expenseType) e.expenseType = 'Выберите тип расхода'
  if (v.isReimbursable === null) e.isReimbursable = 'Выберите вариант возмещения'
  const amt = parseFloat(v.amountUzs)
  if (!v.amountUzs || isNaN(amt) || amt <= 0) e.amountUzs = 'Укажите сумму больше 0'
  const rate = parseFloat(v.exchangeRate)
  if (!v.exchangeRate || isNaN(rate) || rate <= 0) e.exchangeRate = 'Укажите курс больше 0'
  if (needsForeignUsdRate(v.amountCurrency)) {
    const fx = parseFloat(v.foreignPerUsd)
    if (!v.foreignPerUsd || isNaN(fx) || fx <= 0) {
      e.foreignPerUsd = 'Укажите, сколько единиц валюты за 1 USD (например, 90 для рубля)'
    }
  }
  if (opts?.forSubmit && v.isReimbursable === true) {
    const s = opts.serverAttachments ?? []
    const pd =
      opts.filesPaymentDoc.length + s.filter(a => a.attachmentKind === 'payment_document').length
    const pr =
      opts.filesReceipt.length + s.filter(a => a.attachmentKind === 'payment_receipt').length
    const hasTyped =
      opts.filesPaymentDoc.length + opts.filesReceipt.length > 0 ||
      s.some(a => a.attachmentKind === 'payment_document' || a.attachmentKind === 'payment_receipt')
    if (hasTyped) {
      if (pd < 1) e.attachmentsPaymentDoc = 'Прикрепите документ для оплаты'
      if (pr < 1) e.attachmentsReceipt = 'Прикрепите квитанцию об оплате'
    } else if (s.length + opts.filesPaymentDoc.length + opts.filesReceipt.length < 1) {
      e.attachmentsPaymentDoc = 'Для возмещаемого расхода нужны вложения'
    }
    if (v.expenseType === 'other' && !v.comment.trim()) {
      e.comment = 'Для типа «Прочее» укажите комментарий'
    }
  }
  return e
}

function appendFilesChecked(
  incoming: FileList | null,
  setList: Dispatch<SetStateAction<File[]>>,
  onOversize: (fileName: string) => void,
) {
  if (!incoming?.length) return
  const added: File[] = []
  for (const f of Array.from(incoming)) {
    if (f.size > EXPENSE_ATTACHMENT_MAX_BYTES) {
      onOversize(f.name)
      continue
    }
    added.push(f)
  }
  if (!added.length) return
  setList(prev => [...prev, ...added])
}

function formatForeignFp(n: number): string {
  const x = Math.round(n * 1e6) / 1e6
  return x.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
}

export function ExpensesFormPanel({
  isOpen,
  mode,
  editingRequest,
  onClose,
  onSaveDraft,
  onSubmit,
  saveDraftPending = false,
  submitPending = false,
  onExpenseSnapshotUpdated,
  canModerate = false,
  onExpenseUpdated,
  emailModerationIntent = null,
  onEmailModerationIntentConsumed,
}: Props) {
  const [values, setValues] = useState<ExpenseFormValues>(EMPTY)
  const [errors, setErrors] = useState<ExpenseFormErrors>({})
  const [filesPaymentDoc, setFilesPaymentDoc] = useState<File[]>([])
  const [filesReceipt, setFilesReceipt] = useState<File[]>([])
  const [fileSizeHint, setFileSizeHint] = useState<string | null>(null)
  const [attachmentOpenErr, setAttachmentOpenErr] = useState<string | null>(null)
  const [cbuParsed, setCbuParsed] = useState<CbuParsed | null>(null)
  const [cbuLoading, setCbuLoading] = useState(false)
  const [cbuError, setCbuError] = useState<string | null>(null)
  const [moderationBusy, setModerationBusy] = useState(false)
  const [moderationErr, setModerationErr] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reviseOpen, setReviseOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [reviseComment, setReviseComment] = useState('')
  const fileInputPaymentRef = useRef<HTMLInputElement>(null)
  const fileInputReceiptRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const equivUsd = useMemo(
    () => computeUsdEquivalent(
      values.amountCurrency,
      values.amountUzs,
      values.exchangeRate,
      values.foreignPerUsd,
    ),
    [values.amountCurrency, values.amountUzs, values.exchangeRate, values.foreignPerUsd],
  )
  const equiv = equivUsd != null ? asExpenseNumber(equivUsd).toFixed(2) : ''

  const viewEquivFromServer = useMemo(() => {
    const n = asExpenseNumber(editingRequest?.equivalentAmount)
    return n > 0 ? n.toFixed(2) : ''
  }, [editingRequest])

  const equivHint = useMemo(() => {
    let line = ''
    if (values.amountCurrency === 'UZS') {
      line = 'Рассчитывается автоматически: сумма в сумах ÷ курс UZS/USD = USD'
    } else if (values.amountCurrency === 'USD') {
      line = 'Сумма уже в долларах США'
    } else {
      line = 'Пересчёт в USD по кросс-курсу через сум (курс ЦБ РУз)'
    }
    if (cbuParsed?.rateDateRu) {
      line += ` Курс ЦБ РУз на ${cbuParsed.rateDateRu} (cbu.uz).`
    }
    return line
  }, [values.amountCurrency, cbuParsed?.rateDateRu])

  const showForeignRate = needsForeignUsdRate(values.amountCurrency)
  const foreignLocked =
    mode === 'create' &&
    cbuParsed != null &&
    !cbuError &&
    !cbuLoading &&
    showForeignRate &&
    values.foreignPerUsd.trim() !== ''

  /* Создание: только isOpen + mode — без editingRequest в deps, иначе лишние перерендеры родителя сбрасывают дату. */
  useEffect(() => {
    if (!isOpen || mode !== 'create') return
    setCbuParsed(null)
    setCbuError(null)
    setCbuLoading(false)
    setValues({ ...EMPTY, expenseDate: todayIsoLocal() })
    setFilesPaymentDoc([])
    setFilesReceipt([])
    setFileSizeHint(null)
    setErrors({})
  }, [isOpen, mode])

  useEffect(() => {
    if (!isOpen || (mode !== 'edit' && mode !== 'view')) return
    if (!editingRequest) return
    setCbuParsed(null)
    setCbuError(null)
    setCbuLoading(false)
    setValues({
      description: editingRequest.description,
      expenseDate: editingRequest.expenseDate?.slice(0, 10) ?? '',
      paymentDeadline: editingRequest.paymentDeadline?.slice(0, 10) ?? '',
      expenseType: editingRequest.expenseType,
      isReimbursable: editingRequest.isReimbursable,
      amountCurrency: 'UZS',
      foreignPerUsd: '',
      amountUzs: String(editingRequest.amountUzs),
      exchangeRate: String(editingRequest.exchangeRate),
      paymentMethod: editingRequest.paymentMethod ?? '',
      projectId: editingRequest.projectId ?? '',
      vendor: editingRequest.vendor ?? '',
      businessPurpose: editingRequest.businessPurpose ?? '',
      comment: editingRequest.comment ?? '',
    })
    setFilesPaymentDoc([])
    setFilesReceipt([])
    setFileSizeHint(null)
    setErrors({})
  }, [isOpen, mode, editingRequest])

  useEffect(() => {
    if (!isOpen || mode !== 'create') return
    const iso = todayIsoLocal()
    let cancelled = false
    setCbuLoading(true)
    setCbuError(null)
    fetchCbuParsedForDate(iso)
      .then((parsed) => {
        if (cancelled) return
        setCbuParsed(parsed)
        setCbuLoading(false)
        setValues((prev) => {
          const er = parsed.uzsPerUsd.toFixed(2)
          let fr = ''
          if (needsForeignUsdRate(prev.amountCurrency)) {
            const fp = foreignUnitsPerUsd(parsed, prev.amountCurrency)
            if (fp != null && fp > 0) fr = formatForeignFp(fp)
          }
          return { ...prev, expenseDate: iso, exchangeRate: er, foreignPerUsd: fr }
        })
      })
      .catch((err) => {
        if (cancelled) return
        setCbuParsed(null)
        setCbuLoading(false)
        setCbuError(err instanceof Error ? err.message : 'Не удалось загрузить курс ЦБ')
      })
    return () => { cancelled = true }
  }, [isOpen, mode])

  useEffect(() => {
    if (!isOpen || mode !== 'create' || !cbuParsed) return
    if (!needsForeignUsdRate(values.amountCurrency)) {
      setValues(prev => (prev.foreignPerUsd === '' ? prev : { ...prev, foreignPerUsd: '' }))
      return
    }
    const fp = foreignUnitsPerUsd(cbuParsed, values.amountCurrency)
    if (fp == null || fp <= 0) return
    const s = formatForeignFp(fp)
    setValues(prev => (prev.foreignPerUsd === s ? prev : { ...prev, foreignPerUsd: s }))
  }, [isOpen, mode, cbuParsed, values.amountCurrency])

  const formAsyncBusy = saveDraftPending || submitPending

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !formAsyncBusy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, formAsyncBusy])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const set = useCallback((field: keyof Omit<ExpenseFormValues, 'isReimbursable'>, val: string) => {
    setValues(prev => ({ ...prev, [field]: val }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }, [])

  const setCurrency = useCallback((c: ExpenseAmountCurrency) => {
    setValues(prev => ({
      ...prev,
      amountCurrency: c,
      foreignPerUsd: '',
    }))
    setErrors(prev => ({ ...prev, foreignPerUsd: undefined }))
  }, [])

  const setReimb = useCallback((val: boolean) => {
    setValues(prev => ({ ...prev, isReimbursable: val }))
    setErrors(prev => ({
      ...prev,
      isReimbursable: undefined,
      ...(val === false ? { comment: undefined } : {}),
    }))
  }, [])

  const filesByKind: ExpenseFilesByKind = useMemo(
    () => ({ payment_document: filesPaymentDoc, payment_receipt: filesReceipt }),
    [filesPaymentDoc, filesReceipt],
  )

  const valuesForSave = useCallback((): ExpenseFormValues => {
    if (mode === 'create') return { ...values, expenseDate: todayIsoLocal() }
    return values
  }, [mode, values])

  const handleSaveDraft = useCallback(() => {
    onSaveDraft(valuesForSave(), filesByKind)
  }, [valuesForSave, filesByKind, onSaveDraft])

  const handleSubmit = useCallback(() => {
    const v = valuesForSave()
    const errs = validate(v, {
      forSubmit: true,
      filesPaymentDoc,
      filesReceipt,
      serverAttachments: editingRequest?.attachments,
    })
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setTimeout(() => {
        bodyRef.current?.querySelector('[data-err]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }
    onSubmit(v, filesByKind)
  }, [valuesForSave, filesByKind, filesPaymentDoc, filesReceipt, editingRequest?.attachments, onSubmit])

  useEffect(() => {
    if (!isOpen) {
      setRejectOpen(false)
      setReviseOpen(false)
      setRejectReason('')
      setReviseComment('')
      setModerationErr(null)
      setModerationBusy(false)
      setAttachmentOpenErr(null)
    }
  }, [isOpen])

  const isView = mode === 'view'

  const handleDeleteServerAttachment = useCallback(
    async (attId: string) => {
      if (!editingRequest || isView || !onExpenseSnapshotUpdated) return
      try {
        const r = await deleteAttachment(editingRequest.id, attId)
        onExpenseSnapshotUpdated(r)
      } catch {
        /* ошибку показывает родитель при необходимости */
      }
    },
    [editingRequest, isView, onExpenseSnapshotUpdated],
  )

  const handleOpenServerAttachment = useCallback(
    async (attId: string) => {
      if (!editingRequest) return
      setAttachmentOpenErr(null)
      try {
        await openExpenseAttachmentInNewTab(editingRequest.id, attId)
      } catch (e) {
        setAttachmentOpenErr(e instanceof Error ? e.message : 'Не удалось открыть файл')
      }
    },
    [editingRequest],
  )

  const showModerationActions =
    Boolean(canModerate && isView && editingRequest?.status === 'pending_approval')

  const handleApprove = useCallback(async () => {
    if (!editingRequest || moderationBusy) return
    setModerationErr(null)
    setModerationBusy(true)
    try {
      const r = await approveExpense(editingRequest.id)
      onExpenseUpdated?.(r)
      onClose()
    } catch (e) {
      setModerationErr(e instanceof Error ? e.message : 'Не удалось одобрить заявку')
    } finally {
      setModerationBusy(false)
    }
  }, [editingRequest, moderationBusy, onExpenseUpdated, onClose])

  const handleRejectConfirm = useCallback(async () => {
    if (!editingRequest || moderationBusy) return
    const t = rejectReason.trim()
    if (!t) {
      setModerationErr('Укажите причину отклонения')
      return
    }
    setModerationErr(null)
    setModerationBusy(true)
    try {
      const r = await rejectExpense(editingRequest.id, t)
      setRejectOpen(false)
      setRejectReason('')
      onExpenseUpdated?.(r)
      onClose()
    } catch (e) {
      setModerationErr(e instanceof Error ? e.message : 'Не удалось отклонить заявку')
    } finally {
      setModerationBusy(false)
    }
  }, [editingRequest, moderationBusy, rejectReason, onExpenseUpdated, onClose])

  const handleReviseConfirm = useCallback(async () => {
    if (!editingRequest || moderationBusy) return
    const t = reviseComment.trim()
    if (!t) {
      setModerationErr('Укажите комментарий для автора')
      return
    }
    setModerationErr(null)
    setModerationBusy(true)
    try {
      const r = await reviseExpense(editingRequest.id, t)
      setReviseOpen(false)
      setReviseComment('')
      onExpenseUpdated?.(r)
      onClose()
    } catch (e) {
      setModerationErr(e instanceof Error ? e.message : 'Не удалось вернуть заявку на доработку')
    } finally {
      setModerationBusy(false)
    }
  }, [editingRequest, moderationBusy, reviseComment, onExpenseUpdated, onClose])

  const emailIntentHandledRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      emailIntentHandledRef.current = null
      return
    }
    if (!emailModerationIntent || !editingRequest) return
    const key = `${editingRequest.id}:${emailModerationIntent}`
    if (emailIntentHandledRef.current === key) return

    if (!showModerationActions) {
      const cannotApply =
        !canModerate || editingRequest.status !== 'pending_approval'
      if (cannotApply) {
        emailIntentHandledRef.current = key
        onEmailModerationIntentConsumed?.()
      }
      return
    }

    emailIntentHandledRef.current = key
    onEmailModerationIntentConsumed?.()

    if (emailModerationIntent === 'reject') {
      setRejectOpen(true)
      return
    }
    const ok = window.confirm('Утвердить заявку по ссылке из письма?')
    if (ok) void handleApprove()
  }, [
    isOpen,
    emailModerationIntent,
    editingRequest,
    showModerationActions,
    canModerate,
    onEmailModerationIntentConsumed,
    handleApprove,
  ])

  const title = mode === 'create' ? 'Новая заявка' : mode === 'edit' ? 'Редактировать заявку' : 'Просмотр заявки'

  return (
    <>
      {rejectOpen && editingRequest && (
        <div
          className="exp-mod-backdrop"
          role="presentation"
          onClick={() => {
            if (!moderationBusy) {
              setRejectOpen(false)
              setModerationErr(null)
            }
          }}
        >
          <div className="exp-mod-dialog" role="dialog" aria-modal aria-labelledby="exp-mod-reject-title" onClick={e => e.stopPropagation()}>
            <h3 id="exp-mod-reject-title" className="exp-mod-dialog__title">Отклонить заявку</h3>
            <p className="exp-mod-dialog__sub">Заявка {editingRequest.id}. Укажите причину — автор её увидит в истории.</p>
            <textarea
              className="exp-mod-dialog__textarea"
              rows={4}
              placeholder="Причина отклонения"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              disabled={moderationBusy}
            />
            {moderationErr && rejectOpen && <p className="exp-mod-err" role="alert">{moderationErr}</p>}
            <div className="exp-mod-dialog__ft">
              <button type="button" className="exp-panel-btn exp-panel-btn--ghost" disabled={moderationBusy} onClick={() => { setRejectOpen(false); setModerationErr(null) }}>Отмена</button>
              <button type="button" className="exp-panel-btn exp-panel-btn--primary exp-panel-btn--danger" disabled={moderationBusy} onClick={handleRejectConfirm}>Отклонить</button>
            </div>
          </div>
        </div>
      )}
      {reviseOpen && editingRequest && (
        <div
          className="exp-mod-backdrop"
          role="presentation"
          onClick={() => {
            if (!moderationBusy) {
              setReviseOpen(false)
              setModerationErr(null)
            }
          }}
        >
          <div className="exp-mod-dialog" role="dialog" aria-modal aria-labelledby="exp-mod-revise-title" onClick={e => e.stopPropagation()}>
            <h3 id="exp-mod-revise-title" className="exp-mod-dialog__title">Вернуть на доработку</h3>
            <p className="exp-mod-dialog__sub">Заявка {editingRequest.id}. Автор сможет исправить заявку и отправить снова.</p>
            <textarea
              className="exp-mod-dialog__textarea"
              rows={4}
              placeholder="Что нужно исправить или дополнить"
              value={reviseComment}
              onChange={e => setReviseComment(e.target.value)}
              disabled={moderationBusy}
            />
            {moderationErr && reviseOpen && <p className="exp-mod-err" role="alert">{moderationErr}</p>}
            <div className="exp-mod-dialog__ft">
              <button type="button" className="exp-panel-btn exp-panel-btn--ghost" disabled={moderationBusy} onClick={() => { setReviseOpen(false); setModerationErr(null) }}>Отмена</button>
              <button type="button" className="exp-panel-btn exp-panel-btn--primary" disabled={moderationBusy} onClick={handleReviseConfirm}>Вернуть</button>
            </div>
          </div>
        </div>
      )}
      <div
        className={`exp-panel-overlay${isOpen ? ' exp-panel-overlay--open' : ''}`}
        aria-hidden
        onClick={() => { if (!formAsyncBusy) onClose() }}
      />
      <aside
        className={`exp-panel${isOpen ? ' exp-panel--open' : ''}${formAsyncBusy ? ' exp-panel--async-busy' : ''}`}
        aria-modal
        aria-busy={formAsyncBusy}
        aria-label={title}
      >
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
          <button type="button" className="exp-panel__close" onClick={onClose} aria-label="Закрыть" disabled={formAsyncBusy}>
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

            {editingRequest && (
              <div className="exp-form-field">
                <div className="exp-form-label">Автор заявки</div>
                <p className="exp-form-static">{formatExpenseAuthorLabel(editingRequest)}</p>
                {editingRequest.createdBy?.position && (
                  <p className="exp-form-static exp-form-static--muted">{editingRequest.createdBy.position}</p>
                )}
                {editingRequest.createdBy?.displayName && editingRequest.createdBy?.email && (
                  <p className="exp-form-static exp-form-static--muted">{editingRequest.createdBy.email}</p>
                )}
              </div>
            )}

            <div className={`exp-form-field${errors.expenseType ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Тип расхода <span className="exp-form-req">*</span></label>
              <select
                className="exp-form-select"
                value={values.expenseType}
                onChange={e => set('expenseType', e.target.value)}
                disabled={isView}
              >
                <option value="">Выберите тип</option>
                {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.expenseType && <p className="exp-form-err-msg" data-err>{errors.expenseType}</p>}
            </div>

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
          </div>

          {/* Block 2: Finances */}
          <div className="exp-form-block">
            <p className="exp-form-block__title">Финансы</p>

            {mode === 'create' && (
              <p className="exp-form-hint">
                Дата расхода — сегодняшний день; курс UZS/USD и кросс-курсы подставляются с cbu.uz на эту дату.
              </p>
            )}

            {(mode === 'edit' || mode === 'view') && values.expenseDate && (
              <div className="exp-form-field">
                <div className="exp-form-label">Дата расхода</div>
                <p className="exp-form-static">{fmtIsoDateRu(values.expenseDate)}</p>
              </div>
            )}

            <div className={`exp-form-field${errors.paymentDeadline ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Конечный срок оплаты</label>
              <input
                type="date"
                className="exp-form-input"
                value={values.paymentDeadline}
                onChange={e => set('paymentDeadline', e.target.value)}
                disabled={isView}
              />
              <p className="exp-form-hint">Необязательно: крайняя дата, к которой ожидается оплата</p>
              {errors.paymentDeadline && <p className="exp-form-err-msg" data-err>{errors.paymentDeadline}</p>}
            </div>

            <div className={`exp-form-field${errors.exchangeRate ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">Курс UZS / USD <span className="exp-form-req">*</span></label>
              <div className="exp-form-input-wrap">
                <input
                  type="number" min={0} className="exp-form-input" placeholder="12 800"
                  value={values.exchangeRate}
                  onChange={e => set('exchangeRate', e.target.value)}
                  disabled={isView || (mode === 'create' && cbuLoading)}
                />
                <span className="exp-form-suffix">UZS</span>
              </div>
              {mode === 'create' && cbuLoading && (
                <p className="exp-form-hint">Загрузка курса ЦБ РУз…</p>
              )}
              {mode === 'create' && cbuParsed && !cbuLoading && (
                <p className="exp-form-hint">Подставлено с ЦБ РУз ({cbuParsed.rateDateRu}); при необходимости скорректируйте вручную</p>
              )}
              {mode === 'create' && cbuError && !cbuLoading && (
                <p className="exp-form-err-msg" role="alert">{cbuError}. Укажите курс вручную.</p>
              )}
              {errors.exchangeRate && <p className="exp-form-err-msg" data-err>{errors.exchangeRate}</p>}
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
                <select
                  className="exp-form-currency-select"
                  value={values.amountCurrency}
                  onChange={e => setCurrency(e.target.value as ExpenseAmountCurrency)}
                  disabled={isView}
                  aria-label="Валюта суммы"
                >
                  {EXPENSE_CURRENCIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              {errors.amountUzs && <p className="exp-form-err-msg" data-err>{errors.amountUzs}</p>}
            </div>

            {showForeignRate && (
              <div className={`exp-form-field${errors.foreignPerUsd ? ' exp-form-field--err' : ''}`}>
                <label className="exp-form-label">
                  Единиц валюты за 1 USD <span className="exp-form-req">*</span>
                </label>
                <div className="exp-form-input-wrap">
                  <input
                    type="number" min={0} step="any" className="exp-form-input" placeholder="Например: 90"
                    value={values.foreignPerUsd}
                    onChange={e => set('foreignPerUsd', e.target.value)}
                    disabled={isView}
                    readOnly={!isView && foreignLocked}
                  />
                </div>
                <p className="exp-form-hint">
                  {foreignLocked
                    ? 'Рассчитано по курсам ЦБ РУз (через сум к USD и к выбранной валюте)'
                    : 'Сколько единиц выбранной валюты составляет 1 USD на дату расхода'}
                </p>
                {errors.foreignPerUsd && <p className="exp-form-err-msg" data-err>{errors.foreignPerUsd}</p>}
              </div>
            )}

            <div className="exp-form-field">
              <label className="exp-form-label">Эквивалентная сумма</label>
              <div className="exp-form-input-wrap">
                <input
                  type="text" className="exp-form-input exp-form-input--calc"
                  value={equiv || (isView ? viewEquivFromServer : '')}
                  readOnly tabIndex={-1}
                  placeholder="—"
                />
                <span className="exp-form-suffix">USD</span>
              </div>
              <p className="exp-form-hint">{equivHint}</p>
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

            <div className={`exp-form-field${errors.isReimbursable ? ' exp-form-field--err' : ''}`}>
              <div className="exp-form-switch-row">
                <div className="exp-form-switch-info">
                  <span className="exp-form-label" style={{ marginBottom: 0 }}>
                    Возмещаемый расход <span className="exp-form-req">*</span>
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={values.isReimbursable === true}
                  className={`exp-form-switch${values.isReimbursable === true ? ' exp-form-switch--on' : ''}${isView ? ' exp-form-switch--disabled' : ''}`}
                  onClick={() => { if (!isView) setReimb(values.isReimbursable !== true) }}
                >
                  <span className="exp-form-switch__thumb" />
                </button>
              </div>
              {errors.isReimbursable && <p className="exp-form-err-msg" data-err>{errors.isReimbursable}</p>}
            </div>
          </div>

          {/* Block 3: Additional — для невозмещаемого расхода поля необязательны */}
          <div className="exp-form-block">
            <p className="exp-form-block__title">Дополнительно</p>
            {values.isReimbursable === false && (
              <p className="exp-form-hint" style={{ margin: '-0.35rem 0 0 0' }}>
                Для невозмещаемого расхода этот блок заполнять не требуется
              </p>
            )}
            {values.isReimbursable === true && (
              <p className="exp-form-hint" style={{ margin: '-0.35rem 0 0 0' }}>
                Проект и контрагент — по желанию; для типа «Прочее» нужен комментарий
              </p>
            )}

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

            <div className={`exp-form-field${errors.comment ? ' exp-form-field--err' : ''}`}>
              <label className="exp-form-label">
                Комментарий
                {values.isReimbursable === true && values.expenseType === 'other' && (
                  <span className="exp-form-req"> *</span>
                )}
              </label>
              <textarea
                className="exp-form-textarea"
                placeholder="Дополнительная информация"
                value={values.comment}
                onChange={e => {
                  set('comment', e.target.value)
                  if (errors.comment) setErrors(prev => ({ ...prev, comment: undefined }))
                }}
                disabled={isView}
                rows={3}
              />
              {errors.comment && <p className="exp-form-err-msg" data-err>{errors.comment}</p>}
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

            {fileSizeHint && (
              <p className="exp-form-err-msg" role="status">{fileSizeHint}</p>
            )}
            {attachmentOpenErr && (
              <p className="exp-form-err-msg" role="alert">{attachmentOpenErr}</p>
            )}

            {(() => {
              const allAtt = editingRequest?.attachments ?? []
              const serverPaymentDoc = allAtt.filter(a => a.attachmentKind === 'payment_document')
              const serverReceipt = allAtt.filter(a => a.attachmentKind === 'payment_receipt')
              const serverLegacy = allAtt.filter(a => !a.attachmentKind)
              const showServerDelete = !isView && Boolean(onExpenseSnapshotUpdated)

              const fileIcon = (
                <svg className="exp-form-file-zone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              )

              return (
                <>
                  <div className={`exp-form-field${errors.attachmentsPaymentDoc ? ' exp-form-field--err' : ''}`}>
                    <label className="exp-form-label">Документ для оплаты</label>
                    {!isView && (
                      <div
                        className="exp-form-file-zone"
                        role="button" tabIndex={0}
                        onClick={() => { setFileSizeHint(null); fileInputPaymentRef.current?.click() }}
                        onKeyDown={e => e.key === 'Enter' && fileInputPaymentRef.current?.click()}
                      >
                        <input
                          ref={fileInputPaymentRef} type="file" multiple
                          style={{ display: 'none' }}
                          onChange={e => {
                            appendFilesChecked(
                              e.target.files,
                              setFilesPaymentDoc,
                              name => { setFileSizeHint(`Файл «${name}» больше 15 МБ`) },
                            )
                            setErrors(prev => ({ ...prev, attachmentsPaymentDoc: undefined }))
                            e.target.value = ''
                          }}
                        />
                        {fileIcon}
                        <p className="exp-form-file-zone__label">Нажмите для загрузки</p>
                        <p className="exp-form-file-zone__hint">Любой формат · до 15 МБ</p>
                      </div>
                    )}
                    {errors.attachmentsPaymentDoc && (
                      <p className="exp-form-err-msg" data-err>{errors.attachmentsPaymentDoc}</p>
                    )}
                    {filesPaymentDoc.length > 0 && (
                      <ul className="exp-form-file-list">
                        {filesPaymentDoc.map((f, i) => (
                          <li key={`pd-${f.name}-${i}`} className="exp-form-file-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span className="exp-form-file-item__name">{f.name}</span>
                            <span className="exp-form-file-item__size">{(f.size / 1024).toFixed(0)} КБ</span>
                            {!isView && (
                              <button
                                type="button" aria-label="Удалить"
                                className="exp-form-file-item__del"
                                onClick={() => setFilesPaymentDoc(prev => prev.filter((_, j) => j !== i))}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {serverPaymentDoc.length > 0 && (
                      <ul className="exp-form-file-list">
                        {serverPaymentDoc.map(f => (
                          <li key={f.id} className="exp-form-file-item exp-form-file-item--server">
                            <button
                              type="button"
                              className="exp-form-file-item__open"
                              onClick={() => void handleOpenServerAttachment(f.id)}
                              aria-label={`Открыть «${f.fileName}»`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span className="exp-form-file-item__name">{f.fileName}</span>
                              <span className="exp-form-file-item__size">{(f.sizeBytes / 1024).toFixed(0)} КБ</span>
                            </button>
                            {showServerDelete && (
                              <button
                                type="button" aria-label="Удалить"
                                className="exp-form-file-item__del"
                                onClick={() => handleDeleteServerAttachment(f.id)}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className={`exp-form-field${errors.attachmentsReceipt ? ' exp-form-field--err' : ''}`}>
                    <label className="exp-form-label">Квитанция об оплате</label>
                    {!isView && (
                      <div
                        className="exp-form-file-zone"
                        role="button" tabIndex={0}
                        onClick={() => { setFileSizeHint(null); fileInputReceiptRef.current?.click() }}
                        onKeyDown={e => e.key === 'Enter' && fileInputReceiptRef.current?.click()}
                      >
                        <input
                          ref={fileInputReceiptRef} type="file" multiple
                          style={{ display: 'none' }}
                          onChange={e => {
                            appendFilesChecked(
                              e.target.files,
                              setFilesReceipt,
                              name => { setFileSizeHint(`Файл «${name}» больше 15 МБ`) },
                            )
                            setErrors(prev => ({ ...prev, attachmentsReceipt: undefined }))
                            e.target.value = ''
                          }}
                        />
                        {fileIcon}
                        <p className="exp-form-file-zone__label">Нажмите для загрузки</p>
                        <p className="exp-form-file-zone__hint">Любой формат · до 15 МБ</p>
                      </div>
                    )}
                    {errors.attachmentsReceipt && (
                      <p className="exp-form-err-msg" data-err>{errors.attachmentsReceipt}</p>
                    )}
                    {filesReceipt.length > 0 && (
                      <ul className="exp-form-file-list">
                        {filesReceipt.map((f, i) => (
                          <li key={`pr-${f.name}-${i}`} className="exp-form-file-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span className="exp-form-file-item__name">{f.name}</span>
                            <span className="exp-form-file-item__size">{(f.size / 1024).toFixed(0)} КБ</span>
                            {!isView && (
                              <button
                                type="button" aria-label="Удалить"
                                className="exp-form-file-item__del"
                                onClick={() => setFilesReceipt(prev => prev.filter((_, j) => j !== i))}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {serverReceipt.length > 0 && (
                      <ul className="exp-form-file-list">
                        {serverReceipt.map(f => (
                          <li key={f.id} className="exp-form-file-item exp-form-file-item--server">
                            <button
                              type="button"
                              className="exp-form-file-item__open"
                              onClick={() => void handleOpenServerAttachment(f.id)}
                              aria-label={`Открыть «${f.fileName}»`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span className="exp-form-file-item__name">{f.fileName}</span>
                              <span className="exp-form-file-item__size">{(f.sizeBytes / 1024).toFixed(0)} КБ</span>
                            </button>
                            {showServerDelete && (
                              <button
                                type="button" aria-label="Удалить"
                                className="exp-form-file-item__del"
                                onClick={() => handleDeleteServerAttachment(f.id)}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {serverLegacy.length > 0 && (
                    <div className="exp-form-field">
                      <label className="exp-form-label">Ранее загруженные вложения</label>
                      <ul className="exp-form-file-list">
                        {serverLegacy.map(f => (
                          <li key={f.id} className="exp-form-file-item exp-form-file-item--server">
                            <button
                              type="button"
                              className="exp-form-file-item__open"
                              onClick={() => void handleOpenServerAttachment(f.id)}
                              aria-label={`Открыть «${f.fileName}»`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="exp-form-file-item__icon">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span className="exp-form-file-item__name">{f.fileName}</span>
                              <span className="exp-form-file-item__size">{(f.sizeBytes / 1024).toFixed(0)} КБ</span>
                            </button>
                            {showServerDelete && (
                              <button
                                type="button" aria-label="Удалить"
                                className="exp-form-file-item__del"
                                onClick={() => handleDeleteServerAttachment(f.id)}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isView && editingRequest && allAtt.length === 0 && (
                    <p className="exp-form-no-files">Документы не прикреплены</p>
                  )}
                </>
              )
            })()}
          </div>
        </div>

        {/* Footer */}
        {!isView ? (
          <div className="exp-panel__ft">
            <button type="button" className="exp-panel-btn exp-panel-btn--ghost" onClick={onClose} disabled={formAsyncBusy}>
              Отмена
            </button>
            <button
              type="button"
              className="exp-panel-btn exp-panel-btn--outline"
              onClick={handleSaveDraft}
              disabled={formAsyncBusy}
              aria-busy={saveDraftPending}
            >
              {saveDraftPending ? (
                <>
                  <PanelBtnSpinner />
                  Сохранение…
                </>
              ) : (
                'Сохранить черновик'
              )}
            </button>
            <button
              type="button"
              className="exp-panel-btn exp-panel-btn--primary"
              onClick={handleSubmit}
              disabled={formAsyncBusy}
              aria-busy={submitPending}
            >
              {submitPending ? (
                <>
                  <PanelBtnSpinner />
                  Отправка…
                </>
              ) : (
                'Отправить'
              )}
            </button>
          </div>
        ) : (
          <div className={`exp-panel__ft${showModerationActions ? ' exp-panel__ft--moderate' : ''}`}>
            {showModerationActions && (
              <div className="exp-panel__ft-moderate">
                {moderationErr && !rejectOpen && !reviseOpen && (
                  <p className="exp-mod-err exp-mod-err--inline" role="alert">{moderationErr}</p>
                )}
                <div className="exp-panel__ft-moderate-btns">
                  <button type="button" className="exp-panel-btn exp-panel-btn--primary" disabled={moderationBusy} onClick={handleApprove}>
                    Одобрить
                  </button>
                  <button
                    type="button"
                    className="exp-panel-btn exp-panel-btn--outline"
                    disabled={moderationBusy}
                    onClick={() => { setModerationErr(null); setReviseOpen(true) }}
                  >
                    На доработку
                  </button>
                  <button
                    type="button"
                    className="exp-panel-btn exp-panel-btn--outline exp-panel-btn--danger-outline"
                    disabled={moderationBusy}
                    onClick={() => { setModerationErr(null); setRejectOpen(true) }}
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            )}
            <button type="button" className="exp-panel-btn exp-panel-btn--outline" onClick={onClose}>Закрыть</button>
          </div>
        )}
        {formAsyncBusy && (
          <div className="exp-panel__async-busy-layer" role="status" aria-live="polite">
            <PanelBtnSpinner className="exp-panel__async-busy-spinner" />
            <span className="exp-panel__async-busy-label">
              {submitPending ? 'Отправка заявки…' : 'Сохранение черновика…'}
            </span>
          </div>
        )}
      </aside>
    </>
  )
}
