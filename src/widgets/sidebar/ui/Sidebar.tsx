import { useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { AnimatedNavLink } from '@shared/ui'
import { routes } from '@shared/config'
import { logout } from '@shared/lib'
import { applyTheme, getInitialTheme, type AppTheme } from '@shared/lib/theme'
import { useCurrentUser } from '@shared/hooks'
import { canAccessExpensesSection } from '@pages/expenses/model/expenseModeration'
import { canAccessTimeTracking } from '@pages/time-tracking/model/timeTrackingAccess'
import {
  IconTicket,
  IconHome,
  IconGear,
  IconClock,
  IconBox,
  IconStopwatch,
  IconList,
  IconWallet,
  IconFileText,
  IconHelpCircle,
  IconMoon,
  IconLogOut,
  IconUser,
  IconChevronLeft,
  IconChevronRight,
  IconCalendarCheck,
} from './SidebarIcons'
import './Sidebar.css'

function getInitials(displayName: string, email: string): string {
  const name = displayName?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    if (parts[0].length) return parts[0].slice(0, 2).toUpperCase()
  }
  if (email?.trim()) return email.trim().slice(0, 2).toUpperCase()
  return '?'
}

type SidebarNavItem = {
  to: string
  label: string
  icon: ComponentType
  /** Только при роли «Администратор» (как adminOnly в ProtectedRoute). */
  adminOnly?: boolean
}

const navItems: SidebarNavItem[] = [
  { to: routes.home, label: 'Главная', icon: IconHome },
  { to: routes.admin, label: 'Админ-панель', icon: IconGear },
  { to: routes.attendance, label: 'Посещаемость', icon: IconClock },
  {
    to: routes.vacationSchedule,
    label: 'График отпусков',
    icon: IconCalendarCheck,
    adminOnly: true,
  },
  { to: routes.inventory, label: 'Инвентаризация', icon: IconBox },
  { to: routes.timeTracking, label: 'Учёт времени', icon: IconStopwatch },
  { to: routes.todo, label: 'Список дел', icon: IconList },
  { to: routes.expenses, label: 'Расходы', icon: IconWallet },
  { to: routes.rules, label: 'Правила', icon: IconFileText },
  { to: routes.help, label: 'Помощь', icon: IconHelpCircle },
]

type SidebarProps = {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  isMobileOpen?: boolean
  onCloseMobile?: () => void
  isMobile?: boolean
}

export function Sidebar({
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  isMobile = false,
}: SidebarProps) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const initial = getInitialTheme()
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-theme', initial)
    }
    return initial
  })

  const toggleTheme = () => {
    const next: AppTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    applyTheme(next)
  }
  const showCollapsed = !isMobile && isCollapsed
  const { user, loading } = useCurrentUser()

  const role = user?.role?.toLowerCase() || ''
  const isEmployee = !loading && role.includes('сотрудник')
  const isAdminOrPartner = !loading && (role.includes('администратор') || role.includes('партнер'))
  let visibleNavItems = navItems

  if (isEmployee) {
    visibleNavItems = navItems.filter(
      (item) =>
        item.label === 'Главная' ||
        item.label === 'Учёт времени' ||
        item.label === 'Список дел' ||
        item.label === 'Расходы' ||
        item.label === 'Правила' ||
        item.label === 'Помощь',
    )
  } else if (!isAdminOrPartner) {
    visibleNavItems = navItems.filter((item) => item.label !== 'Админ-панель')
  }

  if (!loading && !canAccessExpensesSection(user?.role)) {
    visibleNavItems = visibleNavItems.filter((item) => item.label !== 'Расходы')
  }

  if (!loading && !canAccessTimeTracking(user)) {
    visibleNavItems = visibleNavItems.filter((item) => item.label !== 'Учёт времени')
  }

  if (!loading) {
    visibleNavItems = visibleNavItems.filter(
      (item) => !item.adminOnly || user?.role === 'Администратор',
    )
  }

  const sidebarContent = (
    <>
      {isMobile && (
        <button
          type="button"
          className={`sidebar__backdrop ${isMobileOpen ? 'sidebar__backdrop--visible' : ''}`}
          aria-hidden={!isMobileOpen}
          onClick={onCloseMobile}
          tabIndex={isMobileOpen ? 0 : -1}
        />
      )}
      <aside
        className={`sidebar ${showCollapsed ? 'sidebar--collapsed' : ''} ${isMobile ? 'sidebar--mobile' : ''} ${isMobile && isMobileOpen ? 'sidebar--mobile-open' : ''}`}
        aria-label="Навигация"
      >
        <div className="sidebar__header">
          <div className="sidebar__header-brand">
            <span className="sidebar__header-icon">
              <IconTicket />
            </span>
            <span className="sidebar__header-title">Тикет-система</span>
          </div>
          {!isMobile && onToggleCollapse && (
            <button
              type="button"
              className="sidebar__toggle"
              onClick={onToggleCollapse}
              aria-label={showCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
              title={showCollapsed ? 'Развернуть' : 'Свернуть'}
            >
              {showCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
            </button>
          )}
          {isMobile && onCloseMobile && (
            <button
              type="button"
              className="sidebar__close"
              onClick={onCloseMobile}
              aria-label="Закрыть меню"
            />
          )}
        </div>
        <div className="sidebar__user">
          <span className="sidebar__user-icon">
            {user?.picture ? (
              <img
                src={user.picture}
                alt=""
                className="sidebar__user-avatar"
                width={40}
                height={40}
              />
            ) : user ? (
              <span className="sidebar__user-avatar sidebar__user-avatar--initials">
                {getInitials(user?.display_name ?? '', user?.email ?? '')}
              </span>
            ) : (
              <IconUser />
            )}
          </span>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">
              {loading ? '…' : (user?.display_name || 'Пользователь')}
            </span>
            <span className="sidebar__user-dept">
              {loading ? '…' : (user?.role || 'Отдел')}
            </span>
          </div>
        </div>
        <nav className="sidebar__nav">
          <ul className="sidebar__nav-list">
            {visibleNavItems.map(({ to, label, icon: Icon }) => {
              const IconComponent = Icon
              return (
                <li key={label}>
                  <AnimatedNavLink
                    to={to}
                    className={({ isActive }) =>
                      `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                    }
                    end={to === routes.home}
                    onClick={isMobile ? onCloseMobile : undefined}
                    title={label}
                  >
                    <span className="sidebar__link-icon"><IconComponent /></span>
                    <span className="sidebar__link-text">{label}</span>
                  </AnimatedNavLink>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="sidebar__footer">
          <button
            type="button"
            className="sidebar__btn"
            title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
            onClick={toggleTheme}
          >
            <span className="sidebar__btn-icon"><IconMoon /></span>
            <span className="sidebar__btn-text">
              {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
            </span>
          </button>
          <button
            type="button"
            className="sidebar__btn sidebar__btn--logout"
            onClick={() => logout()}
            title="Выход"
          >
            <span className="sidebar__btn-icon"><IconLogOut /></span>
            <span className="sidebar__btn-text">Выход</span>
          </button>
        </div>
      </aside>
    </>
  )

  if (isMobile && typeof document !== 'undefined') {
    return createPortal(sidebarContent, document.body)
  }
  return sidebarContent
}

