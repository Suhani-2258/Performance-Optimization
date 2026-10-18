export const STATUSES = ['Pending', 'In Progress', 'Completed'];
export const DEPARTMENTS = ['Engineering', 'Editorial', 'Revenue', 'Operations', 'Product'];
export const NUMERIC_KEYS = ['current', 'target', 'delta'];
export const PAGE_SIZES = [5, 10, 20];

const isRecord = (r) => r !== null && typeof r === 'object' && !Array.isArray(r);
const clean = (records) => (Array.isArray(records) ? records.filter(isRecord) : []);
export const cleanRecords = clean;

// Returns a finite number in 0..100, or NaN. Accepts numbers and numeric strings only.
function toPercent(v) {
  let n = NaN;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && v.trim() !== '') n = Number(v.trim());
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : NaN;
}

export const EMPTY_DRAFT = { name: '', department: '', current: '', target: '', status: 'Pending', notes: '' };

// The records whose current performance is valid: exactly the ones the average is computed from.
export const averageSource = (records) => clean(records).filter((r) => Number.isFinite(toPercent(r.current)));

export function computeSummary(records) {
  const list = clean(records);
  const nums = averageSource(list).map((r) => toPercent(r.current));
  return {
    total: list.length,
    average: nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0,
    completed: list.filter((r) => r.status === 'Completed').length,
    // In Progress is deliberately counted in neither bucket.
    pending: list.filter((r) => r.status === 'Pending').length,
  };
}

const bound = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
function inRange(value, min, max) {
  if (min === null && max === null) return true;
  const v = toPercent(value);
  return Number.isFinite(v) && (min === null || v >= min) && (max === null || v <= max);
}

export function filterRecords(records, { query = '', status = '', department = '', currentMin, currentMax, targetMin, targetMax } = {}) {
  const q = String(query).trim().toLowerCase();
  const [cMin, cMax, tMin, tMax] = [currentMin, currentMax, targetMin, targetMax].map(bound);
  return clean(records).filter((r) => {
    if (status && status !== 'All' && r.status !== status) return false;
    if (department && department !== 'All' && r.department !== department) return false;
    if (!inRange(r.current, cMin, cMax) || !inRange(r.target, tMin, tMax)) return false;
    if (!q) return true;
    return [r.name, r.department, r.notes].some((f) => String(f ?? '').toLowerCase().includes(q));
  });
}

const numberFor = (r, key) => (key === 'delta' ? (targetDelta(r)?.delta ?? NaN) : toPercent(r[key]));

export function sortRecords(records, key, dir = 'asc') {
  const list = [...clean(records)];
  if (!key) return list;
  const sign = dir === 'desc' ? -1 : 1;
  const numeric = NUMERIC_KEYS.includes(key);
  return list.sort((a, b) => {
    const av = numeric ? numberFor(a, key) : String(a[key] ?? '');
    const bv = numeric ? numberFor(b, key) : String(b[key] ?? '');
    if (numeric) {
      if (Number.isNaN(av) || Number.isNaN(bv)) return Number.isNaN(av) - Number.isNaN(bv);
      return (av - bv) * sign;
    }
    return av.localeCompare(bv, undefined, { sensitivity: 'base' }) * sign;
  });
}

const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;
const RANGE_MSG = 'Enter a number between 0 and 100.';

function checkPercent(raw, label) {
  const v = String(raw ?? '').trim();
  if (!v) return `${label} is required.`;
  if (!PERCENT.test(v) || Number(v) > 100) return RANGE_MSG;
  return null;
}

