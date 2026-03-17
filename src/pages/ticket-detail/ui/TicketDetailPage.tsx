import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatedLink } from '@shared/ui'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { useMediaQuery, useCurrentUser } from '@shared/hooks'
import { getSidebarCollapsed, setSidebarCollapsed } from '@shared/lib/sidebarCollapsed'
import { apiFetch } from '@shared/api'
import { routes } from '@shared/config'
import {
  getTicket,
  getComments,
  addComment,
  getStatuses,
  updateTicket,
  type Ticket,
  type Comment,
  type StatusItem,
} from '@entities/ticket'
import { getUser, type User } from '@entities/user'
import { formatDateInfo } from '@shared/lib/formatDate'
import './TicketDetailPage.css'

function getAttachmentRequestPath(attachmentPath: string): string {
  if (attachmentPath.startsWith('http')) {
    try {
      return new URL(attachmentPath).pathname
    } catch {
      return attachmentPath
    }
  }
  return attachmentPath.startsWith('/') ? attachmentPath : `/${attachmentPath}`
}

const IconBack = memo(function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
})

const IconUser = memo(function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
  )
})

const IconCalendar = memo(function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  )
})

const IconPaperclip = memo(function IconPaperclip() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
  )
})

const IconComment = memo(function IconComment() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
})

const IconEnvelope = memo(function IconEnvelope() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  )
})

const IconSend = memo(function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
})

const IconTag = memo(function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  )
})

const IconFlag = memo(function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  )
})

const IconFolder = memo(function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
})

const IconDownload = memo(function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
})

function canViewCreator(role: string | undefined): boolean {
  if (!role) return false
  const r = role.toLowerCase()
  return r === 'администратор' || r.includes('it')
}

function getStatusColor(status: string): string {
  const s = status?.toLowerCase() || ''
  if (s.includes('закрыт')) return 'closed'
  if (s.includes('в работе')) return 'progress'
  if (s.includes('согласован')) return 'approval'
  if (s.includes('невозможно')) return 'impossible'
  return 'open'
}

function getPriorityColor(priority: string): string {
  const p = priority?.toLowerCase() || ''
  if (p.includes('высокий') || p.includes('критический')) return 'high'
  if (p.includes('средний')) return 'medium'
  if (p.includes('низкий')) return 'low'
  return 'medium'
}

