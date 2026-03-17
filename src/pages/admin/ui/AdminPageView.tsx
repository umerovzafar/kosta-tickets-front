import { useEffect } from 'react'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { useAdmin } from '../model/AdminContext'
import { AdminKPISection } from './AdminKPISection'
import { AdminUsersSection } from './AdminUsersSection'
import { TicketsSection } from './TicketsSection'
import { LateSection } from './LateSection'
import { TicketDetailsModal } from './TicketDetailsModal'
import './AdminPage.css'

export function AdminPageView() {
  const {
    isCollapsed,
    isMobileOpen,
    isMobile,
    onToggleCollapse,
    onCloseMobile,
    onOpenMobile,
    users,
    loading,
    error,
    loadUsers,
    ticketsLoading,
    ticketsError,
    ticketSearch,
    setTicketSearch,
    ticketStatusFilter,
    setTicketStatusFilter,
    ticketPriorityFilter,
    setTicketPriorityFilter,
    includeArchivedTickets,
    setIncludeArchivedTickets,
    statusOptions,
    priorityOptions,
    filteredTickets,
    loadTickets,
    ticketDetails,
    ticketDetailsLoading,
    ticketDetailsError,
    openTicketDetails,
    closeTicketDetails,
    lateLoading,
    lateError,
    lateMetrics,
    loadAttendance,
    metrics,
  } = useAdmin()

  useEffect(() => {
    if (isMobile && isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, isMobileOpen])

  useEffect(() => {
    if (!isMobile || !isMobileOpen) return
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [isMobile, isMobileOpen, onCloseMobile])

  return (
    <div className="ap">
      <div className="ap__sidebar-wrap">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
          isMobileOpen={isMobileOpen}
          onCloseMobile={onCloseMobile}
          isMobile={isMobile}
        />
      </div>
      <main className="ap__main">
        <header className="ap__header">
          {isMobile && (
            <button type="button" className="ap__menu-btn" onClick={onOpenMobile} aria-label="Открыть меню">
              <IconMenu />
            </button>
          )}
          <div className="ap__header-inner">
            <div className="ap__header-left">
              <h1 className="ap__title">Админ‑панель</h1>
              <p className="ap__subtitle">Управление пользователями, тикетами и посещаемостью</p>
            </div>
            <div className="ap__header-right">
              <button type="button" className="ap__refresh-btn" onClick={loadUsers} disabled={loading} title="Обновить данные">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              </button>
            </div>
          </div>
        </header>

        <div className="ap__content">
          {error && (
            <div className="ap__alert ap__alert--error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Не удалось загрузить пользователей: {error}</span>
              <button type="button" className="ap__alert-btn" onClick={loadUsers} disabled={loading}>Повторить</button>
            </div>
          )}

          <AdminKPISection metrics={metrics} loading={loading} usersCount={users.length} />

          <div className="ap__grid">
            <AdminUsersSection />
          </div>

          <div className="ap__bottom-grid">
            <TicketsSection
              tickets={filteredTickets}
              ticketsLoading={ticketsLoading}
              ticketsError={ticketsError}
              ticketSearch={ticketSearch}
              setTicketSearch={setTicketSearch}
              ticketStatusFilter={ticketStatusFilter}
              setTicketStatusFilter={setTicketStatusFilter}
              ticketPriorityFilter={ticketPriorityFilter}
              setTicketPriorityFilter={setTicketPriorityFilter}
              includeArchivedTickets={includeArchivedTickets}
              setIncludeArchivedTickets={setIncludeArchivedTickets}
              statusOptions={statusOptions}
              priorityOptions={priorityOptions}
              loadTickets={loadTickets}
              openTicketDetails={openTicketDetails}
            />
            <LateSection
              lateLoading={lateLoading}
              lateError={lateError}
              lateMetrics={lateMetrics}
              loadAttendance={loadAttendance}
            />
          </div>
        </div>
      </main>

      {ticketDetails && (
        <TicketDetailsModal
          ticket={ticketDetails}
          loading={ticketDetailsLoading}
          error={ticketDetailsError}
          onClose={closeTicketDetails}
        />
      )}
    </div>
  )
}
