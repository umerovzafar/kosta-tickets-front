import { AnimatedLink } from '@shared/ui'
import { getUserEditUrl } from '@shared/config'
import type { TimeUserRow as TimeUserRowType } from '../model/types'

type TimeUserRowProps = {
  user: TimeUserRowType
  index: number
  isActionsOpen: boolean
  onActionsToggle: (id: string) => void
  onActionsClose: () => void
  actionsMenuRef: React.RefObject<HTMLDivElement | null>
}

export function TimeUserRow({
  user,
  index,
  isActionsOpen,
  onActionsToggle,
  onActionsClose,
  actionsMenuRef,
}: TimeUserRowProps) {
  const billablePct = user.hours > 0 ? (user.billableHours / user.hours) * 100 : 0
  const rowTitle = user.hours > 0
    ? `Оплачиваемые: ${user.billableHours.toFixed(2)}, неоплачиваемые: ${(user.hours - user.billableHours).toFixed(2)}`
    : undefined

  return (
    <div
      className={`time-users__row ${isActionsOpen ? 'time-users__row--menu-open' : ''}`}
      style={{ ['--time-row-delay' as string]: `${0.25 + index * 0.03}s` }}
    >
      <div className="time-users__cell time-users__cell--user">
        <span className="time-users__status" aria-hidden data-online={user.isOnline ? 'true' : 'false'} />
        <AnimatedLink to={getUserEditUrl(Number(user.id))} className="time-users__avatar-link" tabIndex={-1} aria-hidden>
          <span className="time-users__avatar">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.initials}
          </span>
        </AnimatedLink>
        <AnimatedLink to={getUserEditUrl(Number(user.id))} className="time-users__name time-users__name--link">
          {user.name}
        </AnimatedLink>
      </div>
      <div className="time-users__cell time-users__cell--hours">
        <div className="time-users__hours-block">
          <span className="time-users__hours-value">{user.hours.toFixed(2)}</span>
          {user.hours > 0 ? (
            <div
              className="time-users__row-bar"
              style={{ ['--time-row-billable-pct' as string]: `${billablePct}%` }}
              title={rowTitle}
            >
              <span className="time-users__row-bar-segment time-users__row-bar-segment--billable" />
              <span className="time-users__row-bar-segment time-users__row-bar-segment--non-billable" />
            </div>
          ) : (
            <div className="time-users__row-bar time-users__row-bar--empty" aria-hidden />
          )}
        </div>
      </div>
      <div className="time-users__cell time-users__cell--util">{user.utilizationPercent}%</div>
      <div className="time-users__cell time-users__cell--cap">{user.capacity.toFixed(2)}</div>
      <div className="time-users__cell time-users__cell--billable">{user.billableHours.toFixed(2)}</div>
      <div className="time-users__cell time-users__cell--actions" ref={isActionsOpen ? actionsMenuRef : undefined}>
        <button
          type="button"
          className={`time-users__actions-btn ${isActionsOpen ? 'time-users__actions-btn--open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={isActionsOpen}
          onClick={() => onActionsToggle(user.id)}
        >
          Действия
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {isActionsOpen && (
          <div className="time-users__actions-menu" role="menu">
            <AnimatedLink
              to={getUserEditUrl(Number(user.id))}
              className="time-users__actions-menu-item"
              role="menuitem"
              onClick={onActionsClose}
            >
              Редактировать
            </AnimatedLink>
            <button type="button" className="time-users__actions-menu-item" role="menuitem" onClick={onActionsClose}>
              Закрепить
            </button>
            <button type="button" className="time-users__actions-menu-item" role="menuitem" onClick={onActionsClose}>
              В архив
            </button>
            <button type="button" className="time-users__actions-menu-item time-users__actions-menu-item--disabled" role="menuitem" disabled>
              Удалить
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
