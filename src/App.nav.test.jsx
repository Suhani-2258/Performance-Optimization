import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { seed, makeApi, ANALYTICS, setOnline, fillForm, renderAt, loaded, resetEnv } from './test/helpers';

let info;
beforeEach(() => { resetEnv(); setOnline(true); info = vi.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

const nav = () => screen.getByRole('navigation', { name: /dashboard sections/i });
const link = (name) => within(nav()).getByRole('link', { name });
const currentLinks = () => within(nav()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent);
const bodyRows = () => screen.queryAllByRole('row').slice(1);
const heading = (name) => screen.getByRole('heading', { level: 2, name });
const card = (re) => screen.getByRole('button', { name: re });
const VIEWS = [['#summary', 'Performance summary', 'Summary'], ['#records', 'Performance records', 'Records'], ['#add-record', 'Add a performance record', 'Add record']];
const mixed = [
  ...Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, name: `Done ${i}`, department: 'Editorial', current: 90, target: 95, status: 'Completed', notes: '' })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: `p${i}`, name: `Wait ${i}`, department: 'Revenue', current: 30, target: 70, status: 'Pending', notes: '' })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: `i${i}`, name: `Busy ${i}`, department: 'Product', current: 60, target: 80, status: 'In Progress', notes: '' })),
];

describe('hash navigation', () => {
  it.each(VIEWS)('opens %s directly and highlights the active item', async (hash, title, label) => {
    renderAt(hash, <App api={makeApi()} />);
    await loaded();
    expect(heading(title)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(currentLinks()).toEqual([label]);
  });
  it.each([[''], ['#nonsense'], ['#main']])('falls back to the summary view for hash %j', async (hash) => {
    renderAt(hash, <App api={makeApi()} />);
    await loaded();
    expect(heading('Performance summary')).toBeInTheDocument();
    expect(currentLinks()).toEqual(['Summary']);
  });
  it('restores the same view after a browser refresh', async () => {
    const first = renderAt('#records', <App api={makeApi()} />);
    await loaded();
    first.unmount();
    render(<App api={makeApi()} />);
    await loaded();
    expect(heading('Performance records')).toBeInTheDocument();
    expect(currentLinks()).toEqual(['Records']);
  });
  it('clicking each item opens its view, updates the URL, highlights it and moves focus to the heading', async () => {
    const user = userEvent.setup();
    renderAt('#summary', <App api={makeApi()} />);
    await loaded();
    for (const [hash, title, label] of [VIEWS[1], VIEWS[2], VIEWS[0]]) {
      await user.click(link(label));
      expect(window.location.hash).toBe(hash);
      expect(heading(title)).toHaveFocus();
      expect(currentLinks()).toEqual([label]);
    }
  });
  it('shows exactly one view at a time (no duplicate sections)', async () => {
    renderAt('#summary', <App api={makeApi()} />);
    await loaded();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/task or process name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/search records/i)).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(link('Records'));
    expect(screen.queryByRole('button', { name: /total records/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/task or process name/i)).not.toBeInTheDocument();
    await user.click(link('Add record'));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/task or process name/i)).toBeInTheDocument();
  });
  it('supports browser Back and Forward', async () => {
    const user = userEvent.setup();
    renderAt('#summary', <App api={makeApi()} />);
    await loaded();
    await user.click(link('Records'));
    await user.click(link('Add record'));
    window.history.back();
    await waitFor(() => expect(heading('Performance records')).toBeInTheDocument());
    expect(currentLinks()).toEqual(['Records']);
    window.history.back();
    await waitFor(() => expect(heading('Performance summary')).toBeInTheDocument());
    window.history.forward();
    await waitFor(() => expect(heading('Performance records')).toBeInTheDocument());
    expect(currentLinks()).toEqual(['Records']);
  });
  it('reacts to the hash being edited directly', async () => {
    renderAt('#summary', <App api={makeApi()} />);
    await loaded();
    window.location.hash = '#add-record';
    await waitFor(() => expect(heading('Add a performance record')).toBeInTheDocument());
  });
  it('does not add duplicate history entries when the active link is clicked again', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi()} />);
    await loaded();
    const before = window.history.length;
    await user.click(link('Records'));
    await user.click(link('Records'));
    expect(window.history.length).toBe(before);
  });
  it('every navigation link is a real link with an href', () => {
    render(<App api={makeApi()} />);
    expect(['Summary', 'Records', 'Add record'].map((n) => link(n).getAttribute('href'))).toEqual(['#summary', '#records', '#add-record']);
  });
  it('navigation is reachable and operable by keyboard', async () => {
    const user = userEvent.setup();
    renderAt('#summary', <App api={makeApi()} />);
    await loaded();
    for (let i = 0; i < 10 && document.activeElement !== link('Records'); i++) await user.tab();
    expect(link('Records')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(heading('Performance records')).toBeInTheDocument();
    link('Add record').focus();
    await user.keyboard('{Enter}');
    expect(heading('Add a performance record')).toBeInTheDocument();
  });
  it('the skip link focuses the main content without breaking routing', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi()} />);
    await loaded();
    await user.click(screen.getByRole('link', { name: /skip to main content/i }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#records');
    expect(heading('Performance records')).toBeInTheDocument();
  });
});

