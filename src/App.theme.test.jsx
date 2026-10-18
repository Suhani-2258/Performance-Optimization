import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { makeApi, setOnline, resetEnv } from './test/helpers';

const KEY = 'news-blog:theme';
const html = () => document.documentElement;
const mockSystem = (dark) => {
  window.matchMedia = vi.fn((q) => ({ matches: q.includes('dark') && dark, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
};
beforeEach(() => { resetEnv(); setOnline(true); });
afterEach(() => vi.restoreAllMocks());

describe('theme toggle', () => {
  it('lives in the top banner with an accessible name and an inline icon', () => {
    render(<App api={makeApi()} />);
    const btn = within(screen.getByRole('banner')).getByRole('button', { name: 'Switch to dark mode' });
    expect(btn.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
  it('defaults to light and switches both ways, updating the label and <html data-theme>', async () => {
    const user = userEvent.setup();
    render(<App api={makeApi()} />);
    expect(html()).toHaveAttribute('data-theme', 'light');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(html()).toHaveAttribute('data-theme', 'dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(html()).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });
  it('persists the choice in localStorage and restores it after a reload', async () => {
    const user = userEvent.setup();
    const first = render(<App api={makeApi()} />);
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(localStorage.getItem(KEY)).toBe('dark');
    first.unmount();
    delete document.documentElement.dataset.theme; // a fresh page load
    render(<App api={makeApi()} />);
    expect(html()).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });
  it('follows the system dark preference on first visit without saving anything', () => {
    mockSystem(true);
    render(<App api={makeApi()} />);
    expect(html()).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
  it('uses light when the system prefers light or matchMedia is unavailable', () => {
    mockSystem(false);
    render(<App api={makeApi()} />);
    expect(html()).toHaveAttribute('data-theme', 'light');
  });
  it('a saved preference beats the system preference', () => {
    mockSystem(true);
    localStorage.setItem(KEY, 'light');
    render(<App api={makeApi()} />);
    expect(html()).toHaveAttribute('data-theme', 'light');
  });
  it('ignores an invalid saved value', () => {
    localStorage.setItem(KEY, 'neon');
    render(<App api={makeApi()} />);
    expect(html()).toHaveAttribute('data-theme', 'light');
  });
  it('keeps working when localStorage throws on read and write', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    render(<App api={makeApi()} />);
    expect(html()).toHaveAttribute('data-theme', 'light');
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(html()).toHaveAttribute('data-theme', 'dark');
  });
  it('is operable with Enter and Space', async () => {
    const user = userEvent.setup();
    render(<App api={makeApi()} />);
    screen.getByRole('button', { name: 'Switch to dark mode' }).focus();
    await user.keyboard('{Enter}');
    expect(html()).toHaveAttribute('data-theme', 'dark');
    await user.keyboard(' ');
    expect(html()).toHaveAttribute('data-theme', 'light');
  });
});
