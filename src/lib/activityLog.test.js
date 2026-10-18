import { describe, it, expect } from 'vitest';
import { createActivityLog } from './activityLog';

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const throwing = () => ({ getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } });
const KEY = 'news-blog:perf-activity:v1';
let t = 0;
const clock = () => new Date(Date.UTC(2026, 9, 17, 10, 0, t++));

describe('activity log', () => {
  it('starts empty and records newest first with a timestamp, type, id and name', () => {
    const log = createActivityLog({ storage: memoryStorage(), now: clock });
    expect(log.list()).toEqual([]);
    log.record({ type: 'created', recordId: '1', recordName: 'First' });
    const list = log.record({ type: 'deleted', recordId: '1', recordName: 'First' });
    expect(list.map((e) => e.type)).toEqual(['deleted', 'created']);
    expect(list[0]).toEqual({ id: expect.any(String), type: 'deleted', recordId: '1', recordName: 'First', at: expect.stringMatching(/^2026-10-17T10:00:\d\dZ$/) });
    expect(new Set(list.map((e) => e.id)).size).toBe(2);
  });
  it('persists across instances sharing storage', () => {
    const storage = memoryStorage();
    createActivityLog({ storage, now: clock }).record({ type: 'updated', recordId: '2', recordName: 'Two' });
    expect(createActivityLog({ storage }).list()).toHaveLength(1);
  });
  it('keeps only the most recent entries', () => {
    const log = createActivityLog({ storage: memoryStorage(), now: clock, max: 3 });
    for (let i = 0; i < 5; i++) log.record({ type: 'created', recordId: String(i), recordName: `R${i}` });
    expect(log.list().map((e) => e.recordName)).toEqual(['R4', 'R3', 'R2']);
  });
  it('ignores invalid types, trims long names and stores nothing but the known fields', () => {
    const log = createActivityLog({ storage: memoryStorage(), now: clock });
    expect(log.record({ type: 'hacked', recordId: '1', recordName: 'x' })).toEqual([]);
    expect(log.record(null)).toEqual([]);
    const [e] = log.record({ type: 'created', recordId: '1', recordName: 'n'.repeat(200), password: 'secret', extra: 1 });
    expect(e.recordName).toHaveLength(80);
    expect(Object.keys(e).sort()).toEqual(['at', 'id', 'recordId', 'recordName', 'type']);
  });
  it('recovers from corrupted JSON, non-arrays and malformed entries', () => {
    for (const raw of ['{bad', JSON.stringify({ a: 1 }), JSON.stringify([null, 'x', { type: 'nope' }, { type: 'created', at: 'not a date', recordName: 'x' }])]) {
      const storage = memoryStorage(); storage.setItem(KEY, raw);
      expect(createActivityLog({ storage }).list()).toEqual([]);
    }
  });
  it('works in memory when storage throws', () => {
    const log = createActivityLog({ storage: throwing(), now: clock });
    expect(log.record({ type: 'created', recordId: '1', recordName: 'A' })).toHaveLength(1);
    expect(log.list()).toHaveLength(1);
    expect(log.persistent).toBe(false);
  });
});
