import { normalizeRecord, sanitizeRecords, validateRecord } from './records';

// LOCAL DEMO-DATA ADAPTER. There is no backend: records live in this browser's
// localStorage (or in memory if storage is unavailable). Nothing is shared
// between employees or devices.
const KEY = 'news-blog:perf-records:v1';

export const SEED = [
  { id: 'seed-1', name: 'Homepage load time (LCP)', department: 'Engineering', current: 62, target: 90, status: 'In Progress', notes: 'CDN edge caching rollout under way.' },
  { id: 'seed-2', name: 'Editor autosave latency', department: 'Editorial', current: 88, target: 95, status: 'Completed', notes: 'Debounce tuned; verified with editors.' },
  { id: 'seed-3', name: 'Ad refresh viewability', department: 'Revenue', current: 41, target: 70, status: 'Pending', notes: '' },
  { id: 'seed-4', name: 'Image pipeline throughput', department: 'Operations', current: 74, target: 85, status: 'In Progress', notes: 'Batch resize moved to nightly queue.' },
  { id: 'seed-5', name: 'Newsletter send time', department: 'Product', current: 93, target: 90, status: 'Completed', notes: '' },
  { id: 'seed-6', name: 'Search index freshness', department: 'Engineering', current: 55, target: 80, status: 'Pending', notes: 'Waiting on reindex window.' },
];

const notFound = () => Object.assign(new Error('Record not found'), { name: 'NotFoundError' });
const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(t); reject(abortError()); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function defaultStorage() {
  try { return window.localStorage ?? null; } catch { return null; }
}

export function createDemoAdapter({ storage = defaultStorage(), latency = 400 } = {}) {
  let memory = null;
  let persistent = Boolean(storage);

  const persist = () => {
    if (!storage) return;
    try { storage.setItem(KEY, JSON.stringify(memory)); } catch { persistent = false; }
  };

  const load = () => {
    if (memory) return memory;
    let raw = null;
    if (storage) {
      try { raw = storage.getItem(KEY); } catch { persistent = false; }
    }
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    memory = Array.isArray(parsed) ? sanitizeRecords(parsed) : SEED.map((r) => ({ ...r }));
    if (!Array.isArray(parsed)) persist();
    return memory;
  };

  return {
    get persistent() { return persistent; },
    async list({ signal } = {}) {
      await delay(latency, signal);
      return load().map((r) => ({ ...r }));
    },
    async add(record, { signal } = {}) {
      await delay(latency, signal);
      if (Object.keys(validateRecord(record)).length > 0) throw new Error('Invalid record');
      const id = globalThis.crypto?.randomUUID?.() ?? `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const saved = { ...normalizeRecord(record), id };
      load().push(saved);
      persist();
      return { ...saved };
    },
    async update(id, record, { signal } = {}) {
      await delay(latency, signal);
      if (Object.keys(validateRecord(record)).length > 0) throw new Error('Invalid record');
      const rows = load();
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw notFound();
      const saved = { ...normalizeRecord(record), id: rows[i].id };
      rows[i] = saved;
      persist();
      return { ...saved };
    },
    async remove(id, { signal } = {}) {
      await delay(latency, signal);
      const rows = load();
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw notFound();
      rows.splice(i, 1);
      persist();
      return { id };
    },
  };
}
