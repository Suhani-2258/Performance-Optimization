import { describe, it, expect } from 'vitest';
import { computeAnalytics } from './analytics';
import { computeSummary } from './records';

const data = [
  { id: 'a', name: 'A', department: 'Engineering', current: 60, target: 90, status: 'In Progress' },
  { id: 'b', name: 'B', department: 'Editorial', current: 80, target: 95, status: 'Completed' },
  { id: 'c', name: 'C', department: 'Revenue', current: 40, target: 70, status: 'Pending' },
  { id: 'd', name: 'D', department: 'Engineering', current: 95, target: 90, status: 'Completed' },
  { id: 'e', name: 'E', department: 'Revenue', current: 70, target: 70, status: 'Pending' },
  { id: 'f', name: 'F', department: 'Engineering', current: 50, target: 80, status: 'In Progress' },
];

describe('computeAnalytics', () => {
  const a = computeAnalytics(data);
  it('computes headline counts from the records', () => {
    expect(a).toMatchObject({ total: 6, average: 66, averageCount: 6, completed: 2, pending: 2, inProgress: 2 });
  });
  it('counts records meeting or exceeding target (exactly equal counts as met)', () => {
    expect(a).toMatchObject({ comparable: 6, met: 2, metPercent: 33 });
  });
  it('computes current-versus-target averages over records that have both values', () => {
    expect(a.avgCurrent).toBe(65.8);
    expect(a.avgTarget).toBe(82.5);
  });
  it('computes department averages, sorted by name', () => {
    expect(a.departments).toEqual([
      { name: 'Editorial', count: 1, average: 80 },
      { name: 'Engineering', count: 3, average: 68.3 },
      { name: 'Revenue', count: 2, average: 55 },
    ]);
  });
  it('computes the status distribution in a fixed order with percentages of the total', () => {
    expect(a.statuses).toEqual([
      { status: 'Pending', count: 2, percent: 33 },
      { status: 'In Progress', count: 2, percent: 33 },
      { status: 'Completed', count: 2, percent: 33 },
    ]);
  });
  it('agrees with computeSummary for shared metrics', () => {
    const s = computeSummary(data);
    expect(a).toMatchObject({ total: s.total, average: s.average, completed: s.completed, pending: s.pending });
  });
  it('recalculates when the data changes (nothing hardcoded)', () => {
    const b = computeAnalytics(data.slice(0, 3));
    expect(b).toMatchObject({ total: 3, average: 60, completed: 1, pending: 1, inProgress: 1, met: 0, metPercent: 0 });
    expect(b.departments.map((d) => d.name)).toEqual(['Editorial', 'Engineering', 'Revenue']);
  });
  it.each([[[]], [null], [undefined], ['x'], [{}]])('is safe for %j (zero denominators give null, never NaN)', (input) => {
    const e = computeAnalytics(input);
    expect(e).toMatchObject({ total: 0, average: 0, averageCount: 0, completed: 0, pending: 0, inProgress: 0, comparable: 0, met: 0, metPercent: null, avgCurrent: null, avgTarget: null, departments: [] });
    expect(e.statuses.every((s) => s.count === 0 && s.percent === 0)).toBe(true);
  });
  it('ignores invalid numbers and malformed records without NaN', () => {
    const e = computeAnalytics([null, 'x', [], { id: 'z' }, { current: 'abc', target: 50, department: 'Revenue', status: 'Pending' }, { current: 150, target: 50 }, { id: 'ok', current: 50, target: 40, department: 'Revenue', status: 'Completed' }]);
    expect(e.total).toBe(4);
    expect(e.comparable).toBe(1);
    expect(e).toMatchObject({ met: 1, metPercent: 100, avgCurrent: 50, avgTarget: 40 });
    expect(JSON.stringify(e)).not.toMatch(/NaN|Infinity/);
  });
  it('groups records without a department as Unspecified and gives a null average when no value is valid', () => {
    const e = computeAnalytics([{ id: '1', current: 'x', status: 'Pending' }, { id: '2', department: 'Revenue', current: 'y', status: 'Pending' }]);
    expect(e.departments).toEqual([{ name: 'Revenue', count: 1, average: null }, { name: 'Unspecified', count: 1, average: null }]);
  });
  it('does not count unknown statuses in the distribution', () => {
    const e = computeAnalytics([{ id: '1', status: 'Weird' }, { id: '2', status: 'Pending' }]);
    expect(e.total).toBe(2);
    expect(e.statuses.reduce((n, s) => n + s.count, 0)).toBe(1);
  });
});
