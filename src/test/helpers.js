import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

export const seed = [
  { id: '1', name: 'Homepage load time', department: 'Engineering', current: 60, target: 90, status: 'In Progress', notes: 'CDN work' },
  { id: '2', name: 'Editor autosave', department: 'Editorial', current: 80, target: 95, status: 'Completed', notes: '' },
  { id: '3', name: 'Ad refresh rate', department: 'Revenue', current: 40, target: 70, status: 'Pending', notes: '' },
];
export const ANALYTICS = '[Analytics] User interacted with Performance Optimization';
export const makeApi = (over = {}) => ({
  list: vi.fn(async () => seed),
  add: vi.fn(async (r) => ({ ...r, id: 'new-1' })),
  update: vi.fn(async (id, r) => ({ ...r, id })),
  remove: vi.fn(async (id) => ({ id })),
  ...over,
});
// A fake API that behaves like a real store, so create/edit/delete flows can be followed end to end.
export function makeStatefulApi(initial = seed) {
  let rows = initial.map((r) => ({ ...r }));
  let n = 0;
  return {
    list: vi.fn(async () => rows.map((r) => ({ ...r }))),
    add: vi.fn(async (r) => { const saved = { ...r, id: `new-${++n}` }; rows = [...rows, saved]; return { ...saved }; }),
    update: vi.fn(async (id, r) => { rows = rows.map((x) => (x.id === id ? { ...r, id } : x)); return { ...r, id }; }),
    remove: vi.fn(async (id) => { rows = rows.filter((x) => x.id !== id); return { id }; }),
  };
}
export const setOnline = (v) => Object.defineProperty(window.navigator, 'onLine', { value: v, configurable: true });

export async function fillForm(user, v = {}) {
  const d = { name: 'Cache warmup', department: 'Engineering', current: '55', target: '85', status: 'Pending', notes: 'n', ...v };
  await user.type(screen.getByLabelText(/task or process name/i), d.name);
  await user.selectOptions(screen.getByLabelText(/^department/i), d.department);
  await user.type(screen.getByLabelText(/current performance/i), d.current);
  await user.type(screen.getByLabelText(/target performance/i), d.target);
  await user.selectOptions(screen.getByLabelText(/^status/i), d.status);
  if (d.notes) await user.type(screen.getByLabelText(/notes/i), d.notes);
}

// Reset URL hash and theme between tests (jsdom keeps them across tests).
export function resetEnv() {
  window.history.replaceState(null, '', window.location.pathname);
  delete document.documentElement.dataset.theme;
  delete window.matchMedia;
}
export function renderAt(hash, ui) {
  window.history.replaceState(null, '', hash ? `${window.location.pathname}${hash}` : window.location.pathname);
  return render(ui);
}
export const loaded = () => waitFor(() => expect(screen.queryByText(/loading performance records/i)).not.toBeInTheDocument());
