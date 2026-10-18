import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// jsdom cannot compute layout or paint, so these are source-level guards. Real layout was
// verified separately in headless Chromium.
const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const LIGHT_RE = /:root\s*\{([^}]*)\}/;
const DARK_RE = /:root\[data-theme="dark"\]\s*\{([^}]*)\}/;
const baseRules = css.replace(/@media[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
const rule = (selector) => {
  const m = baseRules.match(new RegExp(`(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : '';
};
const decls = (block) => new Map([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
const light = decls(css.match(LIGHT_RE)?.[1] ?? '');
const dark = decls(css.match(DARK_RE)?.[1] ?? '');
const THEME_TOKENS = ['--bg', '--surface', '--ink', '--muted', '--border', '--control-border', '--head-bg', '--hover-bg', '--accent', '--accent-hover', '--on-accent', '--focus', '--spinner-track', '--shadow', '--overlay'];

function resolveToken(name, theme) {
  const v = (theme === 'dark' ? dark.get(name) : undefined) ?? light.get(name);
  const ref = v?.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolveToken(ref[1], theme) : v;
}
const rgb = (h) => { const n = h.replace('#', ''); const f = n.length === 3 ? [...n].map((c) => c + c).join('') : n; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255); };
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

describe('responsive CSS guards', () => {
  it('main single-column grid cannot be stretched by wide children', () => {
    expect(rule('main.container')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });
  it('the table scroll container scrolls horizontally', () => expect(rule('.table-scroll')).toMatch(/overflow-x:\s*auto/));
  it('summary cards rearrange into columns; header and toolbar wrap', () => {
    expect(rule('.cards')).toMatch(/repeat\(auto-fit,\s*minmax\(/);
    expect(rule('.header-inner')).toMatch(/flex-wrap:\s*wrap/);
    expect(rule('.toolbar')).toMatch(/repeat\(auto-fit,\s*minmax\(/);
  });
  it('animated indicators respect prefers-reduced-motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\.spinner/);
  });
});

describe('interactive card styles', () => {
  it('cards show a pointer cursor, hover and disabled states; focus ring is global', () => {
    expect(rule('.card')).toMatch(/cursor:\s*pointer/);
    expect(css).toMatch(/\.card:hover/);
    expect(css).toMatch(/\.card:disabled/);
    expect(css).toMatch(/:focus-visible/);
  });
  it('the active navigation item has a distinct, non-color-only style', () => {
    expect(css).toMatch(/nav a\[aria-current="page"\][^}]*text-decoration:\s*underline/);
  });
});

describe('chart bars stay comparable', () => {
  it('every bar row uses identical fixed label/value columns and a flexible bar track, so lengths are comparable across rows', () => {
    const cols = rule('.bar-row').match(/grid-template-columns:\s*([^;]+);/)?.[1] ?? '';
    expect(cols).toMatch(/minmax\(0,\s*1fr\)/);
    expect(cols).not.toMatch(/\bauto\b/);
    expect(cols).not.toMatch(/\b\d*fr\b(?!\))[^)]*\b\d*fr\b/); // one flexible track only
  });
});

describe('new component styles', () => {
  it('target badges differ by more than color (distinct border style)', () => {
    expect(css).toMatch(/\.target-badge--met/);
    expect(css).toMatch(/\.target-badge--below[^}]*border-style:\s*dashed/);
  });
  it('chart fills for targets use a pattern, not only a different color', () => {
    expect(css).toMatch(/\.bar-fill--target[^}]*repeating-linear-gradient/);
  });
  it('the dialog overlay and dialog use theme tokens', () => {
    expect(rule('.backdrop')).toMatch(/var\(--overlay\)/);
    expect(rule('.dialog')).toMatch(/var\(--surface\)/);
  });
  it('wide tables keep scrolling inside their container and pagination wraps', () => {
    expect(rule('.pager')).toMatch(/flex-wrap:\s*wrap/);
  });
});

describe('theme tokens', () => {
  it('defines a dark theme that redefines every theme token', () => {
    expect(dark.size).toBeGreaterThan(0);
    for (const t of THEME_TOKENS) { expect(light.has(t), `light ${t}`).toBe(true); expect(dark.has(t), `dark ${t}`).toBe(true); }
  });
  it('declares native control color-scheme for both themes', () => {
    expect(css.match(LIGHT_RE)[1]).toMatch(/color-scheme:\s*light/);
    expect(css.match(DARK_RE)[1]).toMatch(/color-scheme:\s*dark/);
  });
  it('component rules use semantic tokens only (no palette tokens, no raw colors)', () => {
    const rest = css.replace(LIGHT_RE, '').replace(DARK_RE, '');
    expect(rest).not.toMatch(/var\(--(gray|dark)-/);
    expect(rest.split('\n').filter((l) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(l))).toEqual([]);
  });
  it('raw hex colors appear only on palette token lines', () => {
    const offenders = css.split('\n').filter((l) => /#[0-9a-f]{3,8}\b/i.test(l) && !/^\s*--(gray|dark)-\d+:/.test(l));
    expect(offenders).toEqual([]);
  });
});

describe.each(['light', 'dark'])('WCAG AA contrast (%s theme)', (theme) => {
  const t = (n) => resolveToken(n, theme);
  const TEXT = [['--ink', '--bg'], ['--ink', '--surface'], ['--muted', '--bg'], ['--muted', '--surface'], ['--ink', '--head-bg'], ['--ink', '--hover-bg'], ['--muted', '--hover-bg'], ['--on-accent', '--accent'], ['--on-accent', '--accent-hover']];
  const UI = [['--control-border', '--surface'], ['--control-border', '--bg'], ['--focus', '--surface'], ['--focus', '--bg'], ['--accent', '--surface']];
  it.each(TEXT)('text %s on %s is at least 4.5:1', (fg, bg) => expect(ratio(t(fg), t(bg))).toBeGreaterThanOrEqual(4.5));
  it.each(UI)('non-text %s against %s is at least 3:1', (fg, bg) => expect(ratio(t(fg), t(bg))).toBeGreaterThanOrEqual(3));
});
