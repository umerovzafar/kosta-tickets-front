import { useInventory } from '../model'
import { InvSelect } from './InvSelect'
import { formatDateOnly } from '@shared/lib/formatDate'
import { LIMIT } from '../model/constants'

export function InventoryItemsSection() {
  const {
    canEdit,
    canCreateItems,
    categories,
    statuses,
    users,
    items,
    loadingItems,
    filterCategoryId,
    setFilterCategoryId,
    filterStatus,
    setFilterStatus,
    filterAssignedTo,
    setFilterAssignedTo,
    includeArchived,
    setIncludeArchived,
    skip,
    setSkip,
    setItemModal,
    resetItemForm,
    setFormError,
    setAssignModal,
    setAssignUserId,
    setDeleteTarget,
    categoryById,
    statusLabel,
    getItemPhotoUrl,
    openEditItem,
    handleUnassign,
    handleArchive,
  } = useInventory()

  return (
    <section className="inv__card">
      <div className="inv__card-head">
        <h2 className="inv__card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
          Позиции
        </h2>
        <div className="inv__card-head-right">
          <span className="inv__card-count">{items.length}</span>
          {canCreateItems && (
            <button
              type="button"
              className="inv__btn inv__btn--primary"
              onClick={() => {
                setItemModal('add')
                resetItemForm()
                setFormError(null)
              }}
            >
              + Позиция
            </button>
          )}
        </div>
      </div>

      <div className="inv__toolbar">
        <div className="inv__toolbar-group">
          <label className="inv__field">
            <span className="inv__field-label">Категория</span>
            <InvSelect
              value={filterCategoryId === '' ? '' : filterCategoryId}
              placeholder="Все"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => {
                setFilterCategoryId(v === '' ? '' : Number(v))
                setSkip(0)
              }}
            />
          </label>
          <label className="inv__field">
            <span className="inv__field-label">Статус</span>
            <InvSelect
              value={filterStatus}
              placeholder="Все"
              options={statuses.map((s) => ({ value: s.value, label: s.label }))}
              onChange={(v) => {
                setFilterStatus(String(v))
                setSkip(0)
              }}
            />
          </label>
          {canEdit && users.length > 0 && (
            <label className="inv__field">
              <span className="inv__field-label">Закреплено за</span>
              <InvSelect
                value={filterAssignedTo === '' ? '' : filterAssignedTo}
                placeholder="Все"
                options={users.map((u) => ({ value: u.id, label: u.display_name || u.email }))}
                onChange={(v) => {
                  setFilterAssignedTo(v === '' ? '' : Number(v))
                  setSkip(0)
                }}
              />
            </label>
          )}
        </div>
        <label className="inv__switch-label">
          <span className="switch">
            <input
              type="checkbox"
              className="switch__input"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked)
                setSkip(0)
              }}
            />
            <span className="switch__track">
              <span className="switch__thumb" />
            </span>
          </span>
          <span>С архивом</span>
        </label>
      </div>

      {loadingItems ? (
        <div className="inv__table-wrap inv__table-wrap--skeleton">
          <table className="inv__table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th>Инв. номер</th>
                <th>Статус</th>
                <th>Закреплено за</th>
                <th>Покупка</th>
                <th>Гарантия</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td data-label="Название">
                    <span className="inv__skel inv__skel--lg" />
                  </td>
                  <td data-label="Категория">
                    <span className="inv__skel" />
                  </td>
                  <td data-label="Инв. номер">
                    <span className="inv__skel" />
                  </td>
                  <td data-label="Статус">
                    <span className="inv__skel-pill" />
                  </td>
                  <td data-label="Закреплено за">
                    <span className="inv__skel inv__skel--md" />
                  </td>
                  <td data-label="Покупка">
                    <span className="inv__skel inv__skel--sm" />
                  </td>
                  <td data-label="Гарантия">
                    <span className="inv__skel inv__skel--sm" />
                  </td>
                  {canEdit && (
                    <td className="inv__td-actions" data-label="">
                      <span className="inv__skel inv__skel--sm" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        <div className="inv__empty">
          <p>Нет позиций</p>
          {canCreateItems && (
            <button
              type="button"
              className="inv__btn inv__btn--ghost"
              onClick={() => {
                setItemModal('add')
                resetItemForm()
              }}
            >
              Добавить первую
            </button>
          )}
        </div>
      ) : (
        <div className="inv__table-wrap">
          <table className="inv__table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th>Инв. номер</th>
                <th>Статус</th>
                <th>Закреплено за</th>
                <th>Покупка</th>
                <th>Гарантия</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const cat = categoryById(item.category_id)
                const assigned = users.find((u) => u.id === item.assigned_to_user_id)
                const photoUrl = getItemPhotoUrl(item.photo_path)
                return (
                  <tr key={item.uuid} className={item.is_archived ? 'inv__row--dim' : ''}>
                    <td data-label="Название">
                      <div className="inv__name-cell">
                        {photoUrl && (
                          <span className="inv__thumb">
                            <img src={photoUrl} alt="" />
                          </span>
                        )}
                        <div>
                          <div className="inv__name-title">{item.name}</div>
                          {item.description && <div className="inv__name-sub">{item.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td data-label="Категория">{cat?.name ?? '—'}</td>
                    <td className="inv__td-mono" data-label="Инв. номер">{item.inventory_number}</td>
                    <td data-label="Статус">
                      <span className={`inv__status inv__status--${item.status}`}>{statusLabel(item.status)}</span>
                    </td>
                    <td data-label="Закреплено за">{assigned ? assigned.display_name || assigned.email : '—'}</td>
                    <td className="inv__td-date" data-label="Покупка">{formatDateOnly(item.purchase_date)}</td>
                    <td className="inv__td-date" data-label="Гарантия">{formatDateOnly(item.warranty_until)}</td>
                    {canEdit && (
                      <td className="inv__td-actions" data-label="">
                        <div className="inv__actions">
                          <button type="button" className="inv__mini-btn" onClick={() => openEditItem(item)}>
                            Изменить
                          </button>
                          {item.assigned_to_user_id ? (
                            <button type="button" className="inv__mini-btn" onClick={() => handleUnassign(item)}>
                              Открепить
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="inv__mini-btn"
                              onClick={() => {
                                setAssignModal(item)
                                setAssignUserId('')
                                setFormError(null)
                              }}
                            >
                              Закрепить
                            </button>
                          )}
                          <button
                            type="button"
                            className="inv__mini-btn"
                            onClick={() => handleArchive(item, !item.is_archived)}
                          >
                            {item.is_archived ? 'Восстановить' : 'В архив'}
                          </button>
                          <button
                            type="button"
                            className="inv__mini-btn inv__mini-btn--danger"
                            onClick={() => setDeleteTarget({ type: 'item', uuid: item.uuid })}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length >= LIMIT && (
        <div className="inv__pager">
          <button
            type="button"
            className="inv__btn inv__btn--ghost"
            disabled={skip === 0}
            onClick={() => setSkip((s) => Math.max(0, s - LIMIT))}
          >
            Назад
          </button>
          <span className="inv__pager-info">Показано {items.length}</span>
          <button type="button" className="inv__btn inv__btn--ghost" onClick={() => setSkip((s) => s + LIMIT)}>
            Далее
          </button>
        </div>
      )}
    </section>
  )
}
