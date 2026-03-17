import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatedLink } from '@shared/ui'
import { routes } from '@shared/config'
import { buildMonthGrid, type TodoCard, type ArchivedCard, type ColumnId } from '../services/todoUtils'
import { deriveColumnColors, deriveThemeFromImage, type ThemeVars } from '../services/todoTheme'
import {
  getCalendarStatus,
  getCalendarEvents,
  connectOutlookCalendar,
  createCalendarEvent,
  type CalendarEvent,
} from '../services/calendarApi'
import { setCalendarCache } from '../services/calendarCache'
import {
  IconBack,
  IconImage,
  IconSettings,
  IconDownload,
  IconUpload,
  IconPlus,
} from './TodoIcons'
import { TodoPlanner } from './TodoPlanner'
import { TodoColumn } from './TodoColumn'
import { TodoAddColumnModal } from './TodoAddColumnModal'
import { TodoAddCardModal } from './TodoAddCardModal'
import { TodoCardModal } from './TodoCardModal'
import './TodoPage.css'

export function TodoPage() {
  const [plannerCollapsed, setPlannerCollapsed] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [prevBackground, setPrevBackground] = useState<string | null>(null)
  const [bgTransitioning, setBgTransitioning] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const defaultColumnIds = ['today', 'week', 'later'] as const
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(() => [...defaultColumnIds])
  const [columnTitles, setColumnTitles] = useState<Record<string, string>>(() => ({
    today: 'Сегодня',
    week: 'На этой неделе',
    later: 'Позже',
  }))
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({})
  const [draggingColumn, setDraggingColumn] = useState<ColumnId | null>(null)
  const [dropTarget, setDropTarget] = useState<ColumnId | null>(null)
  const [columnDragPreviewPosition, setColumnDragPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  const columnDragOffsetRef = useRef({ x: 0, y: 0 })
  const [draggingCard, setDraggingCard] = useState<{ columnId: string; cardId: string } | null>(null)
  const [dropTargetCardColumn, setDropTargetCardColumn] = useState<ColumnId | null>(null)
  const dropTargetCardColumnRef = useRef<ColumnId | null>(null)
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  const cardDragOffsetRef = useRef({ x: 0, y: 0 })
  const [calendarColumnOverrides, setCalendarColumnOverrides] = useState<Record<string, ColumnId>>(() => {
    const CALENDAR_OVERRIDES_KEY = 'todoCalendarColumnOverrides'
    try {
      const raw = localStorage.getItem(CALENDAR_OVERRIDES_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, string>
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  })
  const calendarOverridesKey = 'todoCalendarColumnOverrides'
  useEffect(() => {
    try {
      localStorage.setItem(calendarOverridesKey, JSON.stringify(calendarColumnOverrides))
    } catch {
    }
  }, [calendarColumnOverrides])
  const [isPanning, setIsPanning] = useState(false)
  const [addCardColumn, setAddCardColumn] = useState<ColumnId | null>(null)
  const [addCardTitle, setAddCardTitle] = useState('')
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  const [addColumnTitle, setAddColumnTitle] = useState('')
  const [cards, setCards] = useState<Record<string, TodoCard[]>>({
    today: [],
    week: [],
    later: [],
  })
  const [selectedCard, setSelectedCard] = useState<{ columnId: string; cardId: string } | null>(null)
  const [archivedCards, setArchivedCards] = useState<ArchivedCard[]>([])
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveSearch, setArchiveSearch] = useState('')
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [, setSplashOut] = useState(false)
  const [, setSplashDone] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [addEventSubject, setAddEventSubject] = useState('')
  const [addEventDate, setAddEventDate] = useState('')
  const [addEventStartTime, setAddEventStartTime] = useState('09:00')
  const [addEventEndTime, setAddEventEndTime] = useState('10:00')
  const [addEventBody, setAddEventBody] = useState('')
  const [addEventError, setAddEventError] = useState<string | null>(null)
  const [addEventSaving, setAddEventSaving] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const columnsScrollRef = useRef<HTMLDivElement | null>(null)
  const panStartXRef = useRef(0)
  const panStartScrollRef = useRef(0)
  const prevRectsRef = useRef<Record<string, DOMRect> | null>(null)
  const dropTargetRef = useRef<ColumnId | null>(null)
  const defaultColumns = deriveColumnColors('#1d4ed8')
  const [themeVars, setThemeVars] = useState<ThemeVars>(() => ({
    isDark: false,
    accent: '#1d4ed8',
    text: '#0f172a',
    muted: 'rgba(15,23,42,0.62)',
    surface: 'rgba(240,241,243,0.88)',
    surface2: 'rgba(232,234,237,0.9)',
    panelBg: '#ffffff',
    border: 'rgba(148,163,184,0.38)',
    shadow: '0 14px 34px rgba(15,23,42,0.18)',
    headerBg: 'rgba(238,240,243,0.88)',
    navShadow: '0 8px 18px rgba(15,23,42,0.12)',
    ...defaultColumns,
  }))

  const today = useMemo(() => new Date(), [])
  const monthDays = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])
  const monthLabel = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  const stripHtml = useCallback((html: string): string => {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim()
  }, [])

  const calendarCardsByColumn = useMemo(() => {
    const result: Record<string, TodoCard[]> = { today: [], week: [], later: [] }
    const expired: ArchivedCard[] = []
    if (!calendarEvents.length) return { columns: result, expired }

    const now = new Date()
    const nowMs = now.getTime()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const weekDay = todayStart.getDay()
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - ((weekDay + 6) % 7))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const pad2 = (n: number) => n.toString().padStart(2, '0')

    for (const ev of calendarEvents) {
      if (!ev.start?.dateTime) continue
      let dt = ev.start.dateTime
      if (ev.start.timeZone === 'UTC' && !dt.endsWith('Z') && !dt.includes('+')) dt += 'Z'
      const d = new Date(dt)
      if (isNaN(d.getTime())) continue

      let endMs = d.getTime()
      let timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
      if (ev.end?.dateTime) {
        let edt = ev.end.dateTime
        if (ev.end.timeZone === 'UTC' && !edt.endsWith('Z') && !edt.includes('+')) edt += 'Z'
        const e = new Date(edt)
        if (!isNaN(e.getTime())) {
          timeStr += ` – ${pad2(e.getHours())}:${pad2(e.getMinutes())}`
          endMs = e.getTime()
        }
      }

      const card: TodoCard = {
        id: `cal-${ev.id}`,
        title: ev.subject ?? 'Событие',
        description: ev.body?.content ? stripHtml(ev.body.content) : '',
        fromCalendar: true,
        calendarEventId: ev.id,
        calendarTime: timeStr,
        dueDate: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        dueTime: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
      }

      if (endMs < nowMs) {
        expired.push({
          ...card,
          completed: true,
          archivedAt: new Date(endMs).toISOString(),
          fromColumn: 'today',
        })
        continue
      }

      if (d >= todayStart && d < todayEnd) {
        result.today.push(card)
      } else if (d >= weekStart && d < weekEnd) {
        result.week.push(card)
      } else {
        result.later.push(card)
      }
    }

    for (const col of Object.values(result)) {
      col.sort((a, b) => (a.dueTime ?? '').localeCompare(b.dueTime ?? ''))
    }

    expired.sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))

    return { columns: result, expired }
  }, [calendarEvents, stripHtml])

  const handlePrevMonth = useCallback(() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)), [])
  const handleNextMonth = useCallback(() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)), [])

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handlePickBackground = () => {
    fileInputRef.current?.click()
    setMenuOpen(false)
  }

  const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setPrevBackground(backgroundImage)
      setBackgroundImage(url)
      setBgTransitioning(true)
      setTimeout(() => {
        setBgTransitioning(false)
        setPrevBackground((prev) => {
          if (prev && prev !== url) URL.revokeObjectURL(prev)
          return null
        })
      }, 1300)
    }
    img.src = url
  }

  useEffect(() => {
    if (!selectedCard) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedCard(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedCard])

  useEffect(() => {
    let cancelled = false
    if (!backgroundImage) return
    deriveThemeFromImage(backgroundImage)
      .then((vars) => { if (!cancelled) setThemeVars(vars) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [backgroundImage])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const calendar = params.get('calendar')
    if (calendar === 'connected') {
      setCalendarConnected(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (calendar === 'error') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getCalendarStatus()
      .then(({ connected }) => {
        if (!cancelled) {
          setCalendarConnected(connected)
          setCalendarCache([], connected)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setInitialLoading(false)
          setSplashOut(true)
          setTimeout(() => setSplashDone(true), 500)
        }
      })
    return () => { cancelled = true }
  }, [])

  const fetchCalendarEvents = useCallback(() => {
    if (!calendarConnected) return
    setCalendarLoading(true)
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const viewMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const viewMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999)
    const rangeStart = new Date(Math.min(todayStart.getTime(), viewMonthStart.getTime()))
    rangeStart.setMonth(rangeStart.getMonth() - 1)
    rangeStart.setHours(0, 0, 0, 0)
    const rangeEnd = new Date(Math.max(today.getTime(), viewMonthEnd.getTime()))
    rangeEnd.setMonth(rangeEnd.getMonth() + 1)
    rangeEnd.setHours(0, 0, 0, 0)
    getCalendarEvents(rangeStart.toISOString(), rangeEnd.toISOString())
      .then((events) => {
        setCalendarEvents(events)
        setCalendarCache(events, true)
      })
      .catch(() => {})
      .finally(() => setCalendarLoading(false))
  }, [calendarConnected, currentMonth])

  useEffect(() => { fetchCalendarEvents() }, [fetchCalendarEvents])

  const handleConnectCalendar = useCallback(() => {
    connectOutlookCalendar().catch((err) => {
      console.error('Calendar connect error:', err)
    })
  }, [])

  const handleOpenAddEvent = useCallback((date: Date) => {
    const y = date.getFullYear()
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const d = date.getDate().toString().padStart(2, '0')
    setAddEventDate(`${y}-${m}-${d}`)
    setAddEventSubject('')
    setAddEventStartTime('09:00')
    setAddEventEndTime('10:00')
    setAddEventBody('')
    setAddEventError(null)
    setAddEventOpen(true)
  }, [])

  const handleSubmitEvent = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const subject = addEventSubject.trim()
    if (!subject) { setAddEventError('Укажите название события'); return }
    if (!addEventDate) { setAddEventError('Выберите дату'); return }

    setAddEventSaving(true)
    setAddEventError(null)
    try {
      const startISO = `${addEventDate}T${addEventStartTime}:00`
      const endISO = `${addEventDate}T${addEventEndTime}:00`
      await createCalendarEvent({
        subject,
        start: new Date(startISO).toISOString(),
        end: new Date(endISO).toISOString(),
        body: addEventBody.trim() || undefined,
      })
      setAddEventOpen(false)
      fetchCalendarEvents()
    } catch (err) {
      setAddEventError(err instanceof Error ? err.message : 'Ошибка создания события')
    } finally {
      setAddEventSaving(false)
    }
  }, [addEventSubject, addEventDate, addEventStartTime, addEventEndTime, addEventBody, fetchCalendarEvents])

  const archivedCalIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const { expired } = calendarCardsByColumn
    if (expired.length === 0) return
    const newExpired = expired.filter(e => !archivedCalIdsRef.current.has(e.id))
    if (newExpired.length === 0) return
    newExpired.forEach(e => archivedCalIdsRef.current.add(e.id))
    setArchivedCards(prev => {
      const existingIds = new Set(prev.map(c => c.id))
      const toAdd = newExpired.filter(c => !existingIds.has(c.id))
      return toAdd.length > 0 ? [...toAdd, ...prev] : prev
    })
  }, [calendarCardsByColumn])

  const mergedCards = useMemo(() => {
    const result: Record<string, TodoCard[]> = {}
    const cols = calendarCardsByColumn.columns
    const calendarByColumn: Record<string, TodoCard[]> = {}
    for (const id of columnOrder) {
      calendarByColumn[id] = []
    }
    for (const dateCol of ['today', 'week', 'later'] as const) {
      const list = cols[dateCol] || []
      for (const card of list) {
        const eventId = card.calendarEventId
        const targetCol = eventId && calendarColumnOverrides[eventId] != null
          ? calendarColumnOverrides[eventId]
          : dateCol
        if (columnOrder.includes(targetCol) && calendarByColumn[targetCol]) {
          calendarByColumn[targetCol].push(card)
        }
      }
    }
    for (const id of columnOrder) {
      const manual = cards[id] || []
      const calendar = calendarByColumn[id] || []
      result[id] = [...calendar, ...manual]
    }
    return result
  }, [cards, calendarCardsByColumn, columnOrder, calendarColumnOverrides])

  const columnConfig = useMemo(
    () =>
      columnOrder.map((id) => ({
        id,
        title: columnTitles[id] ?? id,
        collapsedLabel: `${columnTitles[id] ?? id} ${(mergedCards[id] || []).length}`,
      })),
    [columnOrder, columnTitles, mergedCards]
  )

  const handleAddColumn = useCallback(() => {
    const title = addColumnTitle.trim()
    if (!title) return
    const newId = `col-${Date.now()}`
    setColumnOrder((prev) => [...prev, newId])
    setColumnTitles((prev) => ({ ...prev, [newId]: title }))
    setCollapsedColumns((prev) => ({ ...prev, [newId]: false }))
    setCards((prev) => ({ ...prev, [newId]: [] }))
    setAddColumnTitle('')
    setAddColumnOpen(false)
  }, [addColumnTitle])

  const handleColumnMouseDown = useCallback((e: React.MouseEvent, id: ColumnId) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const node = columnRefs.current[id]
    if (node) {
      const rect = node.getBoundingClientRect()
      columnDragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setColumnDragPreviewPosition({ x: rect.left, y: rect.top })
    }
    setDraggingColumn(id)
    setDropTarget(null)
  }, [])

  const handleColumnsAreaMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const el = e.target as HTMLElement
    if (el.closest('.todo-column__head') || el.closest('.todo-columns__add') || el.closest('.todo-card') || el.closest('button')) return
    const container = columnsScrollRef.current
    if (!container) return
    e.preventDefault()
    panStartXRef.current = e.clientX
    panStartScrollRef.current = container.scrollLeft
    setIsPanning(true)
  }, [])

  useEffect(() => {
    if (!isPanning) return
    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      const container = columnsScrollRef.current
      if (!container) return
      const dx = panStartXRef.current - e.clientX
      container.scrollLeft = panStartScrollRef.current + dx
    }
    const onUp = () => setIsPanning(false)
    document.addEventListener('mousemove', onMove, { passive: false })
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [isPanning])

  useEffect(() => {
    if (draggingColumn === null) return
    const onMove = (e: MouseEvent) => {
      setColumnDragPreviewPosition({
        x: e.clientX - columnDragOffsetRef.current.x,
        y: e.clientY - columnDragOffsetRef.current.y,
      })
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const columnEl = el?.closest?.('[data-todo-column-id]') as HTMLElement | null
      const id = columnEl?.getAttribute('data-todo-column-id') as ColumnId | null
      if (id && id !== draggingColumn) {
        dropTargetRef.current = id
        setDropTarget(id)
      } else {
        dropTargetRef.current = null
        setDropTarget(null)
      }
    }
    const onUp = () => {
      const target = dropTargetRef.current
      if (draggingColumn && target && draggingColumn !== target) {
        const rects: Record<string, DOMRect> = {}
        columnOrder.forEach((id) => {
          const node = columnRefs.current[id]
          if (node) rects[id] = node.getBoundingClientRect()
        })
        prevRectsRef.current = rects
        setColumnOrder((order) => {
          const a = order.indexOf(draggingColumn)
          const b = order.indexOf(target)
          if (a < 0 || b < 0) return order
          const next = [...order]
          next[a] = order[b]
          next[b] = order[a]
          return next
        })
      }
      dropTargetRef.current = null
      setDraggingColumn(null)
      setDropTarget(null)
      setColumnDragPreviewPosition(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [draggingColumn, columnOrder])

  useEffect(() => {
    if (!prevRectsRef.current) return
    const oldRects = prevRectsRef.current
    prevRectsRef.current = null
    columnOrder.forEach((id) => {
      const el = columnRefs.current[id]
      if (!el || !oldRects[id]) return
      const newRect = el.getBoundingClientRect()
      const dx = oldRects[id].left - newRect.left
      el.style.transition = 'none'
      el.style.transform = `translateX(${dx}px)`
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          el.style.transform = 'translateX(0)'
          const onEnd = () => {
            el.style.transition = ''
            el.style.transform = ''
            el.removeEventListener('transitionend', onEnd)
          }
          el.addEventListener('transitionend', onEnd)
        })
      })
    })
  }, [columnOrder])

  const handleAddCard = useCallback(() => {
    const title = addCardTitle.trim()
    if (!title || !addCardColumn) return
    const newCard: TodoCard = {
      id: `${addCardColumn}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      completed: false,
    }
    setCards((prev) => ({ ...prev, [addCardColumn]: [...(prev[addCardColumn] || []), newCard] }))
    setAddCardTitle('')
    setAddCardColumn(null)
  }, [addCardTitle, addCardColumn])

  const handleToggleCollapse = useCallback((cid: string) => {
    setCollapsedColumns((s) => ({ ...s, [cid]: !s[cid] }))
  }, [])

  const handleExpand = useCallback((cid: string) => {
    setCollapsedColumns((s) => ({ ...s, [cid]: false }))
  }, [])

  const handleAddCardClick = useCallback((cid: ColumnId) => {
    setAddCardColumn(cid)
    setAddCardTitle('')
  }, [])

  const handleCardClick = useCallback((cid: string, cardId: string) => {
    setSelectedCard({ columnId: cid, cardId })
  }, [])

  const handleCardToggleComplete = useCallback((cid: string, cardId: string) => {
    setCards((prev) => ({
      ...prev,
      [cid]: (prev[cid] || []).map((c) => (c.id === cardId ? { ...c, completed: !c.completed } : c)),
    }))
  }, [])

  const handleColumnKeyDown = useCallback((id: ColumnId) => {
    setDraggingColumn(id)
  }, [])

  const handleCardDragStart = useCallback((e: React.MouseEvent, columnId: string, cardId: string, cardRect: DOMRect) => {
    e.preventDefault()
    cardDragOffsetRef.current = {
      x: e.clientX - cardRect.left,
      y: e.clientY - cardRect.top,
    }
    setDragPreviewPosition({ x: cardRect.left, y: cardRect.top })
    setDraggingCard({ columnId, cardId })
  }, [])

  const handleSortCards = useCallback((colId: string, mode: 'az' | 'za' | 'newest' | 'oldest' | 'done') => {
    setCards((prev) => {
      const list = [...(prev[colId] || [])]
      switch (mode) {
        case 'az': list.sort((a, b) => a.title.localeCompare(b.title, 'ru')); break
        case 'za': list.sort((a, b) => b.title.localeCompare(a.title, 'ru')); break
        case 'newest': list.reverse(); break
        case 'oldest': break
        case 'done': list.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0)); break
      }
      return { ...prev, [colId]: list }
    })
  }, [])

  const handleRenameColumn = useCallback((colId: string, title: string) => {
    setColumnTitles((prev) => ({ ...prev, [colId]: title }))
  }, [])

  const handleClearColumn = useCallback((colId: string) => {
    setCards((prev) => ({ ...prev, [colId]: [] }))
  }, [])

  const handleDeleteColumn = useCallback((colId: string) => {
    setColumnOrder((prev) => prev.filter((c) => c !== colId))
    setColumnTitles((prev) => { const n = { ...prev }; delete n[colId]; return n })
    setCards((prev) => { const n = { ...prev }; delete n[colId]; return n })
    setCollapsedColumns((prev) => { const n = { ...prev }; delete n[colId]; return n })
  }, [])

  const handleMoveCard = useCallback((fromColumnId: string, cardId: string, toColumnId: string) => {
    if (fromColumnId === toColumnId) return
    const card = mergedCards[fromColumnId]?.find((c) => c.id === cardId)
    if (!card) return
    if (card.fromCalendar && card.calendarEventId) {
      setCalendarColumnOverrides((prev) => ({ ...prev, [card.calendarEventId!]: toColumnId }))
    } else {
      setCards((prev) => {
        const fromList = (prev[fromColumnId] || []).filter((c) => c.id !== cardId)
        const toList = [...(prev[toColumnId] || []), card]
        return { ...prev, [fromColumnId]: fromList, [toColumnId]: toList }
      })
    }
  }, [mergedCards])

  useEffect(() => {
    if (draggingCard === null) return
    const onMove = (e: MouseEvent) => {
      setDragPreviewPosition({
        x: e.clientX - cardDragOffsetRef.current.x,
        y: e.clientY - cardDragOffsetRef.current.y,
      })
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const columnEl = el?.closest?.('[data-todo-column-id]') as HTMLElement | null
      const id = columnEl?.getAttribute('data-todo-column-id') as ColumnId | null
      if (id && columnOrder.includes(id)) {
        dropTargetCardColumnRef.current = id
        setDropTargetCardColumn(id)
      } else {
        dropTargetCardColumnRef.current = null
        setDropTargetCardColumn(null)
      }
    }
    const onUp = () => {
      const target = dropTargetCardColumnRef.current
      if (draggingCard && target && draggingCard.columnId !== target) {
        handleMoveCard(draggingCard.columnId, draggingCard.cardId, target)
      }
      dropTargetCardColumnRef.current = null
      setDraggingCard(null)
      setDropTargetCardColumn(null)
      setDragPreviewPosition(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [draggingCard, columnOrder, handleMoveCard])

  const handleArchiveCard = useCallback((columnId: string, cardId: string) => {
    setCards((prev) => {
      const col = prev[columnId] || []
      const card = col.find((c) => c.id === cardId)
      if (card) {
        const archived: ArchivedCard = {
          ...card,
          archivedAt: new Date().toISOString(),
          fromColumn: columnId,
        }
        setArchivedCards((a) => [archived, ...a])
      }
      return { ...prev, [columnId]: col.filter((c) => c.id !== cardId) }
    })
    setSelectedCard(null)
  }, [])

  const handleRestoreCard = useCallback((archivedCard: ArchivedCard) => {
    const { archivedAt: _, fromColumn, ...card } = archivedCard
    const targetCol = columnOrder.includes(fromColumn) ? fromColumn : columnOrder[0]
    if (!targetCol) return
    setCards((prev) => ({ ...prev, [targetCol]: [...(prev[targetCol] || []), card] }))
    setArchivedCards((prev) => prev.filter((c) => c.id !== archivedCard.id))
  }, [columnOrder])

  const handleDeleteArchivedCard = useCallback((cardId: string) => {
    setArchivedCards((prev) => prev.filter((c) => c.id !== cardId))
  }, [])

  const handleClearArchive = useCallback(() => {
    setArchivedCards([])
  }, [])

  const handleColumnRef = useCallback((id: string) => (node: HTMLDivElement | null) => {
    columnRefs.current[id] = node
  }, [])

  const selectedCardData = selectedCard ? mergedCards[selectedCard.columnId]?.find((c) => c.id === selectedCard.cardId) : null
  const draggingCardData = draggingCard ? mergedCards[draggingCard.columnId]?.find((c) => c.id === draggingCard.cardId) : null
  const draggingColumnConfig = draggingColumn ? columnConfig.find((c) => c.id === draggingColumn) : null
  const draggingColumnCardCount = draggingColumn ? (mergedCards[draggingColumn]?.length ?? 0) : 0

  return (
    <div
      className={`todo-page${initialLoading ? ' todo-page--skeleton' : ''}`}
      style={
        {
          ['--todo-accent' as any]: themeVars.accent,
          ['--todo-text' as any]: themeVars.text,
          ['--todo-muted' as any]: themeVars.muted,
          ['--todo-surface' as any]: themeVars.surface,
          ['--todo-surface2' as any]: themeVars.surface2,
          ['--todo-panel-bg' as any]: themeVars.panelBg,
          ['--todo-border' as any]: themeVars.border,
          ['--todo-shadow' as any]: themeVars.shadow,
          ['--todo-header-bg' as any]: themeVars.headerBg,
          ['--todo-nav-shadow' as any]: themeVars.navShadow,
          ['--todo-column-today-bg' as any]: themeVars.columnTodayBg,
          ['--todo-column-today-text' as any]: themeVars.columnTodayText,
          ['--todo-column-week-bg' as any]: themeVars.columnWeekBg,
          ['--todo-column-week-text' as any]: themeVars.columnWeekText,
          ['--todo-column-later-bg' as any]: themeVars.columnLaterBg,
          ['--todo-column-later-text' as any]: themeVars.columnLaterText,
        } as React.CSSProperties
      }
    >
      <header className={`todo-page__header${initialLoading ? ' todo-page__header--skeleton' : ''}`}>
        <div className="todo-page__nav">
          {initialLoading ? (
            <>
              <div className="todo-page__header-skel todo-page__header-skel--back" />
              <div className="todo-page__nav-center">
                <div className="todo-page__header-skel todo-page__header-skel--search" />
              </div>
              <div className="todo-page__nav-right">
                <div className="todo-page__header-skel todo-page__header-skel--btn" />
                <div className="todo-page__header-skel todo-page__header-skel--btn todo-page__header-skel--icon" />
              </div>
            </>
          ) : (
            <>
              <AnimatedLink to={routes.home} className="todo-page__back-link">
                <IconBack />
                <span>Назад</span>
              </AnimatedLink>
              <div className="todo-page__nav-center">
                <div className="todo-page__search-wrap">
                  <svg className="todo-page__search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input className="todo-page__search" placeholder="Поиск задач..." type="search" />
                </div>
              </div>
              <div className="todo-page__nav-right">
                <button type="button" className={`todo-page__header-btn${archiveOpen ? ' todo-page__header-btn--active' : ''}`} onClick={() => setArchiveOpen((v) => !v)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>
                  <span>Архив</span>
                  {archivedCards.length > 0 && <span className="todo-page__header-badge">{archivedCards.length}</span>}
                </button>
                <div className="todo-page__menu-wrap" ref={menuRef}>
                  <button
                    type="button"
                    className="todo-page__header-btn todo-page__header-btn--icon"
                    aria-label="Дополнительно"
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                  </button>
                  {menuOpen && (
                    <div className="todo-page__menu-dropdown">
                      <button type="button" className="todo-page__menu-item" onClick={handlePickBackground}>
                        <span className="todo-page__menu-icon"><IconImage /></span>
                        <span className="todo-page__menu-text">Фон рабочей области</span>
                      </button>
                      <button type="button" className="todo-page__menu-item">
                        <span className="todo-page__menu-icon"><IconSettings /></span>
                        <span className="todo-page__menu-text">Настройки</span>
                      </button>
                      <button type="button" className="todo-page__menu-item">
                        <span className="todo-page__menu-icon"><IconDownload /></span>
                        <span className="todo-page__menu-text">Экспорт данных</span>
                      </button>
                      <button type="button" className="todo-page__menu-item">
                        <span className="todo-page__menu-icon"><IconUpload /></span>
                        <span className="todo-page__menu-text">Импорт данных</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </header>
      {draggingCard && dragPreviewPosition && draggingCardData && createPortal(
        <div
          className="todo-card-drag-preview"
          style={{ left: dragPreviewPosition.x, top: dragPreviewPosition.y }}
        >
          <div className="todo-card-drag-preview__inner">
            {draggingCardData.fromCalendar && (
              <span className="todo-card-drag-preview__badge">Outlook</span>
            )}
            <span className="todo-card-drag-preview__title">{draggingCardData.title}</span>
          </div>
        </div>,
        document.body
      )}
      {draggingColumn && columnDragPreviewPosition && draggingColumnConfig && createPortal(
        <div
          className="todo-column-drag-preview"
          style={{ left: columnDragPreviewPosition.x, top: columnDragPreviewPosition.y }}
        >
          <div className={`todo-column-drag-preview__inner todo-column-drag-preview__inner--${draggingColumn}`}>
            <div className="todo-column-drag-preview__head">
              <span className="todo-column-drag-preview__dot" />
              <span className="todo-column-drag-preview__title">{draggingColumnConfig.title}</span>
              <span className="todo-column-drag-preview__count">{draggingColumnCardCount}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
      <div className="todo-page__body">
        <TodoPlanner
          plannerCollapsed={plannerCollapsed}
          setPlannerCollapsed={setPlannerCollapsed}
          currentMonth={currentMonth}
          monthDays={monthDays}
          monthLabel={monthLabel}
          today={today}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          calendarConnected={calendarConnected}
          calendarEvents={calendarEvents}
          onConnectCalendar={handleConnectCalendar}
          onAddEvent={handleOpenAddEvent}
          onEditEvent={() => {}}
          loading={initialLoading || calendarLoading}
        />
        <main
          className={`todo-page__main ${backgroundImage ? 'todo-page__main--with-bg' : ''}`}
        >
          {prevBackground && bgTransitioning && (
            <div className="todo-page__bg-layer todo-page__bg-layer--old" style={{ backgroundImage: `url(${prevBackground})` }} />
          )}
          {backgroundImage && (
            <div className={`todo-page__bg-layer todo-page__bg-layer--new${bgTransitioning ? ' todo-page__bg-layer--entering' : ''}`} style={{ backgroundImage: `url(${backgroundImage})` }} />
          )}
          {backgroundImage && <div className="todo-page__bg-overlay" />}
          <div
            ref={columnsScrollRef}
            className={`todo-columns ${isPanning ? 'todo-columns--panning' : ''}`}
            onMouseDown={handleColumnsAreaMouseDown}
          >
            {initialLoading ? (
              <>
                {['today', 'week', 'later'].map((id) => (
                  <div key={id} className="todo-column todo-column--skeleton">
                    <div className="todo-column__head">
                      <div className="todo-column__head-left">
                        <span className="todo-column__dot" />
                        <div className="todo-skel todo-skel--title" />
                        <div className="todo-skel todo-skel--badge" />
                      </div>
                    </div>
                    <div className="todo-column__cards">
                      {Array.from({ length: id === 'today' ? 3 : 2 }).map((_, i) => (
                        <div key={i} className="todo-card todo-card--skeleton">
                          <div className="todo-skel todo-skel--label" />
                          <div className="todo-skel todo-skel--line" />
                          <div className="todo-skel todo-skel--line-short" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {columnOrder.map((id) => {
                  const config = columnConfig.find((c) => c.id === id)!
                  const isCollapsed = collapsedColumns[id]
                  return (
                    <TodoColumn
                      key={id}
                      config={config}
                      isCollapsed={!!isCollapsed}
                      cards={mergedCards[id] || []}
                      isDragging={draggingColumn === id}
                      isDropTarget={dropTarget === id}
                      onColumnMouseDown={handleColumnMouseDown}
                      onColumnKeyDown={handleColumnKeyDown}
                      onToggleCollapse={handleToggleCollapse}
                      onExpand={handleExpand}
                      onAddCardClick={handleAddCardClick}
                      onCardClick={handleCardClick}
                      onCardToggleComplete={handleCardToggleComplete}
                      onSortCards={handleSortCards}
                      onRenameColumn={handleRenameColumn}
                      onClearColumn={handleClearColumn}
                      onDeleteColumn={handleDeleteColumn}
                      onCardDragStart={handleCardDragStart}
                      isCardDropTarget={dropTargetCardColumn === id}
                      draggingCard={draggingCard}
                      columnRef={handleColumnRef(id)}
                    />
                  )
                })}
                <button
                  type="button"
                  className="todo-columns__add"
                  onClick={() => { setAddColumnOpen(true); setAddColumnTitle('') }}
                  aria-label="Добавить колонку"
                >
                  <IconPlus />
                  <span>Добавьте еще одну колонку</span>
                </button>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleBackgroundChange}
          />
          {addColumnOpen && (
            <TodoAddColumnModal
              title={addColumnTitle}
              onTitleChange={setAddColumnTitle}
              onClose={() => { setAddColumnOpen(false); setAddColumnTitle('') }}
              onSubmit={handleAddColumn}
            />
          )}
          {addCardColumn && (
            <TodoAddCardModal
              columnTitle={columnConfig.find((c) => c.id === addCardColumn)?.title ?? ''}
              title={addCardTitle}
              onTitleChange={setAddCardTitle}
              onClose={() => { setAddCardColumn(null); setAddCardTitle('') }}
              onSubmit={handleAddCard}
            />
          )}
          {selectedCard && selectedCardData && (
            <TodoCardModal
              card={selectedCardData}
              columnTitle={columnTitles[selectedCard.columnId] ?? ''}
              onClose={() => setSelectedCard(null)}
              onCardUpdate={(patch) =>
                setCards((prev) => ({
                  ...prev,
                  [selectedCard.columnId]: (prev[selectedCard.columnId] || []).map((c) =>
                    c.id === selectedCard.cardId ? { ...c, ...patch } : c
                  ),
                }))
              }
              onArchive={() => handleArchiveCard(selectedCard.columnId, selectedCard.cardId)}
            />
          )}

          <div className={`todo-archive${archiveOpen ? ' todo-archive--open' : ''}`}>
            <div className="todo-archive__header">
              <h3 className="todo-archive__title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>
                Архив
              </h3>
              <button type="button" className="todo-archive__close" onClick={() => setArchiveOpen(false)} aria-label="Закрыть архив">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="todo-archive__search-wrap">
              <svg className="todo-archive__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                className="todo-archive__search"
                type="search"
                placeholder="Поиск в архиве..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
              />
            </div>

            <div className="todo-archive__list">
              {archivedCards
                .filter((c) => !archiveSearch || c.title.toLowerCase().includes(archiveSearch.toLowerCase()))
                .map((ac) => (
                  <div key={ac.id} className="todo-archive__card">
                    <div className="todo-archive__card-header">
                      {(ac.labels?.length ?? 0) > 0 && (
                        <div className="todo-archive__card-labels">
                          {ac.labels!.map((l) => (
                            <span key={l.id} className="todo-archive__label" style={{ background: l.color }}>{l.text}</span>
                          ))}
                        </div>
                      )}
                      <span className="todo-archive__card-title">{ac.title}</span>
                      {ac.description && (
                        <p className="todo-archive__card-desc">{ac.description.slice(0, 80)}{ac.description.length > 80 ? '...' : ''}</p>
                      )}
                    </div>
                    <div className="todo-archive__card-meta">
                      <span className="todo-archive__card-from">из «{columnTitles[ac.fromColumn] ?? ac.fromColumn}»</span>
                      <span className="todo-archive__card-date">
                        {new Date(ac.archivedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="todo-archive__card-actions">
                      <button type="button" className="todo-archive__btn todo-archive__btn--restore" onClick={() => handleRestoreCard(ac)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                        Восстановить
                      </button>
                      <button type="button" className="todo-archive__btn todo-archive__btn--delete" onClick={() => handleDeleteArchivedCard(ac.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              {archivedCards.length === 0 && (
                <div className="todo-archive__empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>
                  <p>Архив пуст</p>
                  <span>Архивированные карточки будут отображаться здесь</span>
                </div>
              )}
              {archivedCards.length > 0 && archiveSearch && archivedCards.filter((c) => c.title.toLowerCase().includes(archiveSearch.toLowerCase())).length === 0 && (
                <div className="todo-archive__empty">
                  <p>Ничего не найдено</p>
                </div>
              )}
            </div>

            {archivedCards.length > 0 && (
              <div className="todo-archive__footer">
                <button type="button" className="todo-archive__clear" onClick={handleClearArchive}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  Очистить архив ({archivedCards.length})
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {addEventOpen && createPortal(
        <div className="cal-event-backdrop" onClick={() => setAddEventOpen(false)}>
          <form className="cal-event-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmitEvent}>
            <div className="cal-event-modal__head">
              <h3 className="cal-event-modal__title">Новое событие</h3>
              <button type="button" className="cal-event-modal__close" onClick={() => setAddEventOpen(false)} aria-label="Закрыть">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="cal-event-modal__field">
              <label className="cal-event-modal__label">Название</label>
              <input className="cal-event-modal__input" value={addEventSubject} onChange={(e) => setAddEventSubject(e.target.value)} placeholder="Встреча, звонок..." autoFocus />
            </div>
            <div className="cal-event-modal__field">
              <label className="cal-event-modal__label">Дата</label>
              <input className="cal-event-modal__input" type="date" value={addEventDate} onChange={(e) => setAddEventDate(e.target.value)} />
            </div>
            <div className="cal-event-modal__row">
              <div className="cal-event-modal__field">
                <label className="cal-event-modal__label">Начало</label>
                <input className="cal-event-modal__input" type="time" value={addEventStartTime} onChange={(e) => setAddEventStartTime(e.target.value)} />
              </div>
              <div className="cal-event-modal__field">
                <label className="cal-event-modal__label">Конец</label>
                <input className="cal-event-modal__input" type="time" value={addEventEndTime} onChange={(e) => setAddEventEndTime(e.target.value)} />
              </div>
            </div>
            <div className="cal-event-modal__field">
              <label className="cal-event-modal__label">Описание</label>
              <textarea className="cal-event-modal__input cal-event-modal__textarea" value={addEventBody} onChange={(e) => setAddEventBody(e.target.value)} placeholder="Описание события..." rows={3} />
            </div>
            {addEventError && <p className="cal-event-modal__error">{addEventError}</p>}
            <div className="cal-event-modal__actions">
              <button type="button" className="cal-event-modal__btn cal-event-modal__btn--cancel" onClick={() => setAddEventOpen(false)}>Отмена</button>
              <button type="submit" className="cal-event-modal__btn cal-event-modal__btn--save" disabled={addEventSaving}>
                {addEventSaving ? 'Сохранение...' : 'Создать событие'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  )
}