describe('interactive summary cards', () => {
  const open = async (api = makeApi()) => { const u = userEvent.setup(); renderAt('#summary', <App api={api} />); await loaded(); return u; };

  it('renders four buttons with accessible names containing label and value', async () => {
    await open();
    expect(card(/total records.*3/i)).toBeEnabled();
    expect(card(/average performance.*60%/i)).toBeEnabled();
    expect(card(/completed tasks.*1/i)).toBeEnabled();
    expect(card(/pending tasks.*1/i)).toBeEnabled();
    expect(within(screen.getByRole('region', { name: /summary/i })).getAllByRole('button')).toHaveLength(4);
  });
  it('Total records opens all records with no filters', async () => {
    const user = await open();
    await user.click(card(/total records/i));
    expect(heading('Performance records')).toBeInTheDocument();
    expect(window.location.hash).toBe('#records');
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByLabelText(/filter by status/i)).toHaveValue('All');
    expect(screen.queryByRole('button', { name: /reset filters/i })).not.toBeInTheDocument();
  });
  it('Average performance opens the records behind the average, highest first, with an explanation', async () => {
    const user = await open();
    await user.click(card(/average performance/i));
    expect(window.location.hash).toBe('#records?focus=average');
    expect(screen.getByText(/3 records used for the 60% average/i)).toBeInTheDocument();
    expect(bodyRows()[0]).toHaveTextContent('Editor autosave');
    expect(bodyRows()).toHaveLength(3);
  });
  it('Average view excludes records without a valid current value', async () => {
    const data = [...seed, { id: 'x', name: 'No value', department: 'Revenue', current: 'abc', target: 50, status: 'Pending', notes: '' }];
    const user = await open(makeApi({ list: vi.fn(async () => data) }));
    await user.click(card(/average performance/i));
    expect(screen.getByText(/3 records used for the 60% average/i)).toBeInTheDocument();
    expect(screen.queryByText('No value')).not.toBeInTheDocument();
  });
  it('Completed tasks opens Records filtered to Completed', async () => {
    const user = await open();
    await user.click(card(/completed tasks/i));
    expect(window.location.hash).toBe('#records?status=Completed');
    expect(screen.getByLabelText(/filter by status/i)).toHaveValue('Completed');
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent('Editor autosave');
    expect(screen.getByText('Showing 1 of 3 records')).toBeInTheDocument();
  });
  it('Pending tasks opens Records filtered to Pending (In Progress excluded)', async () => {
    const user = await open();
    await user.click(card(/pending tasks/i));
    expect(window.location.hash).toBe('#records?status=Pending');
    expect(screen.getByLabelText(/filter by status/i)).toHaveValue('Pending');
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent('Ad refresh rate');
    expect(screen.queryByText('Homepage load time')).not.toBeInTheDocument();
  });
  it('card counts always match the rows shown after clicking, including with In Progress records present', async () => {
    const api = makeApi({ list: vi.fn(async () => mixed) });
    const user = await open(api);
    expect(card(/completed tasks.*3/i)).toBeInTheDocument();
    expect(card(/pending tasks.*2/i)).toBeInTheDocument();
    await user.click(card(/completed tasks/i));
    expect(bodyRows()).toHaveLength(3);
    await user.click(link('Summary'));
    await user.click(card(/pending tasks/i));
    expect(bodyRows()).toHaveLength(2);
    await user.click(link('Summary'));
    await user.click(card(/total records/i));
    expect(bodyRows()).toHaveLength(7);
  });
  it('Back returns from a card-opened view to the summary', async () => {
    const user = await open();
    await user.click(card(/completed tasks/i));
    window.history.back();
    await waitFor(() => expect(heading('Performance summary')).toBeInTheDocument());
  });
  it('is keyboard operable with Enter and Space', async () => {
    const user = await open();
    card(/completed tasks/i).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText(/filter by status/i)).toHaveValue('Completed');
    await user.click(link('Summary'));
    card(/pending tasks/i).focus();
    await user.keyboard(' ');
    expect(screen.getByLabelText(/filter by status/i)).toHaveValue('Pending');
  });
  it('cards are disabled and read "Unavailable" (not zero) while loading', () => {
    renderAt('#summary', <App api={makeApi({ list: vi.fn(() => new Promise(() => {})) })} />);
    for (const re of [/total records/i, /average performance/i, /completed tasks/i, /pending tasks/i]) {
      expect(card(re)).toBeDisabled();
      expect(card(re)).toHaveTextContent(/unavailable/i);
    }
  });
  it('cards stay disabled with "–" values when loading fails', async () => {
    renderAt('#summary', <App api={makeApi({ list: vi.fn().mockRejectedValue(new Error('x')) })} />);
    await screen.findByRole('alert');
    expect(card(/total records/i)).toBeDisabled();
    expect(within(screen.getByRole('region', { name: /summary/i })).getByText('Total records').nextSibling).toHaveTextContent('–');
  });
});

