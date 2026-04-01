import { useState, useCallback, useEffect } from 'react'
import type { ExpenseRequest, ExpenseType } from '../model/types'
import { EXPENSE_TYPES, STATUS_META } from '../model/constants'
import {
  exportExpensesToExcel,
  DEFAULT_REPORT_CONFIG,
  type ReportConfig,
  type ReportCurrency,
} from '../lib/exportExpenses'

type Props = {
  isOpen: boolean
  requests: ExpenseRequest[]
  onClose: () => void
}

const CURRENCIES: { value: ReportCurrency; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'RUB', label: 'RUB' },
]

const STATUSES = Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))

export function ExpensesReportModal({ isOpen, requests, onClose }: Props) {
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG)
  const [isLoading, setIsLoading] = useState(false)
  const [allTypes, setAllTypes] = useState(true)
  const [allStatuses, setAllStatuses] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setConfig(DEFAULT_REPORT_CONFIG)
      setAllTypes(true)
      setAllStatuses(true)
      setIsLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const set = useCallback(<K extends keyof ReportConfig>(key: K, val: ReportConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }))
  }, [])

  const toggleType = useCallback((type: string) => {
    setConfig(prev => {
      const has = prev.selectedTypes.includes(type as never)
      return {
        ...prev,
        selectedTypes: has
          ? prev.selectedTypes.filter(t => t !== type)
          : [...prev.selectedTypes, type as never],
      }
    })
  }, [])

  const toggleStatus = useCallback((status: string) => {
    setConfig(prev => {
      const has = prev.selectedStatuses.includes(status as never)
      return {
        ...prev,
        selectedStatuses: has
          ? prev.selectedStatuses.filter(s => s !== status)
          : [...prev.selectedStatuses, status as never],
      }
    })
  }, [])

  const handleAllTypes = useCallback((checked: boolean) => {
    setAllTypes(checked)
    if (checked) setConfig(prev => ({ ...prev, selectedTypes: [] }))
  }, [])

  const handleAllStatuses = useCallback((checked: boolean) => {
    setAllStatuses(checked)
    if (checked) setConfig(prev => ({ ...prev, selectedStatuses: [] }))
  }, [])

  const handleGenerate = useCallback(async () => {
    setIsLoading(true)
    try {
      await exportExpensesToExcel(requests, config)
      onClose()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [requests, config, onClose])

  if (!isOpen) return null

  const previewCount = requests.filter(r => {
    if (config.dateFrom && r.expenseDate < config.dateFrom) return false
    if (config.dateTo   && r.expenseDate > config.dateTo)   return false
    if (!allTypes && config.selectedTypes.length && !config.selectedTypes.includes(r.expenseType as ExpenseType)) return false
    if (!allStatuses && config.selectedStatuses.length && !config.selectedStatuses.includes(r.status as never)) return false
    if (config.reimbursable === 'reimbursable'     && !r.isReimbursable) return false
    if (config.reimbursable === 'non_reimbursable' && r.isReimbursable)  return false
    return true
  }).length

  return (
    <>
      <div className="rep-overlay" aria-hidden onClick={onClose} />
      <div className="rep-modal" role="dialog" aria-modal aria-label="Создать отчёт">
        {/* Header */}
        <div className="rep-modal__hd">
          <div className="rep-modal__hd-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <h2 className="rep-modal__title">Создать отчёт Excel</h2>
            <p className="rep-modal__sub">Настройте параметры и скачайте файл</p>
          </div>
          <button type="button" className="rep-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="rep-modal__body">
          {/* Report title */}
          <div className="rep-field">
            <label className="rep-label">Название отчёта</label>
            <input
              type="text"
              className="rep-input"
              value={config.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Отчёт по расходам компании"
            />
          </div>

          {/* Period */}
          <div className="rep-field">
            <label className="rep-label">Период</label>
            <div className="rep-date-row">
              <div className="rep-date-wrap">
                <span className="rep-date-label">С</span>
                <input type="date" className="rep-input rep-input--date" value={config.dateFrom} onChange={e => set('dateFrom', e.target.value)} />
              </div>
              <div className="rep-date-wrap">
                <span className="rep-date-label">По</span>
                <input type="date" className="rep-input rep-input--date" value={config.dateTo} onChange={e => set('dateTo', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Currency */}
          <div className="rep-field">
            <label className="rep-label">Валюта эквивалента</label>
            <div className="rep-radio-row">
              {CURRENCIES.map(c => (
                <label key={c.value} className={`rep-radio${config.currency === c.value ? ' rep-radio--on' : ''}`}>
                  <input type="radio" name="currency" value={c.value} checked={config.currency === c.value} onChange={() => set('currency', c.value)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {/* Expense types */}
          <div className="rep-field">
            <label className="rep-label">Типы расходов</label>
            <label className="rep-check rep-check--all">
              <input type="checkbox" checked={allTypes} onChange={e => handleAllTypes(e.target.checked)} />
              <span>Все типы</span>
            </label>
            {!allTypes && (
              <div className="rep-check-grid">
                {EXPENSE_TYPES.map(t => (
                  <label key={t.value} className={`rep-check${config.selectedTypes.includes(t.value) ? ' rep-check--on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={config.selectedTypes.includes(t.value)}
                      onChange={() => toggleType(t.value)}
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Statuses */}
          <div className="rep-field">
            <label className="rep-label">Статусы</label>
            <label className="rep-check rep-check--all">
              <input type="checkbox" checked={allStatuses} onChange={e => handleAllStatuses(e.target.checked)} />
              <span>Все статусы</span>
            </label>
            {!allStatuses && (
              <div className="rep-check-grid">
                {STATUSES.map(s => (
                  <label key={s.value} className={`rep-check${config.selectedStatuses.includes(s.value as never) ? ' rep-check--on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={config.selectedStatuses.includes(s.value as never)}
                      onChange={() => toggleStatus(s.value)}
                    />
                    <span className={`exp-status exp-status--${s.value}`}>{s.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Reimbursable */}
          <div className="rep-field">
            <label className="rep-label">Возмещаемость</label>
            <div className="rep-radio-row">
              {[
                { value: 'all', label: 'Все' },
                { value: 'reimbursable', label: 'Возмещаемые' },
                { value: 'non_reimbursable', label: 'Невозмещаемые' },
              ].map(o => (
                <label key={o.value} className={`rep-radio${config.reimbursable === o.value ? ' rep-radio--on' : ''}`}>
                  <input type="radio" name="reimbursable" value={o.value} checked={config.reimbursable === o.value} onChange={() => set('reimbursable', o.value as ReportConfig['reimbursable'])} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="rep-modal__ft">
          <div className="rep-modal__preview">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            В отчёт войдёт <strong>{previewCount}</strong> {previewCount === 1 ? 'запись' : previewCount < 5 ? 'записи' : 'записей'}
          </div>
          <div className="rep-modal__actions">
            <button type="button" className="rep-btn rep-btn--ghost" onClick={onClose} disabled={isLoading}>
              Отмена
            </button>
            <button type="button" className="rep-btn rep-btn--primary" onClick={handleGenerate} disabled={isLoading || previewCount === 0}>
              {isLoading ? (
                <>
                  <svg className="rep-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Формирование…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Скачать Excel
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
