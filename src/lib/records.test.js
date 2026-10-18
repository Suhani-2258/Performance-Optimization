import { describe, it, expect } from 'vitest';
import { computeSummary, filterRecords, sortRecords, validateRecord, normalizeRecord, sanitizeRecord, sanitizeRecords, targetDelta, formatDelta, parseRange, paginate, recordToDraft } from './records';

const rows = [
  { id: '1', name: 'Page load', department: 'Engineering', current: 60, target: 90, status: 'In Progress', notes: '' },
  { id: '2', name: 'Autosave', department: 'Editorial', current: 80, target: 95, status: 'Completed', notes: 'done' },
  { id: '3', name: 'Ad refresh', department: 'Revenue', current: 40, target: 70, status: 'Pending', notes: '' },
];

describe('computeSummary', () => {
  it('computes totals and averages', () => {
    // One Completed, one In Progress, one Pending: In Progress counts as neither.
    expect(computeSummary(rows)).toEqual({ total: 3, average: 60, completed: 1, pending: 1 });
  });
  it('never counts In Progress as Pending or Completed', () => {
    const inProgress = [{ id: 'a', current: 10, status: 'In Progress' }, { id: 'b', current: 20, status: 'In Progress' }];
    expect(computeSummary(inProgress)).toMatchObject({ total: 2, completed: 0, pending: 0 });
  });
  it('counts only exact status values', () => {
    const odd = [{ status: 'pending' }, { status: 'Done' }, { status: 42 }, { status: null }, {}];
    expect(computeSummary(odd)).toMatchObject({ total: 5, completed: 0, pending: 0 });
  });
  it('handles a larger mixed dataset', () => {
    const data = [
      ...Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, current: 90, status: 'Completed' })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `p${i}`, current: 30, status: 'Pending' })),
      { id: 'i', current: 60, status: 'In Progress' },
    ];
    expect(computeSummary(data)).toEqual({ total: 6, average: 65, completed: 3, pending: 2 });
  });
  it.each([[null], [undefined], [[]]])('is safe for %s', (input) => {
    expect(computeSummary(input)).toEqual({ total: 0, average: 0, completed: 0, pending: 0 });
  });
  it('averages only valid 0-100 numbers (blank, whitespace, boolean, out-of-range, Infinity are ignored)', () => {
    const bad = [150, -10, 'abc', null, undefined, '', '   ', true, Infinity, NaN, [], {}].map((current, i) => ({ id: `b${i}`, current, status: 'Pending' }));
    const s = computeSummary([...bad, { id: 'ok', current: '50', status: 'Pending' }, { id: 'ok2', current: 70, status: 'Pending' }]);
    expect(s.average).toBe(60);
    expect(s.total).toBe(14);
  });
  it('average is 0 when no value is valid', () => {
    expect(computeSummary([{ current: 'x' }, { current: 101 }]).average).toBe(0);
  });
  it('treats only plain objects as records (not arrays, strings, numbers, booleans)', () => {
    expect(computeSummary([[1, 2], 'str', 5, true, null, undefined, { id: 'ok', current: 10, status: 'Pending' }])).toMatchObject({ total: 1, pending: 1 });
  });
  it('is safe for non-array input', () => {
    for (const bad of [{}, 'text', 7, true]) expect(computeSummary(bad)).toEqual({ total: 0, average: 0, completed: 0, pending: 0 });
  });
  it('ignores invalid numbers and null rows', () => {
    const s = computeSummary([null, { id: 'x', current: 'abc', status: 'Pending' }, { id: 'y', current: 50, status: 'Completed' }]);
    expect(s.total).toBe(2);
    expect(s.average).toBe(50);
  });
});

describe('filterRecords', () => {
  it('searches name, department and notes case-insensitively', () => {
    expect(filterRecords(rows, { query: 'EDITORIAL' }).map((r) => r.id)).toEqual(['2']);
    expect(filterRecords(rows, { query: 'done' }).map((r) => r.id)).toEqual(['2']);
  });
  it('filters by status', () => {
    expect(filterRecords(rows, { status: 'Pending' }).map((r) => r.id)).toEqual(['3']);
  });
  it('handles missing input', () => {
    expect(filterRecords(null, {})).toEqual([]);
  });
});

describe('sortRecords', () => {
  it('sorts numerically and does not mutate', () => {
    const copy = [...rows];
    expect(sortRecords(rows, 'current', 'asc').map((r) => r.id)).toEqual(['3', '1', '2']);
    expect(sortRecords(rows, 'current', 'desc').map((r) => r.id)).toEqual(['2', '1', '3']);
    expect(rows).toEqual(copy);
  });
  it('sorts text', () => {
    expect(sortRecords(rows, 'name', 'asc').map((r) => r.id)).toEqual(['3', '2', '1']);
  });
});