describe('filters, reset and URL sync', () => {
  it('Reset filters clears status, search and focus and returns to all records', async () => {
    const user = userEvent.setup();
    renderAt('#records?status=Completed', <App api={makeApi()} />);
    await loaded();
    await user.type(screen.getByLabelText(/search records/i), 'zzz');
    expect(screen.getByText('No data found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reset filters/i }));
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByLabelText(/filter by status/i)).toHaveValue('All');
    expect(screen.getByLabelText(/search records/i)).toHaveValue('');
    expect(window.location.hash).toBe('#records');
    expect(screen.queryByRole('button', { name: /reset filters/i })).not.toBeInTheDocument();
  });
  it('Reset also leaves the average view', async () => {
    const user = userEvent.setup();
    renderAt('#records?focus=average', <App api={makeApi()} />);
    await loaded();
    await user.click(screen.getByRole('button', { name: /reset filters/i }));
    expect(screen.queryByText(/used for the/i)).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#records');
  });
  it('the Records nav item shows the complete list even after a card filter', async () => {
    const user = userEvent.setup();
    renderAt('#summary', <App api={makeApi()} />);
    await loaded();
    await user.click(card(/pending tasks/i));
    await user.click(link('Records'));
    expect(bodyRows()).toHaveLength(3);
    expect(window.location.hash).toBe('#records');
  });
  it('changing the status select updates the URL, and Back restores the previous filter', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi()} />);
    await loaded();
    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'Completed');
    expect(window.location.hash).toBe('#records?status=Completed');
    expect(bodyRows()).toHaveLength(1);
    window.history.back();
    await waitFor(() => expect(screen.getByLabelText(/filter by status/i)).toHaveValue('All'));
    expect(bodyRows()).toHaveLength(3);
  });
  it.each([['#records?status=Pending', 'Pending', 1], ['#records?status=Nope', 'All', 3], ['#records?status=Completed&x=1', 'Completed', 1]])(
    'deep link %s selects %s with %i rows', async (hash, value, count) => {
      renderAt(hash, <App api={makeApi()} />);
      await loaded();
      expect(screen.getByLabelText(/filter by status/i)).toHaveValue(value);
      expect(bodyRows()).toHaveLength(count);
    });
  it('sorting still works inside a card-filtered view', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => mixed) })} />);
    await loaded();
    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'Completed');
    await user.click(screen.getByRole('button', { name: /sort by task/i }));
    await user.click(screen.getByRole('button', { name: /sort by task/i }));
    expect(bodyRows()[0]).toHaveTextContent('Done 2');
  });
});

describe('record creation across views', () => {
  it('shows a success message and updates summary and records without a refresh', async () => {
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeApi()} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    expect(await screen.findByText(/record added: cache warmup/i)).toBeInTheDocument();
    expect(info.mock.calls.filter((c) => c[0] === ANALYTICS)).toHaveLength(1);
    await user.click(link('Summary'));
    expect(card(/total records.*4/i)).toBeInTheDocument();
    expect(card(/pending tasks.*2/i)).toBeInTheDocument();
    expect(card(/average performance.*59%/i)).toBeInTheDocument(); // (60+80+40+55)/4 = 58.75
    await user.click(card(/pending tasks/i));
    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByText('Cache warmup')).toBeInTheDocument();
  });
  it('the success message does not linger on other views', async () => {
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeApi()} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByText(/record added/i);
    await user.click(link('Records'));
    expect(screen.queryByText(/record added/i)).not.toBeInTheDocument();
  });
  it('keeps the typed draft when navigating away and back', async () => {
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeApi()} />);
    await loaded();
    await user.type(screen.getByLabelText(/task or process name/i), 'Half typed');
    await user.click(link('Records'));
    await user.click(link('Add record'));
    expect(screen.getByLabelText(/task or process name/i)).toHaveValue('Half typed');
  });
  it('keeps the draft after a failed save when the user navigates away and back, and nothing is logged', async () => {
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeApi({ add: vi.fn().mockRejectedValue(new Error('x')) })} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByRole('alert');
    await user.click(link('Summary'));
    await user.click(link('Add record'));
    expect(screen.getByLabelText(/task or process name/i)).toHaveValue('Cache warmup');
    expect(info).not.toHaveBeenCalledWith(ANALYTICS);
  });
  it('clears the draft after a successful save', async () => {
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeApi()} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByText(/record added/i);
    await user.click(link('Records'));
    await user.click(link('Add record'));
    expect(screen.getByLabelText(/task or process name/i)).toHaveValue('');
  });
});
