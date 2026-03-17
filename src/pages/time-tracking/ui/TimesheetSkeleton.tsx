export function TimesheetSkeleton() {
  return (
    <div className="tsp tsp--skeleton">
<div className="tsp__top">
        <div className="tsp__top-l">
          <span className="tsp-skel__arr" />
          <span className="tsp-skel__arr" />
          <span className="tsp-skel__heading" />
        </div>
        <div className="tsp__top-r">
          <div className="tsp__seg tsp-skel__seg">
            <span className="tsp-skel__seg-btn" />
            <span className="tsp-skel__seg-btn" />
          </div>
        </div>
      </div>
<div className="tsp__strip">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="tsp__day tsp-skel__day">
            <span className="tsp-skel__day-wk" />
            <span className="tsp-skel__day-n" />
            <div className="tsp__day-bar-wrap">
              <span className="tsp-skel__day-bar" />
            </div>
            <span className="tsp-skel__day-h" />
          </div>
        ))}
        <div className="tsp__wtotal tsp-skel__wtotal">
          <span className="tsp-skel__wtotal-lbl" />
          <span className="tsp-skel__wtotal-n" />
          <div className="tsp__wtotal-bar-wrap">
            <span className="tsp-skel__wtotal-bar" />
          </div>
          <span className="tsp-skel__wtotal-cap" />
        </div>
      </div>
<div className="tsp__content">
        <div className="tsp__groups">
          <div className="tsp__group">
            <div className="tsp__rows">
              {[1, 2, 3].map((i) => (
                <div key={i} className="tsp__row tsp-skel__row">
                  <span className="tsp-skel__row-bar" />
                  <div className="tsp__row-txt">
                    <span className="tsp-skel__row-proj" />
                    <span className="tsp-skel__row-task" />
                    <span className="tsp-skel__row-notes" />
                  </div>
                  <div className="tsp__row-acts">
                    <span className="tsp-skel__row-h" />
                    <span className="tsp-skel__btn" />
                    <span className="tsp-skel__btn" />
                  </div>
                </div>
              ))}
              <div className="tsp__day-sum tsp-skel__day-sum">
                <span className="tsp-skel__day-sum-add" />
                <span className="tsp-skel__day-sum-total" />
              </div>
            </div>
          </div>
        </div>
      </div>
<div className="tsp__foot">
        <div className="tsp__foot-total">
          <span className="tsp-skel__foot-lbl" />
          <span className="tsp-skel__foot-n" />
        </div>
        <div className="tsp__submit-wrap">
          <span className="tsp-skel__submit" />
        </div>
      </div>
    </div>
  )
}
