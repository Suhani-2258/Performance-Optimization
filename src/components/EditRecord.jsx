import { useCallback, useState } from 'react';
import RecordForm from './RecordForm';
import { recordToDraft } from '../lib/records';

// Owns the edit draft; mount it with key={record.id} so each record starts from its own values.
export default function EditRecord({ record, onSave, onCancel, onInvalid, saving, submitError }) {
  const [draft, setDraft] = useState(() => recordToDraft(record));
  const submit = useCallback((values) => onSave(record.id, values), [onSave, record.id]);
  return (
    <RecordForm mode="edit" draft={draft} onDraftChange={setDraft} onSubmit={submit} onInvalid={onInvalid} onCancel={onCancel} saving={saving} submitError={submitError} />
  );
}
