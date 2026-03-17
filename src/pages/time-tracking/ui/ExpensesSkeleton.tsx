export function ExpensesSkeleton() {
  return (
    <div className="exp exp--skeleton">
<div className="exp__topbar">
        <div className="exp__topbar-left">
          <span className="exp-skel__title" />
          <span className="exp-skel__track-btn" />
        </div>
        <div className="exp__tm-wrap">
          <span className="exp-skel__tm-btn" />
        </div>
      </div>
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
  )
}
