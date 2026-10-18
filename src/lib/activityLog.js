// BROWSER-LOCAL demo activity history. Stored in this browser's localStorage (or memory if storage
// is unavailable). It is not a secure, centralized or multi-user audit log.
const KEY = 'news-blog:perf-activity:v1';
export const ACTIVITY_TYPES = ['created', 'updated', 'deleted'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const newId = () => globalThis.crypto?.randomUUID?.() ?? `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const defaultStorage = () => { try { return window.localStorage ?? null; } catch { return null; } };

function sanitizeEntry(e) {
  if (!isObj(e) || !ACTIVITY_TYPES.includes(e.type)) return null;
  if (typeof e.at !== 'string' || Number.isNaN(Date.parse(e.at))) return null;
  return {
    id: typeof e.id === 'string' && e.id ? e.id : newId(),
    type: e.type,
    recordId: String(e.recordId ?? ''),
    recordName: typeof e.recordName === 'string' ? e.recordName.slice(0, 80) : '',
    at: e.at,
  };
}

export function createActivityLog({ storage = defaultStorage(), now = () => new Date(), max = 50 } = {}) {
  let memory = null;
  let persistent = Boolean(storage);

  const load = () => {
    if (memory) return memory;
    let parsed = null;
    if (storage) {
      try { parsed = JSON.parse(storage.getItem(KEY) ?? 'null'); } catch { parsed = null; }
    }
    memory = (Array.isArray(parsed) ? parsed.map(sanitizeEntry).filter(Boolean) : []).slice(0, max);
    return memory;
  };
  const persist = () => {
    if (!storage) return;
    try { storage.setItem(KEY, JSON.stringify(memory)); } catch { persistent = false; }
  };

  return {
    get persistent() { return persistent; },
    list: () => load().map((e) => ({ ...e })),
    // Only these fields are stored: no credentials, no free-form data.
    record(input) {
      if (!isObj(input) || !ACTIVITY_TYPES.includes(input.type)) return this.list();
      const entry = {
        id: newId(),
        type: input.type,
        recordId: String(input.recordId ?? ''),
        recordName: typeof input.recordName === 'string' ? input.recordName.slice(0, 80) : '',
        at: now().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      };
      memory = [entry, ...load()].slice(0, max);
      persist();
      return this.list();
    },
  };
}
