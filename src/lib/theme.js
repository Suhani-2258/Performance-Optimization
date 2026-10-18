export const THEME_KEY = 'news-blog:theme';
const isTheme = (t) => t === 'light' || t === 'dark';

// Saved choice wins; otherwise follow the system preference; otherwise light.
export function resolveTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (isTheme(saved)) return saved;
  } catch { /* storage unavailable: fall through */ }
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch { /* ignore */ }
  return 'light';
}

export function saveTheme(theme) {
  try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* keep the in-memory choice */ }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}