export function TicketDetailPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const { user: currentUser } = useCurrentUser()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => getSidebarCollapsed())
  const canSeeCreator = canViewCreator(currentUser?.role)
  const canChangeStatus = canSeeCreator

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [creator, setCreator] = useState<User | null>(null)
  const [creatorLoading, setCreatorLoading] = useState(false)
  const [statuses, setStatuses] = useState<StatusItem[]>([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [attachmentLoading, setAttachmentLoading] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    if (!uuid) return
    setLoading(true)
    setError(null)
    try {
      const [ticketData, commentsData] = await Promise.all([getTicket(uuid), getComments(uuid)])
      setTicket(ticketData)
      setComments(commentsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить заявку')
    } finally {
      setLoading(false)
    }
  }, [uuid])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!canChangeStatus) return
    getStatuses().then(setStatuses).catch(() => setStatuses([]))
  }, [canChangeStatus])

  useEffect(() => {
    if (!statusDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setStatusDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [statusDropdownOpen])

  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, sidebarOpen])

  useEffect(() => {
    if (!isMobile || !sidebarOpen) return
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [isMobile, sidebarOpen])

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!uuid || !ticket || statusUpdating) return
    setStatusUpdating(true)
    setStatusDropdownOpen(false)
    try {
      const updated = await updateTicket(uuid, { status: newStatus })
      setTicket(updated)
    } catch {
    } finally {
      setStatusUpdating(false)
    }
  }, [uuid, ticket, statusUpdating])

  useEffect(() => {
    if (!canSeeCreator || !ticket?.created_by_user_id) {
      setCreator(null)
      setCreatorLoading(false)
      return
    }
    let cancelled = false
    setCreatorLoading(true)
    setCreator(null)
    getUser(ticket.created_by_user_id)
      .then((u) => { if (!cancelled) setCreator(u) })
      .catch(() => { if (!cancelled) setCreator(null) })
      .finally(() => { if (!cancelled) setCreatorLoading(false) })
    return () => { cancelled = true }
  }, [canSeeCreator, ticket?.created_by_user_id])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uuid || !commentText.trim() || commentSubmitting) return
    setCommentSubmitting(true)
    setCommentError(null)
    try {
      const newComment = await addComment(uuid, commentText.trim())
      setComments((prev) => [...prev, newComment])
      setCommentText('')
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Не удалось отправить комментарий')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const openAttachment = useCallback(async (attachmentPath: string) => {
    const path = getAttachmentRequestPath(attachmentPath)
    setAttachmentLoading(true)
    try {
      const res = await apiFetch(path)
      if (!res.ok) throw new Error('Не удалось загрузить файл')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось открыть файл')
    } finally {
      setAttachmentLoading(false)
    }
  }, [])

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((v) => {
      const next = !v
      setSidebarCollapsed(next)
      return next
    })
  }, [])

  if (!uuid) {
    return (
      <div className="td">
        <p className="td__error-banner">Не указан идентификатор заявки.</p>
        <AnimatedLink to={routes.home} className="td__back-link">Назад</AnimatedLink>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="td">
        <div className="td__shell">
          <Sidebar isCollapsed={false} isMobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} isMobile={isMobile} />
          <main className="td__main">
            <div className="td__skel-header">
              <div className="td__skel td__skel--back" />
              <div className="td__skel td__skel--title" />
            </div>
            <div className="td__layout">
              <div className="td__primary">
                <div className="td__panel">
                  <div className="td__skel td__skel--label" />
                  <div className="td__skel td__skel--text-full" />
                  <div className="td__skel td__skel--text-full" />
                  <div className="td__skel td__skel--text-mid" />
                </div>
                <div className="td__panel">
                  <div className="td__skel td__skel--label" />
                  <div className="td__skel td__skel--text-full" />
                  <div className="td__skel td__skel--text-mid" />
                </div>
              </div>
              <div className="td__secondary">
                <div className="td__panel">
                  <div className="td__skel td__skel--label" />
                  <div className="td__skel td__skel--badge" />
                  <div className="td__skel td__skel--text-mid" />
                  <div className="td__skel td__skel--text-mid" />
                  <div className="td__skel td__skel--text-mid" />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="td">
        <div className="td__shell">
          <Sidebar isCollapsed={false} isMobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} isMobile={isMobile} />
          <main className="td__main">
            <AnimatedLink to={routes.home} className="td__back-link"><IconBack /> Назад</AnimatedLink>
            <div className="td__error-banner">{error || 'Заявка не найдена'}</div>
          </main>
        </div>
      </div>
    )
  }

  const statusColor = getStatusColor(ticket.status)
  const priorityColor = getPriorityColor(ticket.priority)

  return (
    <div className="td">
      <div className="td__shell">
        <div className="td__sidebar-wrap">
          <Sidebar
            isCollapsed={isCollapsed}
            onToggleCollapse={handleToggleCollapse}
            isMobileOpen={sidebarOpen}
            onCloseMobile={() => setSidebarOpen(false)}
            isMobile={isMobile}
          />
        </div>
        {isMobile && (
          <button type="button" className="td__menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Открыть меню">
            <IconMenu />
          </button>
        )}
        <main className="td__main">
          <div className="td__topbar">
            <AnimatedLink to={routes.home} className="td__back-link">
              <IconBack />
              <span>Назад</span>
            </AnimatedLink>
            <div className="td__topbar-meta">
              <span className={`td__status-pill td__status-pill--${statusColor}`}>
                {statuses.find((s) => s.value === ticket.status)?.label ?? ticket.status}
              </span>
            </div>
          </div>

          <header className="td__header">
            <h1 className="td__title">{ticket.theme}</h1>
            <div className="td__header-chips">
              <span className={`td__chip td__chip--priority-${priorityColor}`}>
                <IconFlag />
                {ticket.priority}
              </span>
              <span className="td__chip td__chip--category">
                <IconFolder />
                {ticket.category}
              </span>
              <span className="td__chip td__chip--date">
                <IconCalendar />
                {formatDateInfo(ticket.created_at)}
              </span>
            </div>
          </header>

          <div className="td__layout">
            <div className="td__primary">
              <section className="td__panel td__panel--desc">
                <div className="td__panel-head">
                  <h2 className="td__panel-title">Описание</h2>
                </div>
                <div className="td__desc-body">
                  {ticket.description ? (
                    <p className="td__desc-text">{ticket.description}</p>
                  ) : (
                    <p className="td__desc-empty">Описание не указано</p>
                  )}
                </div>
              </section>

              {ticket.attachment_path && (
                <section className="td__panel td__panel--attachment">
                  <div className="td__attachment-row">
                    <div className="td__attachment-info">
                      <span className="td__attachment-icon"><IconPaperclip /></span>
                      <span className="td__attachment-name">Вложение</span>
                    </div>
                    <button
                      type="button"
                      className="td__attachment-btn"
                      onClick={() => openAttachment(ticket.attachment_path!)}
                      disabled={attachmentLoading}
                    >
                      <IconDownload />
                      <span>{attachmentLoading ? 'Загрузка…' : 'Скачать'}</span>
                    </button>
                  </div>
                </section>
              )}

              <section className="td__panel td__panel--comments">
                <div className="td__panel-head">
                  <h2 className="td__panel-title">
                    <span className="td__panel-title-icon"><IconComment /></span>
                    Комментарии
                    <span className="td__comment-count">{comments.length}</span>
                  </h2>
                </div>

                {comments.length === 0 ? (
                  <div className="td__comments-empty">
                    <span className="td__comments-empty-icon" aria-hidden>
                      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M38 30a3 3 0 0 1-3 3H13l-6 6V13a3 3 0 0 1 3-3h25a3 3 0 0 1 3 3z"/>
                        <line x1="17" y1="18" x2="31" y2="18" opacity=".4"/>
                        <line x1="17" y1="23" x2="27" y2="23" opacity=".4"/>
                      </svg>
                    </span>
                    <p className="td__comments-empty-text">Комментариев пока нет</p>
                  </div>
                ) : (
                  <ul className="td__comments-list">
                    {comments.map((c) => (
                      <li key={c.id} className="td__comment">
                        <div className="td__comment-avatar">
                          <IconUser />
                        </div>
                        <div className="td__comment-body">
                          <div className="td__comment-head">
                            <span className="td__comment-author">Пользователь #{c.user_id}</span>
                            <span className="td__comment-time">{formatDateInfo(c.created_at)}</span>
                          </div>
                          <p className="td__comment-text">{c.content}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <form className="td__comment-form" onSubmit={handleSubmitComment}>
                  <div className="td__comment-input-wrap">
                    <textarea
                      className="td__comment-input"
                      placeholder="Написать комментарий…"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={3}
                      disabled={commentSubmitting}
                    />
                  </div>
                  {commentError && <p className="td__comment-error">{commentError}</p>}
                  <button
                    type="submit"
                    className="td__comment-submit"
                    disabled={commentSubmitting || !commentText.trim()}
                  >
                    <IconSend />
                    <span>{commentSubmitting ? 'Отправка…' : 'Отправить'}</span>
                  </button>
                </form>
              </section>
            </div>

            <aside className="td__secondary">
              <section className="td__info-panel">
                <h2 className="td__info-heading">Информация</h2>

                <div className="td__info-block" ref={canChangeStatus ? statusDropdownRef : undefined}>
                  <span className="td__info-label">Статус</span>
                  {canChangeStatus && statuses.length > 0 ? (
                    <div className="td__status-select">
                      <button
                        type="button"
                        className={`td__status-trigger ${statusDropdownOpen ? 'td__status-trigger--open' : ''}`}
                        onClick={() => setStatusDropdownOpen((v) => !v)}
                        disabled={statusUpdating}
                        aria-haspopup="listbox"
                        aria-expanded={statusDropdownOpen}
                      >
                        <span className={`td__status-dot td__status-dot--${statusColor}`} />
                        <span>{statuses.find((s) => s.value === ticket.status)?.label ?? ticket.status}</span>
                        <span className="td__status-arrow">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </span>
                      </button>
                      <div className={`td__status-dropdown ${statusDropdownOpen ? 'td__status-dropdown--open' : ''}`} role="listbox">
                        {statuses.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            role="option"
                            aria-selected={ticket.status === s.value}
                            className={`td__status-option ${ticket.status === s.value ? 'td__status-option--active' : ''}`}
                            onClick={() => handleStatusChange(s.value)}
                          >
                            <span className={`td__status-dot td__status-dot--${getStatusColor(s.value)}`} />
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className={`td__info-badge td__info-badge--${statusColor}`}>{ticket.status}</span>
                  )}
                </div>

                <div className="td__info-block">
                  <span className="td__info-label"><IconFlag /> Приоритет</span>
                  <span className={`td__info-badge td__info-badge--priority-${priorityColor}`}>{ticket.priority}</span>
                </div>

                <div className="td__info-block">
                  <span className="td__info-label"><IconTag /> Категория</span>
                  <span className="td__info-value">{ticket.category}</span>
                </div>

                {canSeeCreator && (
                  <div className="td__info-block td__info-block--creator">
                    <span className="td__info-label"><IconUser /> Автор</span>
                    {creatorLoading ? (
                      <span className="td__info-value td__info-value--loading">Загрузка…</span>
                    ) : creator ? (
                      <div className="td__creator">
                        <div className="td__creator-avatar"><IconUser /></div>
                        <div className="td__creator-details">
                          <span className="td__creator-name">{creator.display_name || 'Без имени'}</span>
                          {creator.email && (
                            <a href={`mailto:${creator.email}`} className="td__creator-email">
                              <IconEnvelope /> {creator.email}
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="td__creator">
                        <span className="td__info-value">Пользователь #{ticket.created_by_user_id}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="td__info-block">
                  <span className="td__info-label"><IconCalendar /> Создана</span>
                  <span className="td__info-value">{formatDateInfo(ticket.created_at)}</span>
                </div>

                {ticket.attachment_path && (
                  <div className="td__info-block">
                    <span className="td__info-label"><IconPaperclip /> Вложение</span>
                    <button
                      type="button"
                      className="td__info-file-btn"
                      onClick={() => openAttachment(ticket.attachment_path!)}
                      disabled={attachmentLoading}
                    >
                      <IconDownload />
                      <span>{attachmentLoading ? 'Загрузка…' : 'Открыть файл'}</span>
                    </button>
                  </div>
                )}
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}
