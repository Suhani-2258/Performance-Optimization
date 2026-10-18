import { describe, it, expect } from 'vitest';
import { createDemoAdapter } from './demoAdapter';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const throwing = () => ({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } });
const rec = { name: 'T', department: 'Engineering', current: 1, target: 2, status: 'Pending', notes: '' };

describe('demo adapter', () => {
  it('seeds demo data and persists additions', async () => {
    const storage = memoryStorage();
    const a = createDemoAdapter({ storage, latency: 0 });
    const seeded = await a.list();
    expect(seeded.length).toBeGreaterThan(3);
    const saved = await a.add(rec);
    expect(saved.id).toBeTruthy();
    const b = createDemoAdapter({ storage, latency: 0 });
    expect((await b.list()).some((r) => r.id === saved.id)).toBe(true);
  });
  it('works in memory when localStorage throws', async () => {
    const a = createDemoAdapter({ storage: throwing(), latency: 0 });
    expect((await a.list()).length).toBeGreaterThan(0);
    const saved = await a.add(rec);
    expect((await a.list()).some((r) => r.id === saved.id)).toBe(true);
    expect(a.persistent).toBe(false);
  });
  it('recovers from corrupt stored JSON', async () => {
    const storage = memoryStorage();
    storage.setItem('news-blog:perf-records:v1', '{not json');
    const a = createDemoAdapter({ storage, latency: 0 });
    expect((await a.list()).length).toBeGreaterThan(0);
  });
  it('rejects when aborted', async () => {
    const a = createDemoAdapter({ storage: memoryStorage(), latency: 50 });
    const c = new AbortController();
    const p = a.list({ signal: c.signal });
    c.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('drops malformed stored records instead of rendering them', async () => {
    const storage = memoryStorage();
    const good = { id: 'ok', name: 'Kept', department: 'Engineering', current: 10, target: 20, status: 'Pending', notes: '' };
    storage.setItem('news-blog:perf-records:v1', JSON.stringify([null, 'x', 7, { name: 1 }, { ...good, department: 'Nope' }, good]));
    const list = await createDemoAdapter({ storage, latency: 0 }).list();
    expect(list).toEqual([good]);
  });
  it('falls back to demo data when stored JSON is not an array', async () => {
    const storage = memoryStorage();
    storage.setItem('news-blog:perf-records:v1', JSON.stringify({ hacked: true }));
    expect((await createDemoAdapter({ storage, latency: 0 }).list()).length).toBeGreaterThan(3);
  });
  it('refuses to save invalid records', async () => {
    const a = createDemoAdapter({ storage: memoryStorage(), latency: 0 });
    for (const bad of [{ ...rec, department: 'Nope' }, { ...rec, current: 500 }, { ...rec, name: '' }, null, undefined]) {
      await expect(a.add(bad)).rejects.toThrow(/invalid/i);
    }
    expect((await a.list()).length).toBe(6);
  });
});

describe('demo adapter: update and remove', () => {
  const valid = { name: 'Changed', department: 'Editorial', current: 70, target: 80, status: 'Completed', notes: ' hi ' };
  it('updates a record in place, preserving its id, and persists it', async () => {
    const storage = memoryStorage();
    const a = createDemoAdapter({ storage, latency: 0 });
    const before = await a.list();
    const saved = await a.update('seed-2', { ...valid, id: 'hacked' });
    expect(saved).toMatchObject({ id: 'seed-2', name: 'Changed', notes: 'hi', current: 70 });
    const after = await createDemoAdapter({ storage, latency: 0 }).list();
    expect(after).toHaveLength(before.length);
    expect(after.find((r) => r.id === 'seed-2').name).toBe('Changed');
    expect(after.some((r) => r.id === 'hacked')).toBe(false);
  });
  it('refuses invalid updates and unknown ids without changing data', async () => {
    const a = createDemoAdapter({ storage: memoryStorage(), latency: 0 });
    await expect(a.update('seed-2', { ...valid, department: 'Nope' })).rejects.toThrow(/invalid/i);
    await expect(a.update('seed-2', { ...valid, current: 500 })).rejects.toThrow(/invalid/i);
    await expect(a.update('missing', valid)).rejects.toMatchObject({ name: 'NotFoundError' });
    expect((await a.list()).find((r) => r.id === 'seed-2').name).not.toBe('Changed');
  });
  it('removes a record and persists the removal', async () => {
    const storage = memoryStorage();
    const a = createDemoAdapter({ storage, latency: 0 });
    const n = (await a.list()).length;
    expect(await a.remove('seed-3')).toEqual({ id: 'seed-3' });
    const after = await createDemoAdapter({ storage, latency: 0 }).list();
    expect(after).toHaveLength(n - 1);
    expect(after.some((r) => r.id === 'seed-3')).toBe(false);
    await expect(a.remove('seed-3')).rejects.toMatchObject({ name: 'NotFoundError' });
  });
  it('works in memory when storage throws, and honours abort', async () => {
    const a = createDemoAdapter({ storage: throwing(), latency: 0 });
    await a.update('seed-1', valid);
    await a.remove('seed-2');
    const list = await a.list();
    expect(list.find((r) => r.id === 'seed-1').name).toBe('Changed');
    expect(list.some((r) => r.id === 'seed-2')).toBe(false);
    const c = new AbortController();
    const slow = createDemoAdapter({ storage: memoryStorage(), latency: 50 });
    const p = slow.remove('seed-1', { signal: c.signal });
    c.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
