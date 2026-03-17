import type { TimeTabId } from '../model/types'
import { TABS } from '../model/constants'

type TimeTrackingTabBarProps = {
  activeTab: TimeTabId
  onTabChange: (id: TimeTabId) => void
}

export function TimeTrackingTabBar({ activeTab, onTabChange }: TimeTrackingTabBarProps) {
  return (
    <nav className="time-page__tabbar" role="tablist" aria-label="Разделы учёта времени">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`time-tab-${tab.id}`}
          id={`time-tab-btn-${tab.id}`}
          className={`time-page__tab ${activeTab === tab.id ? 'time-page__tab--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
