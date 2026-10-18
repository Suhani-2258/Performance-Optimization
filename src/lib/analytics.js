import { STATUSES, averageSource, cleanRecords, computeSummary, targetDelta } from './records';

const round1 = (n) => Math.round(n * 10) / 10;
const mean = (nums) => (nums.length ? round1(nums.reduce((a, b) => a + b, 0) / nums.length) : null);
const deptName = (r) => (typeof r.department === 'string' && r.department.trim() ? r.department.trim() : 'Unspecified');

// Every value is derived from the records passed in. Denominators of zero give null, never NaN.
export function computeAnalytics(records) {
  const list = cleanRecords(records);
  const summary = computeSummary(list);
  const deltas = list.map(targetDelta).filter(Boolean);
  const met = deltas.filter((d) => d.met).length;

  const groups = new Map();
  for (const r of list) {
    const name = deptName(r);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(r);
  }
  const departments = [...groups.entries()]
    .map(([name, rs]) => ({ name, count: rs.length, average: mean(averageSource(rs).map((r) => Number(r.current))) }))
    .sort((a, b) => (a.name === 'Unspecified') - (b.name === 'Unspecified') || a.name.localeCompare(b.name));

  const count = (status) => list.filter((r) => r.status === status).length;
  return {
    total: summary.total,
    average: summary.average,
    averageCount: averageSource(list).length,
    completed: summary.completed,
    pending: summary.pending,
    inProgress: count('In Progress'),
    comparable: deltas.length,
    met,
    metPercent: deltas.length ? Math.round((met / deltas.length) * 100) : null,
    avgCurrent: mean(deltas.map((d) => d.current)),
    avgTarget: mean(deltas.map((d) => d.target)),
    departments,
    statuses: STATUSES.map((status) => ({ status, count: count(status), percent: summary.total ? Math.round((count(status) / summary.total) * 100) : 0 })),
  };
}
