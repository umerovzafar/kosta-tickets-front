import { useAdmin } from '../model/AdminContext'
import { AdminSelect } from './AdminSelect'
import { UserCard } from './UserCard'
import { KNOWN_ROLES } from '../model/constants'

export function AdminUsersSection() {
  const {
    users,
    loading,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    includeArchived,
    setIncludeArchived,
    filteredUsers,
    userActionError,
    savingUserId,
    handleToggleBlocked,
    handleToggleArchived,
    handleRoleChange,
    handleTTRoleChange,
    handlePositionChange,
    openRoleDropdown,
    setOpenRoleDropdown,
    roleMenuPos,
    setRoleMenuPos,
    roleDropdownRef,
    openTTDropdown,
    setOpenTTDropdown,
    ttMenuPos,
    setTTMenuPos,
    ttDropdownRef,
    openPosDropdown,
    setOpenPosDropdown,
    posMenuPos,
    setPosMenuPos,
    posDropdownRef,
    ROLE_META,
    TT_ROLE_OPTIONS,
    TT_POSITIONS,
    TT_POSITION_META,
  } = useAdmin()

  return (
    <section className="ap__card ap__card--users">
      <div className="ap__card-head">
        <h2 className="ap__card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          Пользователи
        </h2>
        <span className="ap__card-count">{filteredUsers.length}</span>
      </div>
      {userActionError && <p className="ap__inline-error">{userActionError}</p>}
      <div className="ap__toolbar">
        <div className="ap__search-wrap">
          <svg className="ap__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="search" className="ap__search" placeholder="Поиск по имени, email или роли…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="ap__toolbar-right">
          <AdminSelect value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: 'Все роли' }, ...KNOWN_ROLES.map((r) => ({ value: r, label: r }))]} />
          <label className="ap__switch-label">
            <span className="switch">
              <input type="checkbox" className="switch__input" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
              <span className="switch__track"><span className="switch__thumb" /></span>
            </span>
            <span>Архивные</span>
          </label>
        </div>
      </div>
      <div className="ap__users-grid">
        {loading && users.length === 0 && Array.from({ length: 3 }).map((_, idx) => (
          <div key={`skeleton-${idx}`} className="ap__user-card ap__user-card--skeleton">
            <div className="ap__user-card-header">
              <span className="ap__skel ap__skel--avatar" />
              <div className="ap__user-card-header-text">
                <span className="ap__skel ap__skel--lg" />
                <span className="ap__skel ap__skel--md" />
              </div>
            </div>
            <div className="ap__user-card-body">
              <div className="ap__user-card-row"><span className="ap__skel ap__skel--sm" /><span className="ap__skel-pill" /></div>
              <div className="ap__user-card-row"><span className="ap__skel ap__skel--sm" /><span className="ap__skel-pill" /></div>
            </div>
          </div>
        ))}
        {!loading && filteredUsers.length === 0 && (
          <p className="ap__users-empty">Пользователи не найдены</p>
        )}
        {filteredUsers.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            KNOWN_ROLES={KNOWN_ROLES}
            savingUserId={savingUserId}
            openRoleDropdown={openRoleDropdown}
            setOpenRoleDropdown={setOpenRoleDropdown}
            roleMenuPos={roleMenuPos}
            setRoleMenuPos={setRoleMenuPos}
            roleDropdownRef={roleDropdownRef}
            openTTDropdown={openTTDropdown}
            setOpenTTDropdown={setOpenTTDropdown}
            ttMenuPos={ttMenuPos}
            setTTMenuPos={setTTMenuPos}
            ttDropdownRef={ttDropdownRef}
            openPosDropdown={openPosDropdown}
            setOpenPosDropdown={setOpenPosDropdown}
            posMenuPos={posMenuPos}
            setPosMenuPos={setPosMenuPos}
            posDropdownRef={posDropdownRef}
            onRoleChange={handleRoleChange}
            onTTRoleChange={handleTTRoleChange}
            onPositionChange={handlePositionChange}
            onToggleBlocked={handleToggleBlocked}
            onToggleArchived={handleToggleArchived}
            ROLE_META={ROLE_META}
            TT_ROLE_OPTIONS={TT_ROLE_OPTIONS}
            TT_POSITIONS={TT_POSITIONS}
            TT_POSITION_META={TT_POSITION_META}
          />
        ))}
      </div>
    </section>
  )
}