describe('validateRecord', () => {
  const ok = { name: 'Task', department: 'Engineering', current: '50', target: '80', status: 'Pending', notes: '' };
  it('accepts valid input', () => expect(validateRecord(ok)).toEqual({}));
  it('requires fields', () => {
    const e = validateRecord({ name: '  ', department: '', current: '', target: '', status: '' });
    expect(Object.keys(e).sort()).toEqual(['current', 'department', 'name', 'status', 'target']);
  });
  it('rejects malformed and out-of-range numbers', () => {
    expect(validateRecord({ ...ok, current: 'abc' }).current).toBeTruthy();
    expect(validateRecord({ ...ok, current: '-1' }).current).toBeTruthy();
    expect(validateRecord({ ...ok, target: '101' }).target).toBeTruthy();
    expect(validateRecord({ ...ok, target: 'Infinity' }).target).toBeTruthy();
  });
  it('limits notes length', () => {
    expect(validateRecord({ ...ok, notes: 'x'.repeat(301) }).notes).toBeTruthy();
  });
});

describe('normalizeRecord', () => {
  it('trims, collapses whitespace and converts numbers', () => {
    expect(normalizeRecord({ name: '  Page   load ', department: ' Engineering', current: '55.5', target: '80', status: 'Pending', notes: ' hi ' }))
      .toMatchObject({ name: 'Page load', department: 'Engineering', current: 55.5, target: 80, notes: 'hi' });
  });
});

describe('department and status enforcement', () => {
  const ok = { name: 'Task', department: 'Engineering', current: '50', target: '80', status: 'Pending', notes: '' };
  it('rejects departments outside the allowed list', () => {
    expect(validateRecord({ ...ok, department: 'Hacking' }).department).toBeTruthy();
    expect(validateRecord({ ...ok, department: '<b>x</b>' }).department).toBeTruthy();
  });
  it('rejects statuses outside the allowed list', () => {
    expect(validateRecord({ ...ok, status: 'Done' }).status).toBeTruthy();
  });
  it('tolerates null/undefined input without throwing', () => {
    expect(Object.keys(validateRecord(undefined))).toContain('name');
    expect(Object.keys(validateRecord(null))).toContain('name');
  });
});

describe('sanitizeRecord(s)', () => {
  const good = { id: 'g1', name: 'Page load', department: 'Engineering', current: 60, target: 90, status: 'Pending', notes: 'n' };
  it('keeps valid records and coerces numeric strings', () => {
    expect(sanitizeRecord({ ...good, current: '60.5' })).toEqual({ ...good, current: 60.5 });
  });
  it.each([
    [null], [undefined], ['str'], [5], [[]],
    [{ ...good, id: undefined }], [{ ...good, name: '   ' }], [{ ...good, name: 42 }],
    [{ ...good, department: 'Hacking' }], [{ ...good, status: 'Done' }],
    [{ ...good, current: 150 }], [{ ...good, target: 'abc' }], [{ ...good, current: true }],
  ])('rejects malformed record %j', (bad) => expect(sanitizeRecord(bad)).toBeNull());
  it('sanitizeRecords drops invalid entries and tolerates non-arrays', () => {
    expect(sanitizeRecords([good, null, { x: 1 }])).toEqual([good]);
    expect(sanitizeRecords('nope')).toEqual([]);
    expect(sanitizeRecords(undefined)).toEqual([]);
  });
});

describe('targetDelta (percentage points, current minus target)', () => {
  it('reports negative, zero and positive differences with met/not-met', () => {
    expect(targetDelta({ current: 60, target: 90 })).toEqual({ current: 60, target: 90, delta: -30, met: false });
    expect(targetDelta({ current: 90, target: 90 })).toMatchObject({ delta: 0, met: true });
    expect(targetDelta({ current: 95, target: 90 })).toMatchObject({ delta: 5, met: true });
  });
  it('is a difference in points, not a relative change', () => {
    expect(targetDelta({ current: 50, target: 40 }).delta).toBe(10); // relative change would be 25%
  });
  it('avoids floating-point noise', () => {
    expect(targetDelta({ current: 60.3, target: 60 }).delta).toBe(0.3);
    expect(targetDelta({ current: 55.5, target: 50.25 }).delta).toBe(5.25);
  });
  it.each([[null], [undefined], ['x'], [[]], [{}], [{ current: 50 }], [{ target: 50 }], [{ current: 'abc', target: 50 }], [{ current: 150, target: 50 }], [{ current: true, target: 50 }], [{ current: '', target: 50 }]])(
    'returns null for unusable input %j', (input) => expect(targetDelta(input)).toBeNull());
  it('accepts numeric strings', () => expect(targetDelta({ current: '70', target: '80' }).delta).toBe(-10));
});

describe('formatDelta', () => {
  it.each([[5, '+5 pp'], [-10, '-10 pp'], [0, '0 pp'], [-0, '0 pp'], [5.25, '+5.25 pp'], [-0.3, '-0.3 pp']])('%s -> %s', (n, out) => expect(formatDelta(n)).toBe(out));
});

