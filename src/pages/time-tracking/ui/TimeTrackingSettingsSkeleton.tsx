export function TimeTrackingSettingsSkeleton() {
  return (
    <div className="tt-settings tt-settings--skeleton">
<nav className="tt-settings__nav">
        <span className="tt-skel__nav-tab" />
        <span className="tt-skel__nav-tab" />
        <span className="tt-skel__nav-tab" />
      </nav>
<div className="tt-settings__content">
        <span className="tt-skel__title" />

        <div className="tt-settings__toolbar">
          <div className="tt-settings__toolbar-left">
            <span className="tt-skel__btn tt-skel__btn--green" />
            <span className="tt-skel__btn" />
            <span className="tt-skel__btn" />
          </div>
          <span className="tt-skel__btn tt-skel__btn--link" />
        </div>

        <div className="tt-settings__search-wrap">
          <span className="tt-skel__search" />
        </div>

        <div className="tt-settings__list">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="tt-settings__list-row tt-skel__list-row">
              <span className="tt-skel__row-edit" />
              <span className="tt-skel__row-name" />
              <span className="tt-skel__row-add" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
