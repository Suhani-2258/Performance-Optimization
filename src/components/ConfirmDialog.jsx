import { useEffect, useRef } from 'react';

// Accessible modal confirmation: focus starts on Cancel (the safe choice), Tab is trapped inside,
// Escape cancels, and the caller restores focus when it closes.
export default function ConfirmDialog({ title, message, confirmLabel, busyLabel, busy, error, onConfirm, onCancel }) {
  const box = useRef(null);
  const cancel = useRef(null);
  useEffect(() => { cancel.current?.focus(); }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...box.current.querySelectorAll('button:not([disabled])')];
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div ref={box} role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-desc" className="dialog" onKeyDown={onKeyDown}>
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-desc">{message}</p>
        {error && <p role="alert" className="error"><span aria-hidden="true">⚠ </span>{error}</p>}
        <div className="dialog-actions">
          <button ref={cancel} type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
