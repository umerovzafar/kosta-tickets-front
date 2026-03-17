import { useState, useMemo, useEffect, useRef } from 'react'
import { TimeTrackingSettingsSkeleton } from './TimeTrackingSettingsSkeleton'

type SettingsTabId = 'clients' | 'tasks' | 'expense-categories'

const SETTINGS_TABS: { id: SettingsTabId; label: string }[] = [
  { id: 'clients', label: 'Клиенты' },
  { id: 'tasks', label: 'Задачи' },
  { id: 'expense-categories', label: 'Категории расходов' },
]

const IcoSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
const IcoChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>
)
const IcoArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
)

export function TimeTrackingSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<SettingsTabId>('clients')
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const importRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!importOpen) return
    const h = (e: MouseEvent) => {
      if (importRef.current && !importRef.current.contains(e.target as Node)) setImportOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [importOpen])

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    const clients: string[] = []
    if (!q) return clients
    return clients.filter((c) => c.toLowerCase().includes(q))
  }, [search])

  if (loading) return <TimeTrackingSettingsSkeleton />

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
{activeTab === 'clients' && (
        <div className="tt-settings__content">
          <h1 className="tt-settings__page-title">Клиенты</h1>

          <div className="tt-settings__toolbar">
            <div className="tt-settings__toolbar-left">
              <button type="button" className="tt-settings__btn tt-settings__btn--green">
                + Новый клиент
              </button>
              <button type="button" className="tt-settings__btn tt-settings__btn--outline tt-settings__btn--accent-text">
                + Добавить контакт
              </button>
              <div className="tt-settings__dropdown-wrap" ref={importRef}>
                <button
                  type="button"
                  className="tt-settings__btn tt-settings__btn--outline"
                  onClick={() => setImportOpen((v) => !v)}
                  aria-expanded={importOpen}
                >
                  Импорт/Экспорт <IcoChevron />
                </button>
                {importOpen && (
                  <div className="tt-settings__dropdown">
                    <button type="button" className="tt-settings__dropdown-item">Импорт клиентов</button>
                    <button type="button" className="tt-settings__dropdown-item">Экспорт клиентов</button>
                  </div>
                )}
              </div>
            </div>
            <button type="button" className="tt-settings__btn tt-settings__btn--link">
              Архивные клиенты <IcoArrowRight />
            </button>
          </div>

          <div className="tt-settings__search-wrap">
            <span className="tt-settings__search-icon"><IcoSearch /></span>
            <input
              type="search"
              className="tt-settings__search"
              placeholder="Фильтр по клиенту или контакту"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="tt-settings__list">
            {filteredClients.map((name) => (
              <div key={name} className="tt-settings__list-row">
                <button type="button" className="tt-settings__row-edit">Редактировать</button>
                <span className="tt-settings__row-name">{name}</span>
                <button type="button" className="tt-settings__row-add">+ Добавить контакт</button>
              </div>
            ))}
          </div>
        </div>
      )}
{activeTab === 'tasks' && (
        <div className="tt-settings__content">
          <h1 className="tt-settings__page-title">Задачи</h1>
          <p className="tt-settings__desc">
            Типы задач для учёта времени в расписании
          </p>
          <div className="tt-settings__list tt-settings__list--simple">
            {[].map((task: string) => (
              <div key={task} className="tt-settings__list-row tt-settings__list-row--simple">
                <span className="tt-settings__row-name">{task}</span>
                <button type="button" className="tt-settings__row-edit">Редактировать</button>
              </div>
            ))}
          </div>
        </div>
      )}
{activeTab === 'expense-categories' && (
        <div className="tt-settings__content">
          <h1 className="tt-settings__page-title">Категории расходов</h1>
          <p className="tt-settings__desc">
            Категории для учёта расходов (транспорт, питание, командировки и т.д.)
          </p>
          <div className="tt-settings__list tt-settings__list--simple">
            {[].map((cat: string) => (
              <div key={cat} className="tt-settings__list-row tt-settings__list-row--simple">
                <span className="tt-settings__row-name">{cat}</span>
                <button type="button" className="tt-settings__row-edit">Редактировать</button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