export function validateRecord(input) {
  const values = isRecord(input) ? input : {};
  const errors = {};
  const name = String(values.name ?? '').trim();
  if (!name) errors.name = 'Task or process name is required.';
  else if (name.length > 80) errors.name = 'Use 80 characters or fewer.';
  const dept = String(values.department ?? '').trim();
  if (!dept) errors.department = 'Department is required.';
  else if (!DEPARTMENTS.includes(dept)) errors.department = 'Choose a department from the list.';
  const cur = checkPercent(values.current, 'Current performance');
  if (cur) errors.current = cur;
  const tgt = checkPercent(values.target, 'Target performance');
  if (tgt) errors.target = tgt;
  if (!STATUSES.includes(values.status)) errors.status = 'Status is required.';
  if (String(values.notes ?? '').length > 300) errors.notes = 'Use 300 characters or fewer.';
  return errors;
}

export function normalizeRecord(values) {
  return {
    name: String(values.name ?? '').replace(/\s+/g, ' ').trim(),
    department: String(values.department ?? '').trim(),
    current: Number(String(values.current).trim()),
    target: Number(String(values.target).trim()),
    status: values.status,
    notes: String(values.notes ?? '').trim(),
  };
}

// Validates an untrusted stored/received record. Returns a clean record or null.
export function sanitizeRecord(raw) {
  if (!isRecord(raw)) return null;
  const idOk = (typeof raw.id === 'string' && raw.id.trim() !== '') || (typeof raw.id === 'number' && Number.isFinite(raw.id));
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const current = toPercent(raw.current);
  const target = toPercent(raw.target);
  if (!idOk || !name || name.length > 80) return null;
  if (!DEPARTMENTS.includes(raw.department) || !STATUSES.includes(raw.status)) return null;
  if (Number.isNaN(current) || Number.isNaN(target)) return null;
  return {
    id: raw.id, name, department: raw.department, current, target, status: raw.status,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 300) : '',
  };
}

export function sanitizeRecords(list) {
  return Array.isArray(list) ? list.map(sanitizeRecord).filter(Boolean) : [];
}

// Difference between current and target, in percentage points (not a relative change).
export function targetDelta(record) {
  if (!isRecord(record)) return null;
  const current = toPercent(record.current);
  const target = toPercent(record.target);
  if (Number.isNaN(current) || Number.isNaN(target)) return null;
  const delta = Math.round((current - target) * 100) / 100;
  return { current, target, delta: delta === 0 ? 0 : delta, met: current >= target };
}

export const formatDelta = (delta) => `${delta > 0 ? '+' : ''}${delta === 0 ? 0 : delta} pp`;

function parseBound(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return { value: null };
  if (!PERCENT.test(v) || Number(v) > 100) return { value: null, error: RANGE_MSG };
  return { value: Number(v) };
}

// Parses a min/max pair typed by a user. Invalid or inverted bounds are reported and ignored.
export function parseRange(minRaw, maxRaw) {
  const lo = parseBound(minRaw);
  const hi = parseBound(maxRaw);
  const errors = {};
  if (lo.error) errors.min = lo.error;
  if (hi.error) errors.max = hi.error;
  let [min, max] = [lo.value, hi.value];
  if (min !== null && max !== null && min > max) {
    errors.max = 'Maximum must be greater than or equal to minimum.';
    min = null;
    max = null;
  }
  return { min, max, errors };
}

export function paginate(items, page, size) {
  const list = Array.isArray(items) ? items : [];
  const pageSize = PAGE_SIZES.includes(Number(size)) ? Number(size) : 10;
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const asked = Number.isFinite(Number(page)) ? Math.trunc(Number(page)) : 1;
  const current = Math.min(Math.max(asked, 1), totalPages);
  return {
    items: list.slice((current - 1) * pageSize, current * pageSize),
    page: current, totalPages, pageSize, total,
    start: total ? (current - 1) * pageSize + 1 : 0,
    end: Math.min(total, current * pageSize),
  };
}

export const recordToDraft = (r) => ({
  name: String(r?.name ?? ''),
  department: String(r?.department ?? ''),
  current: String(r?.current ?? ''),
  target: String(r?.target ?? ''),
  status: r?.status ?? 'Pending',
  notes: String(r?.notes ?? ''),
});
