import { memo, useState } from 'react';
import { DEPARTMENTS, EMPTY_DRAFT, STATUSES, validateRecord } from '../lib/records';

const ORDER = ['name', 'department', 'current', 'target', 'status', 'notes'];

function Field({ id, label, error, optional, children }) {
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label htmlFor={id}>{label}{optional ? ' (optional)' : ''}</label>
      {children}
      {error && <p className="error" id={`${id}-error`}><span aria-hidden="true">⚠ </span>{error}</p>}
    </div>
  );
}

function RecordForm({ mode = 'add', draft: values, onDraftChange, onSubmit, onInvalid, onCancel, saving, submitError }) {
  const editing = mode === 'edit';
  const [errors, setErrors] = useState({});

  const props = (key) => ({
    id: `f-${key}`,
    name: key,
    value: values[key],
    'aria-invalid': errors[key] ? 'true' : undefined,
    'aria-describedby': errors[key] ? `f-${key}-error` : undefined,
    onChange: (e) => {
      const { value } = e.target;
      onDraftChange((v) => ({ ...v, [key]: value }));
      setErrors((er) => { if (!er[key]) return er; const next = { ...er }; delete next[key]; return next; });
    },
  });

  const submit = async (e) => {
    e?.preventDefault();
    if (saving) return;
    const found = validateRecord(values);
    setErrors(found);
    const first = ORDER.find((k) => found[k]);
    if (first) { onInvalid(); document.getElementById(`f-${first}`)?.focus(); return; }
    if (await onSubmit(values)) { onDraftChange(EMPTY_DRAFT); setErrors({}); }
  };

  return (
    <section aria-labelledby={editing ? 'edit-heading' : 'add-heading'} id={editing ? 'view-edit-record' : 'view-add-record'} className="panel">
      <h2 id={editing ? 'edit-heading' : 'add-heading'} tabIndex={-1}>{editing ? 'Edit performance record' : 'Add a performance record'}</h2>
      <form onSubmit={submit} noValidate>
        <Field id="f-name" label="Task or process name" error={errors.name}>
          <input type="text" autoComplete="off" required {...props('name')} />
        </Field>
        <Field id="f-department" label="Department" error={errors.department}>
          <select required {...props('department')}>
            <option value="">Select a department</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <div className="row">
          <Field id="f-current" label="Current performance (%)" error={errors.current}>
            <input type="text" inputMode="decimal" autoComplete="off" required {...props('current')} />
          </Field>
          <Field id="f-target" label="Target performance (%)" error={errors.target}>
            <input type="text" inputMode="decimal" autoComplete="off" required {...props('target')} />
          </Field>
        </div>
        <Field id="f-status" label="Status" error={errors.status}>
          <select required {...props('status')}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field id="f-notes" label="Notes" optional error={errors.notes}>
          <textarea rows={3} {...props('notes')} />
        </Field>
        {submitError && (
          <div role="alert" className="alert">
            <p><span aria-hidden="true">⚠ </span>{submitError.message}</p>
            {submitError.retryable && <button type="button" className="btn btn--secondary" onClick={() => submit()} disabled={saving}>Retry</button>}
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add record'}</button>
          {editing && <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={saving}>Cancel</button>}
        </div>
      </form>
    </section>
  );
}

export default memo(RecordForm);
