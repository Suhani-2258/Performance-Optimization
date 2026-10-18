import { memo } from 'react';

const CARDS = [
  { kind: 'total', label: 'Total records', hint: 'View all records', value: (s) => s.total },
  { kind: 'average', label: 'Average performance', hint: 'View the data behind this average', value: (s) => `${s.average}%` },
  { kind: 'completed', label: 'Completed tasks', hint: 'View completed records', value: (s) => s.completed },
  { kind: 'pending', label: 'Pending tasks', hint: 'View pending records', value: (s) => s.pending },
];

// status: 'loading' | 'error' | 'ready'. Cards are real buttons; their accessible name is
// their visible text (label, value, hint), so it always contains the visible label.
function SummaryCards({ summary, status, onSelect }) {
  const ready = status === 'ready';
  return (
    <section aria-labelledby="summary-heading" id="view-summary">
      <h2 id="summary-heading" tabIndex={-1}>Performance summary</h2>
      <p className="muted">Select a card to open the matching records.</p>
      <ul className="cards">
        {CARDS.map((c) => (
          <li key={c.kind}>
            <button type="button" className="card" disabled={!ready} onClick={() => onSelect(c.kind)}>
              <span className="card-label">{c.label}</span>
              <span className="card-value">{ready ? c.value(summary) : '–'}</span>
              <span className="card-hint">{ready ? c.hint : 'Unavailable'} <span aria-hidden="true">→</span></span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default memo(SummaryCards);
