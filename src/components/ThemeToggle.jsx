import { useEffect, useState } from 'react';
import { applyTheme, resolveTheme, saveTheme } from '../lib/theme';

const Icon = ({ children }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const Moon = () => <Icon><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Icon>;
const Sun = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export default function ThemeToggle() {
  const [theme, setTheme] = useState(resolveTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);
  const next = theme === 'dark' ? 'light' : 'dark';
  const toggle = () => { setTheme(next); saveTheme(next); };
  return (
    <button type="button" className="btn btn--secondary theme-toggle" onClick={toggle} aria-label={`Switch to ${next} mode`}>
      {next === 'dark' ? <Moon /> : <Sun />}
      <span className="label">{next === 'dark' ? 'Dark' : 'Light'} mode</span>
    </button>
  );
}
