export function ExpensesSkeleton() {
  return (
    <div className="time-page__panel tt-exp-panel exp--skeleton">
      <span className="exp-skel__page-title" />
      <span className="exp-skel__lead" />
      <div className="tt-settings__actions-row tt-exp-panel__bar exp-skel__actions-row">
        <div className="exp-skel__scope-row">
          <span className="exp-skel__scope-label" />
          <span className="exp-skel__scope-trigger" />
        </div>
        <span className="exp-skel__add-btn" />
      </div>
      <div className="tt-settings__list tt-exp-panel__body">
        <div className="tt-exp-panel__weeks">
          <div className="exp__week">
            <div className="exp__week-head exp-skel__week-head">
              <div className="exp__week-head-left">
                <span className="exp-skel__chevron" />
                <span className="exp-skel__range" />
                <span className="exp-skel__badge" />
              </div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="exp__item exp-skel__item">
                <span className="exp__item-date">
                  <span className="exp-skel__weekday" />
                  <span className="exp-skel__day" />
                </span>
                <div className="exp__item-info">
                  <span className="exp-skel__proj" />
                  <span className="exp-skel__cat" />
                  <span className="exp-skel__notes" />
                </div>
                <div className="exp__item-right">
                  <span className="exp-skel__amount" />
                  <span className="exp-skel__icon" />
                  <span className="exp-skel__icon" />
                </div>
              </div>
            ))}
            <div className="exp__week-total exp-skel__week-total">
              <span className="exp-skel__total-label" />
              <span className="exp-skel__total-val" />
            </div>
          </div>
          <div className="exp__week">
            <div className="exp__week-head exp-skel__week-head">
              <div className="exp__week-head-left">
                <span className="exp-skel__chevron" />
                <span className="exp-skel__range exp-skel__range--short" />
                <span className="exp-skel__badge" />
              </div>
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="exp__item exp-skel__item">
                <span className="exp__item-date">
                  <span className="exp-skel__weekday" />
                  <span className="exp-skel__day" />
                </span>
                <div className="exp__item-info">
                  <span className="exp-skel__proj exp-skel__proj--short" />
                  <span className="exp-skel__cat" />
                </div>
                <div className="exp__item-right">
                  <span className="exp-skel__amount" />
                  <span className="exp-skel__icon" />
                  <span className="exp-skel__icon" />
                </div>
              </div>
            ))}
            <div className="exp__week-total exp-skel__week-total">
              <span className="exp-skel__total-label" />
              <span className="exp-skel__total-val" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
