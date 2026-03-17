import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCheck, IconCollapseColumn, IconMore, IconPlus, IconStack } from './TodoIcons'
import type { TodoCard } from '../services/todoUtils'

type ColumnConfig = {
  id: string
  title: string
  collapsedLabel: string
}

type TodoColumnProps = {
  config: ColumnConfig
  isCollapsed: boolean
  cards: TodoCard[]
  isDragging: boolean
  isDropTarget: boolean
  onColumnMouseDown: (e: React.MouseEvent, id: string) => void
  onColumnKeyDown: (id: string) => void
  onToggleCollapse: (id: string) => void
  onExpand: (id: string) => void
  onAddCardClick: (id: string) => void
  onCardClick: (columnId: string, cardId: string) => void
  onCardToggleComplete: (columnId: string, cardId: string) => void
  onSortCards: (columnId: string, mode: 'az' | 'za' | 'newest' | 'oldest' | 'done') => void
  onRenameColumn: (columnId: string, title: string) => void
  onClearColumn: (columnId: string) => void
  onDeleteColumn: (columnId: string) => void
  onCardDragStart?: (e: React.MouseEvent, columnId: string, cardId: string, cardRect: DOMRect) => void
  isCardDropTarget?: boolean
  draggingCard?: { columnId: string; cardId: string } | null
  columnRef: (node: HTMLDivElement | null) => void
}

type MenuType = 'stack' | 'more' | null

