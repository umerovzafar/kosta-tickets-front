import type { LateMetrics } from '../model/types'

type LateSectionProps = {
  lateLoading: boolean
  lateError: string | null
  lateMetrics: LateMetrics
  loadAttendance: () => Promise<void>
}

export function LateSection({
  lateLoading,
  lateError,
  lateMetrics,
  loadAttendance,
}: LateSectionProps) {
  return (
    <section className="ap__card ap__card--late">
      <div className="ap__card-head">
        <h2 className="ap__card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Опоздания сегодня
        </h2>
        <button type="button" className="ap__icon-btn" onClick={loadAttendance} disabled={lateLoading} title="Обновить">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>
      </div>
      {lateError && <p className="ap__inline-error">{lateError}</p>}
      <div className="ap__late-stats">
        {lateLoading && lateMetrics.total === 0 ? (
          <div className="ap__late-stats-skel"><span className="ap__skel ap__skel--sm" /><span className="ap__skel ap__skel--md" /></div>
        ) : (
          <>
            <div className="ap__late-stat">
              <span className="ap__late-num">{lateMetrics.total}</span>
              <span className="ap__late-lbl">Всего</span>
            </div>
            <div className="ap__late-stat ap__late-stat--danger">
              <span className="ap__late-num">{lateMetrics.lateCount}</span>
              <span className="ap__late-lbl">Опоздали</span>
            </div>
            <div className="ap__late-stat ap__late-stat--ok">
              <span className="ap__late-num">{lateMetrics.onTime}</span>
              <span className="ap__late-lbl">Вовремя</span>
            </div>
          </>
        )}
      </div>
      <div className="ap__late-bar">
        {lateLoading && lateMetrics.total === 0 ? (
          <div className="ap__skel ap__skel--lg" style={{ height: 8 }} />
        ) : (
          <>
            <div className="ap__late-bar-ok" style={{ width: lateMetrics.total ? `${(lateMetrics.onTime / lateMetrics.total) * 100}%` : '0%' }} />
            <div className="ap__late-bar-bad" style={{ width: lateMetrics.total ? `${(lateMetrics.lateCount / lateMetrics.total) * 100}%` : '0%' }} />
          </>
        )}
      </div>
      <div className="ap__late-list-wrap">
        {lateLoading && lateMetrics.total === 0 && (
          <ul className="ap__late-list">
            {Array.from({ length: 3 }).map((_, idx) => (
              <li key={`late-skel-${idx}`} className="ap__late-item"><span className="ap__skel ap__skel--md" /><span className="ap__skel ap__skel--sm" /></li>
            ))}
          </ul>
        )}
        {!lateLoading && lateMetrics.lateEmployees.length === 0 && <p className="ap__empty-hint">Опоздавших за сегодня не обнаружено</p>}
        {!lateLoading && lateMetrics.lateEmployees.length > 0 && (
          <ul className="ap__late-list">
            {lateMetrics.lateEmployees.slice(0, 5).map((r) => (
              <li key={`${r.name}-${r.firstTime}`} className="ap__late-item">
                <div>
                  <span className="ap__late-name">{r.name}</span>
                  <span className="ap__late-dept">{r.department}</span>
                </div>
                <div className="ap__late-meta">
                  <span className="ap__late-time">{new Date(r.firstTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="ap__late-badge">+{Math.round(r.minutesLate)} мин</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
