export default function RangeInput({ id, label, value, error, onChange }) {
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={onChange}
        aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <p className="error" id={`${id}-error`}><span aria-hidden="true">⚠ </span>{error}</p>}
    </div>
  );
}
