import { useState, useRef, useEffect, useMemo, useId, type ReactNode, type KeyboardEvent } from 'react'
import './TimesheetSearchableSelect.css'

type Props<T> = {
  disabled?: boolean
  placeholder?: string
  emptyListText?: string
  noMatchText?: string
  value: string
  items: readonly T[]
  getOptionValue: (item: T) => string
  getOptionLabel: (item: T) => string
  getSearchText: (item: T) => string
  filterItems?: (items: readonly T[], queryLowerTrimmed: string) => T[]
  onSelect: (item: T) => void
  renderOption?: (item: T, opts: { active: boolean; selected: boolean }) => ReactNode
  className?: string
  buttonClassName?: string
  /** Связь с внешним &lt;label htmlFor&gt; */
  buttonId?: string
  'aria-labelledby'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export function TimesheetSearchableSelect<T>({
  disabled = false,
  placeholder = 'Выберите…',
  emptyListText = 'Нет вариантов',
  noMatchText = 'Ничего не найдено',
  value,
  items,
  getOptionValue,
  getOptionLabel,
  getSearchText,
  filterItems,
  onSelect,
  renderOption,
  className = '',
  buttonClassName = '',
  buttonId,
  'aria-labelledby': ariaLabelledBy,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: Props<T>) {
  const listId = useId()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedItem = useMemo(
    () => items.find((it) => getOptionValue(it) === value) ?? null,
    [items, value, getOptionValue],
  )
  const displayLabel = selectedItem ? getOptionLabel(selectedItem) : ''

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (filterItems) return filterItems(items, q)
    if (!q) return [...items]
    return items.filter((it) => getSearchText(it).toLowerCase().includes(q))
  }, [items, query, getSearchText, filterItems])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className={`tsp-srch ${className}${open ? ' tsp-srch--open' : ''}`}>
      <button
        type="button"
        id={buttonId}
        className={`tsp-srch__btn ${buttonClassName}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onClick={() => {
          if (!disabled) setOpen((o) => !o)
        }}
      >
        <span className={`tsp-srch__btn-text${!displayLabel ? ' tsp-srch__btn-text--placeholder' : ''}`}>
          {displayLabel || placeholder}
        </span>
        <span className="tsp-srch__chev" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="tsp-srch__dropdown" role="presentation" onKeyDown={onKeyDown}>
          <div className="tsp-srch__search">
            <label htmlFor={inputId} className="tsp-srch__search-label">
              Поиск
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              className="tsp-srch__input"
              placeholder="Начните вводить…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setOpen(false)
                }
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <ul id={listId} className="tsp-srch__list" role="listbox" aria-label="Варианты">
            {items.length === 0 ? (
              <li className="tsp-srch__empty" role="presentation">
                {emptyListText}
              </li>
            ) : filtered.length === 0 ? (
              <li className="tsp-srch__empty" role="presentation">
                {noMatchText}
              </li>
            ) : (
              filtered.map((it) => {
                const v = getOptionValue(it)
                const selected = v === value
                return (
                  <li key={v} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`tsp-srch__opt${selected ? ' tsp-srch__opt--selected' : ''}`}
                      onClick={() => {
                        onSelect(it)
                        setOpen(false)
                      }}
                    >
                      {renderOption ? renderOption(it, { active: false, selected }) : getOptionLabel(it)}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