describe('advanced filtering', () => {
  const data = [
    { id: '1', name: 'A', department: 'Engineering', current: 20, target: 60, status: 'Pending', notes: 'alpha' },
    { id: '2', name: 'B', department: 'Editorial', current: 50, target: 70, status: 'Completed', notes: '' },
    { id: '3', name: 'C', department: 'Engineering', current: 80, target: 90, status: 'Completed', notes: 'beta' },
    { id: '4', name: 'D', department: 'Revenue', current: 'abc', target: 95, status: 'Pending', notes: '' },
  ];
  const ids = (o) => filterRecords(data, o).map((r) => r.id);
  it('filters by department (exact)', () => expect(ids({ department: 'Engineering' })).toEqual(['1', '3']));
  it('ignores an empty or "All" department', () => { expect(ids({ department: '' })).toHaveLength(4); expect(ids({ department: 'All' })).toHaveLength(4); });
  it('filters by inclusive current range and excludes invalid current values when a bound is set', () => {
    expect(ids({ currentMin: 50, currentMax: 80 })).toEqual(['2', '3']);
    expect(ids({ currentMin: 50 })).toEqual(['2', '3']);
    expect(ids({ currentMax: 20 })).toEqual(['1']);
  });
  it('filters by inclusive target range', () => expect(ids({ targetMin: 70, targetMax: 90 })).toEqual(['2', '3']));
  it('combines search, status, department and ranges', () => {
    expect(ids({ query: 'beta', status: 'Completed', department: 'Engineering', currentMin: 60, targetMax: 90 })).toEqual(['3']);
    expect(ids({ query: 'beta', department: 'Editorial' })).toEqual([]);
  });
  it('treats null/undefined/NaN bounds as unset', () => expect(ids({ currentMin: null, currentMax: undefined, targetMin: NaN })).toHaveLength(4));
});

describe('sorting by difference to target', () => {
  const data = [
    { id: 'a', current: 60, target: 90 }, { id: 'b', current: 95, target: 90 }, { id: 'c', current: 'x', target: 50 }, { id: 'd', current: 70, target: 70 },
  ];
  it('sorts ascending and descending, with unusable values last', () => {
    expect(sortRecords(data, 'delta', 'asc').map((r) => r.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(sortRecords(data, 'delta', 'desc').map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('parseRange', () => {
  it('returns no bounds and no errors for blank input', () => expect(parseRange('', '')).toEqual({ min: null, max: null, errors: {} }));
  it('parses and trims valid bounds', () => {
    expect(parseRange(' 20 ', '80.5')).toEqual({ min: 20, max: 80.5, errors: {} });
    expect(parseRange('0', '100')).toMatchObject({ min: 0, max: 100 });
  });
  it.each([['abc', ''], ['-1', ''], ['', '101'], ['1e2', ''], ['Infinity', ''], ['5%', '']])('flags malformed bound (%j, %j)', (a, b) => {
    const r = parseRange(a, b);
    expect(Object.keys(r.errors).length).toBe(1);
    expect(r.errors.min ?? r.errors.max).toMatch(/0 and 100/);
  });
  it('flags min greater than max and ignores both bounds', () => {
    expect(parseRange('50', '40')).toEqual({ min: null, max: null, errors: { max: expect.stringMatching(/greater than or equal/i) } });
  });
  it('ignores only the malformed bound when the other is valid', () => {
    expect(parseRange('abc', '40')).toMatchObject({ min: null, max: 40, errors: { min: expect.any(String) } });
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);
  it('slices pages and reports ranges', () => {
    expect(paginate(items, 1, 10)).toMatchObject({ page: 1, totalPages: 3, start: 1, end: 10, total: 23, items: items.slice(0, 10) });
    expect(paginate(items, 3, 10)).toMatchObject({ page: 3, start: 21, end: 23, items: [21, 22, 23] });
  });
  it('clamps out-of-range and invalid pages', () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    for (const p of [0, -4, NaN, undefined, 'x']) expect(paginate(items, p, 10).page).toBe(1);
  });
  it('falls back to a default page size and supports 5 and 20', () => {
    expect(paginate(items, 1, 7).items).toHaveLength(10);
    expect(paginate(items, 1, 5).totalPages).toBe(5);
    expect(paginate(items, 1, 20).totalPages).toBe(2);
  });
  it('handles empty and non-array input', () => {
    expect(paginate([], 1, 10)).toMatchObject({ items: [], total: 0, start: 0, end: 0, page: 1, totalPages: 1 });
    expect(paginate(null, 2, 10).items).toEqual([]);
  });
});

describe('recordToDraft', () => {
  it('turns a record into editable strings', () => {
    expect(recordToDraft({ id: '2', name: 'N', department: 'Editorial', current: 80, target: 95, status: 'Completed', notes: null }))
      .toEqual({ name: 'N', department: 'Editorial', current: '80', target: '95', status: 'Completed', notes: '' });
  });
});
