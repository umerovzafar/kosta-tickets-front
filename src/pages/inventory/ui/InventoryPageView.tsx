import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Sidebar, IconMenu } from '@widgets/sidebar'
import { useInventory } from '../model'
import { InventoryKPISection } from './InventoryKPISection'
import { InventoryCategoriesSection } from './InventoryCategoriesSection'
import { InventoryItemsSection } from './InventoryItemsSection'
import { CategoryModal } from './CategoryModal'
import { ItemModal } from './ItemModal'
import { AssignModal } from './AssignModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import './InventoryPage.css'

export function InventoryPageView() {
  const {
    isMobile,
    isMobileOpen,
    isCollapsed,
    onToggleCollapse,
    onCloseMobile,
    onOpenMobile,
    error,
    loadingItems,
    loadItems,
  } = useInventory()

  const [inventoryTab, setInventoryTab] = useState<'positions' | 'categories'>('positions')

  const sidebarWrap = (
    <div className={`inv__sidebar-wrap${isCollapsed ? ' inv__sidebar-wrap--collapsed' : ''}`}>
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={onCloseMobile}
        isMobile={isMobile}
      />
    </div>
  )

  return (
    <div className="inv">
      {typeof document !== 'undefined' ? createPortal(sidebarWrap, document.body) : sidebarWrap}
      <main className={`inv__main${isCollapsed && !isMobile ? ' inv__main--collapsed' : ''}`}>
        <header className="inv__header">
          {isMobile && (
            <button
              type="button"
              className="inv__menu-btn"
              onClick={onOpenMobile}
              aria-label="Открыть меню"
            >
              <IconMenu />
            </button>
          )}
          <div className="inv__header-inner">
            <div>
              <h1 className="inv__title">Инвентаризация</h1>
              <p className="inv__subtitle">Учёт техники, категории и закрепление за сотрудниками</p>
            </div>
            <button
              type="button"
              className="inv__icon-btn"
              onClick={loadItems}
              disabled={loadingItems}
              title="Обновить"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>
        </header>

        <div className="inv__content">
          {error && (
            <div className="inv__alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <InventoryKPISection />

          <div className="inv__tabs-wrap" role="tablist" aria-label="Разделы инвентаризации">
            <button
              type="button"
              role="tab"
              id="inv-tab-positions"
              aria-selected={inventoryTab === 'positions'}
              aria-controls="inv-panel-positions"
              tabIndex={inventoryTab === 'positions' ? 0 : -1}
              className={`inv__tab${inventoryTab === 'positions' ? ' inv__tab--active' : ''}`}
              onClick={() => setInventoryTab('positions')}
            >
              Позиции
            </button>
            <button
              type="button"
              role="tab"
              id="inv-tab-categories"
              aria-selected={inventoryTab === 'categories'}
              aria-controls="inv-panel-categories"
              tabIndex={inventoryTab === 'categories' ? 0 : -1}
              className={`inv__tab${inventoryTab === 'categories' ? ' inv__tab--active' : ''}`}
              onClick={() => setInventoryTab('categories')}
            >
              Категории
            </button>
          </div>

          {inventoryTab === 'positions' && (
            <div id="inv-panel-positions" role="tabpanel" aria-labelledby="inv-tab-positions" className="inv__tab-panel">
              <InventoryItemsSection />
            </div>
          )}
          {inventoryTab === 'categories' && (
            <div id="inv-panel-categories" role="tabpanel" aria-labelledby="inv-tab-categories" className="inv__tab-panel">
              <InventoryCategoriesSection />
            </div>
          )}
        </div>
      </main>

      <CategoryModal />
      <ItemModal />
      <AssignModal />
      <DeleteConfirmModal />
    </div>
  )
}
