import { memo } from 'react';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pct = (n) => `${n}%`;

// Bars are decorative (aria-hidden); every value is also present as text.
function BarRow({ label, width, children, variant }) {
  return (
    <li className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar" aria-hidden="true">
        <div className={`bar-fill${variant ? ` bar-fill--${variant}` : ''}`} style={{ width: `${Math.max(0, Math.min(100, width))}%` }} />
      </div>
      <span className="bar-value">{children}</span>
    </li>
  );
}

function AnalyticsView({ analytics: a, status }) {
  return (
    <section aria-labelledby="analytics-heading" id="view-analytics">
      <h2 id="analytics-heading" tabIndex={-1}>Performance analytics</h2>
      {status !== 'ready' ? (
        <p className="muted">{status === 'loading' ? 'Analytics appear once records have loaded.' : 'Analytics are unavailable until records load.'}</p>
      ) : a.total === 0 ? (
        <div className="empty panel">
          <p className="empty-title">No data found</p>
          <p className="muted">Add a record to see analytics.</p>
        </div>
      ) : (
        <>
          <dl className="stats">
            <div className="stat"><dt>Total performance records</dt><dd>{a.total}</dd></div>
            <div className="stat"><dt>Average current performance</dt><dd>{a.averageCount ? pct(a.average) : '–'}</dd></div>
            <div className="stat"><dt>Completed tasks</dt><dd>{a.completed}</dd></div>
            <div className="stat"><dt>Pending tasks</dt><dd>{a.pending}</dd></div>
            <div className="stat"><dt>In progress tasks</dt><dd>{a.inProgress}</dd></div>
            <div className="stat">
              <dt>Records meeting or exceeding target</dt>
              <dd>
                {a.metPercent === null ? '–' : pct(a.metPercent)}{' '}
                <span className="stat-sub">{a.comparable ? `(${a.met} of ${plural(a.comparable, 'record')})` : '(no records have both values)'}</span>
              </dd>
            </div>
          </dl>

          <div className="analytics-grid">
            <section aria-labelledby="cmp-heading" className="panel">
              <h3 id="cmp-heading">Current versus target performance</h3>
              {a.comparable ? (
                <>
                  <p className="muted small">{`Averages across the ${plural(a.comparable, 'record')} that have both values.`}</p>
                  <ul className="bars">
                    <BarRow label="Average current" width={a.avgCurrent}>{pct(a.avgCurrent)}</BarRow>
                    <BarRow label="Average target" width={a.avgTarget} variant="target">{pct(a.avgTarget)}</BarRow>
                  </ul>
                </>
              ) : <p className="muted">No records have both a current and a target value.</p>}
            </section>

            <section aria-labelledby="dept-heading" className="panel">
              <h3 id="dept-heading">Average current performance by department</h3>
              <ul className="bars">
                {a.departments.map((d) => (
                  <BarRow key={d.name} label={d.name} width={d.average ?? 0}>
                    {d.average === null ? 'No valid values' : pct(d.average)} <span className="muted">({plural(d.count, 'record')})</span>
                  </BarRow>
                ))}
              </ul>
            </section>

            <section aria-labelledby="status-heading" className="panel">
              <h3 id="status-heading">Task status distribution</h3>
              <ul className="bars">
                {a.statuses.map((s) => <BarRow key={s.status} label={s.status} width={s.percent}>{`${s.count} (${pct(s.percent)})`}</BarRow>)}
              </ul>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export default memo(AnalyticsView);
