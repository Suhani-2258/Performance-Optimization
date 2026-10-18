import { useMemo, useSyncExternalStore } from 'react';

export const ROUTES = ['summary', 'records', 'add-record', 'edit-record', 'analytics', 'activity'];
const KNOWN_PARAMS = ['status', 'focus', 'id'];

export function parseHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  if (!ROUTES.includes(path)) return { route: 'summary', params: {} };
  const params = {};
  for (const [k, v] of new URLSearchParams(query)) if (KNOWN_PARAMS.includes(k)) params[k] = v;
  return { route: path, params };
}

export function buildHash(route, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return `#${route}${qs ? `?${qs}` : ''}`;
}

// pushState/replaceState do not fire events, so navigate() notifies subscribers itself.
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
function subscribe(cb) {
  listeners.add(cb);
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
}

export function navigate(route, params = {}, { replace = false } = {}) {
  const target = buildHash(route, params);
  if (target === window.location.hash) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', target);
  notify();
}

export function useHashRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  const { route, params } = useMemo(() => parseHash(hash), [hash]);
  return { route, params, navigate };
}
