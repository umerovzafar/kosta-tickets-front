import { useState } from 'react'
import { TimeTrackingClientsPanel } from './TimeTrackingClientsPanel'
import { TimeTrackingClientTasksPanel } from './TimeTrackingClientTasksPanel'
import { TimeTrackingClientExpenseCategoriesPanel } from './TimeTrackingClientExpenseCategoriesPanel'
import { TimeTrackingClientProjectsPanel } from './TimeTrackingClientProjectsPanel'
import { TimeTrackingProjectAccessPanel } from './TimeTrackingProjectAccessPanel'

type SettingsTabId = 'clients' | 'tasks' | 'projects' | 'project-access' | 'expense-categories'

const SETTINGS_TABS: { id: SettingsTabId; label: string }[] = [
  { id: 'clients', label: 'Клиенты' },
  { id: 'tasks', label: 'Задачи' },
  { id: 'projects', label: 'Проекты' },
  { id: 'project-access', label: 'Доступ к проектам' },
  { id: 'expense-categories', label: 'Категории расходов' },
]

export function TimeTrackingSettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('clients')

  return (
    <div className="tt-settings">
<nav className="tt-settings__nav" role="tablist">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tt-settings__nav-tab${activeTab === tab.id ? ' tt-settings__nav-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
{activeTab === 'clients' && <TimeTrackingClientsPanel />}
{activeTab === 'tasks' && <TimeTrackingClientTasksPanel />}
{activeTab === 'projects' && <TimeTrackingClientProjectsPanel />}
{activeTab === 'project-access' && <TimeTrackingProjectAccessPanel />}
{activeTab === 'expense-categories' && <TimeTrackingClientExpenseCategoriesPanel />}

    </div>
  )
}
