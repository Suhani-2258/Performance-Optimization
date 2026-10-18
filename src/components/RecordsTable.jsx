import { memo } from 'react';
import { buildHash } from '../lib/hashRoute';
import { formatDelta, targetDelta } from '../lib/records';

const COLUMNS = [
  { key: 'name', label: 'Task' },
  { key: 'department', label: 'Department' },
  { key: 'current', label: 'Current' },
  { key: 'target', label: 'Target' },
  { key: 'delta', label: 'Difference' },
  { key: 'status', label: 'Status' },
];
const ICON = { Completed: '✔', 'In Progress': '◐', Pending: '○' };
const text = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const pct = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? `${v}%` : '—');

// status: 'loading' | 'error' | 'ready'. `filtered` is true when a search/filter is active.
// Difference in percentage points plus a text indicator (never color alone).
function Difference({ record }) {
  const d = targetDelta(record);
  if (!d) return <span className="target-badge target-badge--na">Not available</span>;
  return (
    <>
      <span className="delta">{formatDelta(d.delta)}</span>{' '}
      <span className={`target-badge target-badge--${d.met ? 'met' : 'below'}`}>
        <span aria-hidden="true">{d.met ? '✔' : '⚠'}</span> {d.met ? 'Target met' : 'Below target'}
      </span>
    </>
  );
}

function RecordsTable({ rows, sort, onSort, status, filtered, onEdit, onDelete }) {
  return (
    <div role="region" aria-label="Performance records table" tabIndex={0} className="table-scroll" aria-busy={status === 'loading'}>
      {status === 'loading' ? (
        <div className="empty" aria-hidden="true"><span className="spinner" /> Loading records…</div>
      ) : status === 'error' ? (
        <div className="empty"><p className="muted">Records are unavailable until the request succeeds.</p></div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No data found</p>
          <p className="muted">{filtered ? 'Try a different search term or clear the filters.' : 'Add a record to get started.'}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button type="button" className="sort" onClick={() => onSort(c.key)} aria-label={`Sort by ${c.label}`}>
                    {c.label}
                    <span aria-hidden="true">{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
                  </button>
                </th>
              ))}
              <th scope="col">Notes</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? `row-${i}`}>
                <th scope="row">{text(r.name)}</th>
                <td>{text(r.department)}</td>
                <td>{pct(r.current)}</td>
                <td>{pct(r.target)}</td>
                <td><Difference record={r} /></td>
                <td><span className="pill"><span aria-hidden="true">{ICON[r.status] ?? '○'}</span> {text(r.status)}</span></td>
                <td className="notes">{text(r.notes)}</td>
                <td className="row-actions">
                  <a className="btn btn--secondary btn--small" href={buildHash('edit-record', { id: r.id })} aria-label={`Edit ${text(r.name)}`} onClick={(e) => onEdit(e, r)}>Edit</a>
                  <button type="button" className="btn btn--secondary btn--small" aria-label={`Delete ${text(r.name)}`} onClick={(e) => onDelete(r, e.currentTarget)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default memo(RecordsTable);