export const TodoColumn = memo(function TodoColumn({
  config,
  isCollapsed,
  cards,
  isDragging,
  isDropTarget,
  onColumnMouseDown,
  onColumnKeyDown,
  onToggleCollapse,
  onExpand,
  onAddCardClick,
  onCardClick,
  onCardToggleComplete,
  onSortCards,
  onRenameColumn,
  onClearColumn,
  onDeleteColumn,
  onCardDragStart,
  isCardDropTarget,
  draggingCard,
  columnRef,
}: TodoColumnProps) {
  const { id } = config
  const doneCount = cards.filter((c) => c.completed).length
  const [openMenu, setOpenMenu] = useState<MenuType>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(config.title)
  const menuRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

  const toggleMenu = useCallback((m: MenuType) => {
    setOpenMenu((prev) => (prev === m ? null : m))
  }, [])

  useLayoutEffect(() => {
    if (!openMenu || !actionsRef.current) return
    const rect = actionsRef.current.getBoundingClientRect()
    const page = actionsRef.current.closest('.todo-page') as HTMLElement | null
    const vars: Record<string, string> = {}
    if (page) {
      const cs = getComputedStyle(page)
      ;['--todo-accent', '--todo-text', '--todo-muted', '--todo-surface', '--todo-panel-bg', '--todo-border'].forEach((n) => {
        vars[n] = cs.getPropertyValue(n).trim()
      })
    }
    setMenuStyle({ top: rect.bottom + 4, left: Math.max(8, rect.right - 200), ...vars } as React.CSSProperties)
  }, [openMenu])

  useEffect(() => {
    if (!openMenu) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [openMenu])

  const submitRename = () => {
    if (renameVal.trim() && renameVal.trim() !== config.title) {
      onRenameColumn(id, renameVal.trim())
    }
    setRenaming(false)
    setOpenMenu(null)
  }

  return (
    <div
      ref={columnRef}
      data-todo-column-id={id}
      className={[
        'todo-column',
        `todo-column--${id}`,
        isCollapsed && 'todo-column--collapsed',
        isDragging && 'todo-column--dragging',
        isDropTarget && 'todo-column--drop-target',
        isCardDropTarget && 'todo-column--card-drop-target',
      ].filter(Boolean).join(' ')}
    >
      <div
        className="todo-column__head"
        onMouseDown={(e) => { if (!openMenu) onColumnMouseDown(e, id) }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onColumnKeyDown(id)}
        aria-label="Перетащить колонку"
      >
        <div className="todo-column__head-left">
          <span className="todo-column__dot" />
          <h2 className="todo-column__title">{config.title}</h2>
          <span className="todo-column__count">{cards.length}</span>
        </div>
        <div className="todo-column__actions" ref={actionsRef}>
          <button type="button" className={`todo-column__action${openMenu === 'stack' ? ' todo-column__action--active' : ''}`} aria-label="Сортировка" onClick={(e) => { e.stopPropagation(); toggleMenu('stack') }}>
            <IconStack />
          </button>
          <button type="button" className={`todo-column__action${openMenu === 'more' ? ' todo-column__action--active' : ''}`} aria-label="Ещё" onClick={(e) => { e.stopPropagation(); toggleMenu('more') }}>
            <IconMore />
          </button>
          <button
            type="button"
            className="todo-column__action"
            aria-label={isCollapsed ? 'Развернуть колонку' : 'Свернуть колонку'}
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(id) }}
          >
            <IconCollapseColumn />
          </button>
        </div>

        {openMenu === 'stack' && createPortal(
          <div ref={menuRef} className="todo-col-menu" style={menuStyle} onClick={(e) => e.stopPropagation()}>
            <div className="todo-col-menu__title">Сортировка</div>
            <button type="button" className="todo-col-menu__item" onClick={() => { onSortCards(id, 'az'); setOpenMenu(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h13M3 12h9M3 18h5"/><path d="m16 6 4 6h-8l4-6Z"/></svg>
              А → Я
            </button>
            <button type="button" className="todo-col-menu__item" onClick={() => { onSortCards(id, 'za'); setOpenMenu(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h5M3 12h9M3 18h13"/><path d="m16 18 4-6h-8l4 6Z"/></svg>
              Я → А
            </button>
            <button type="button" className="todo-col-menu__item" onClick={() => { onSortCards(id, 'newest'); setOpenMenu(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Новые сверху
            </button>
            <button type="button" className="todo-col-menu__item" onClick={() => { onSortCards(id, 'oldest'); setOpenMenu(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 8 14"/></svg>
              Старые сверху
            </button>
            <button type="button" className="todo-col-menu__item" onClick={() => { onSortCards(id, 'done'); setOpenMenu(null) }}>
              <IconCheck />
              Выполненные вниз
            </button>
          </div>,
          document.body,
        )}

        {openMenu === 'more' && createPortal(
          <div ref={menuRef} className="todo-col-menu" style={menuStyle} onClick={(e) => e.stopPropagation()}>
            {!renaming ? (
              <>
                <button type="button" className="todo-col-menu__item" onClick={() => { setRenaming(true); setRenameVal(config.title) }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  Переименовать
                </button>
                <button type="button" className="todo-col-menu__item" onClick={() => { onAddCardClick(id); setOpenMenu(null) }}>
                  <IconPlus />
                  Добавить карточку
                </button>
                <div className="todo-col-menu__sep" />
                <button type="button" className="todo-col-menu__item" onClick={() => { onClearColumn(id); setOpenMenu(null) }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  Очистить колонку
                </button>
                <button type="button" className="todo-col-menu__item todo-col-menu__item--danger" onClick={() => { onDeleteColumn(id); setOpenMenu(null) }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Удалить колонку
                </button>
              </>
            ) : (
              <div className="todo-col-menu__rename">
                <input
                  className="todo-col-menu__input"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setRenaming(false); setOpenMenu(null) } }}
                  autoFocus
                />
                <div className="todo-col-menu__rename-actions">
                  <button type="button" className="todo-col-menu__rename-btn todo-col-menu__rename-btn--save" onClick={submitRename}>Сохранить</button>
                  <button type="button" className="todo-col-menu__rename-btn" onClick={() => { setRenaming(false); setOpenMenu(null) }}>Отмена</button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
      </div>

      {doneCount > 0 && cards.length > 0 && (
        <div className="todo-column__progress">
          <div className="todo-column__progress-bar" style={{ width: `${Math.round((doneCount / cards.length) * 100)}%` }} />
        </div>
      )}

      <div className="todo-column__cards">
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            columnId={id}
            onCardClick={onCardClick}
            onCardToggleComplete={onCardToggleComplete}
            onCardDragStart={onCardDragStart}
            isDragging={draggingCard?.columnId === id && draggingCard?.cardId === card.id}
          />
        ))}
      </div>

      <button
        type="button"
        className="todo-column__add"
        onClick={(e) => { e.stopPropagation(); onAddCardClick(id) }}
      >
        <IconPlus />
        <span>Добавить карточку</span>
      </button>

      <div
        className="todo-column__collapsed-label"
        onClick={() => onExpand(id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onExpand(id)}
        aria-label={`Развернуть колонку ${config.title}`}
      >
        <span className="todo-column__collapsed-icon"><IconCollapseColumn /></span>
        <span className="todo-column__collapsed-text">{config.collapsedLabel}</span>
      </div>
    </div>
  )
})

const CardItem = memo(function CardItem({
  card,
  columnId,
  onCardClick,
  onCardToggleComplete,
  onCardDragStart,
  isDragging,
}: {
  card: TodoCard
  columnId: string
  onCardClick: (columnId: string, cardId: string) => void
  onCardToggleComplete: (columnId: string, cardId: string) => void
  onCardDragStart?: (e: React.MouseEvent, columnId: string, cardId: string, cardRect: DOMRect) => void
  isDragging?: boolean
}) {
  const hasLabels = (card.labels?.length ?? 0) > 0
  const hasDesc = !!card.description
  const hasDue = !!card.dueDate
  const hasChecklist = (card.checklist?.length ?? 0) > 0
  const hasMembers = (card.members?.length ?? 0) > 0
  const hasMeta = hasDesc || hasDue || hasChecklist
  const checkDone = hasChecklist ? card.checklist!.filter((i) => i.done).length : 0
  const checkTotal = hasChecklist ? card.checklist!.length : 0

  const isCalendar = !!card.fromCalendar

  const handleCardMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if ((e.target as HTMLElement).closest('button')) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      onCardDragStart?.(e, columnId, card.id, rect)
    },
    [columnId, card.id, onCardDragStart]
  )

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        'todo-card',
        card.completed && 'todo-card--completed',
        isCalendar && 'todo-card--calendar',
        isDragging && 'todo-card--dragging',
      ].filter(Boolean).join(' ')}
      onClick={() => onCardClick(columnId, card.id)}
      onKeyDown={(e) => e.key === 'Enter' && onCardClick(columnId, card.id)}
      onMouseDown={handleCardMouseDown}
    >
      {isCalendar && (
        <div className="todo-card__cal-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Outlook</span>
        </div>
      )}

      {hasLabels && (
        <div className="todo-card__labels">
          {card.labels!.map((l) => (
            <span key={l.id} className="todo-card__label" style={{ background: l.color }}>{l.text}</span>
          ))}
        </div>
      )}

      <div className="todo-card__row">
        {!isCalendar && (
          <button
            type="button"
            className="todo-card__checkbox"
            onClick={(e) => { e.stopPropagation(); onCardToggleComplete(columnId, card.id) }}
            aria-label={card.completed ? 'Снять отметку выполнено' : 'Отметить выполнено'}
            aria-pressed={card.completed}
          >
            {card.completed && <IconCheck />}
          </button>
        )}
        <span className="todo-card__title">{card.title}</span>
      </div>

      {isCalendar && card.calendarTime && (
        <div className="todo-card__cal-time">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>{card.calendarTime}</span>
        </div>
      )}

      {!isCalendar && hasMeta && (
        <div className="todo-card__meta">
          {hasDue && (
            <span className="todo-card__meta-chip todo-card__meta-chip--due">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {new Date(card.dueDate!).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
              {card.dueTime && ` ${card.dueTime}`}
            </span>
          )}
          {hasDesc && (
            <span className="todo-card__meta-chip" title="Есть описание">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/></svg>
            </span>
          )}
          {hasChecklist && (
            <span className={`todo-card__meta-chip${checkDone === checkTotal ? ' todo-card__meta-chip--done' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              {checkDone}/{checkTotal}
            </span>
          )}
        </div>
      )}

      {isCalendar && hasDue && (
        <div className="todo-card__meta">
          <span className="todo-card__meta-chip todo-card__meta-chip--due">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {new Date(card.dueDate!).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      )}

      {hasMembers && (
        <div className="todo-card__members">
          {card.members!.slice(0, 4).map((m) => (
            <span key={m} className="todo-card__avatar" title={m}>{m[0].toUpperCase()}</span>
          ))}
          {card.members!.length > 4 && (
            <span className="todo-card__avatar todo-card__avatar--more">+{card.members!.length - 4}</span>
          )}
        </div>
      )}
    </div>
  )
})
