import { memo } from 'react'
import type { TicketStats } from '../model/types'

type HomeStatsProps = {
  total: number
  ticketStats: TicketStats
}

export const HomeStats = memo(function HomeStats({ total, ticketStats }: HomeStatsProps) {
  return (
    <div className="home-stats">
      <div className="home-stats__card home-stats__card--total">
        <div className="home-stats__icon-wrap home-stats__icon-wrap--total">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div className="home-stats__text">
          <span className="home-stats__number">{total}</span>
          <span className="home-stats__label">Всего заявок</span>
        </div>
      </div>
      <div className="home-stats__card home-stats__card--progress">
        <div className="home-stats__icon-wrap home-stats__icon-wrap--progress">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div className="home-stats__text">
          <span className="home-stats__number">{ticketStats.inProgress}</span>
          <span className="home-stats__label">В работе</span>
        </div>
      </div>
      <div className="home-stats__card home-stats__card--closed">
        <div className="home-stats__icon-wrap home-stats__icon-wrap--closed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div className="home-stats__text">
          <span className="home-stats__number">{ticketStats.closed}</span>
          <span className="home-stats__label">Закрытые</span>
        </div>
      </div>
      <div className="home-stats__card home-stats__card--impossible">
        <div className="home-stats__icon-wrap home-stats__icon-wrap--impossible">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div className="home-stats__text">
          <span className="home-stats__number">{ticketStats.impossible}</span>
          <span className="home-stats__label">Невозможно</span>
        </div>
      </div>
    </div>
  )
})
