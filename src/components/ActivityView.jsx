import { memo } from 'react';

const LABEL = { created: 'Created', updated: 'Updated', deleted: 'Deleted' };
const ICON = { created: '＋', updated: '✎', deleted: '✕' };
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(); };

function ActivityView({ entries }) {
  return (
    <section aria-labelledby="activity-heading" id="view-activity" className="panel">
      <h2 id="activity-heading" tabIndex={-1}>Recent activity</h2>
      <p className="muted">
        Browser-local demo activity history. It is stored only in this browser and is not shared with other employees or devices;
        it is not a secure, centralized or multi-user audit log.
      </p>
      {entries.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No data found</p>
          <p className="muted">Creating, editing or deleting a record will add an entry here.</p>
        </div>
      ) : (
        <ol className="activity" aria-label="Activity entries">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="pill"><span aria-hidden="true">{ICON[e.type]}</span> {LABEL[e.type]}</span>
              <span className="activity-name">{e.recordName || `Record ${e.recordId}`}</span>
              <time dateTime={e.at}>{when(e.at)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default memo(ActivityView);
