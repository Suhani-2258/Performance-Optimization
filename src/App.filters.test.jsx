import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { seed, makeApi, makeStatefulApi, setOnline, renderAt, loaded, resetEnv } from './test/helpers';
import { DEPARTMENTS, STATUSES } from './lib/records';

beforeEach(() => { resetEnv(); setOnline(true); vi.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

const many = Array.from({ length: 23 }, (_, i) => {
  const n = i + 1;
  return { id: `r${n}`, name: `Task ${String(n).padStart(2, '0')}`, department: DEPARTMENTS[i % 5], current: n * 4, target: 50 + (n % 5) * 10, status: STATUSES[i % 3], notes: n % 7 === 0 ? 'seven' : '' };
});
const open = async (data = many, extra = {}) => {
  const user = userEvent.setup();
  const download = extra.download ?? vi.fn();
  renderAt('#records', <App api={makeApi({ list: vi.fn(async () => data) })} download={download} />);
  await loaded();
  return { user, download };
};
const names = () => screen.queryAllByRole('row').slice(1).map((r) => r.querySelector('th[scope="row"]')?.textContent);
const pager = () => screen.getByRole('navigation', { name: /pagination/i });
const next = () => within(pager()).getByRole('button', { name: /^next$/i });
const prev = () => within(pager()).getByRole('button', { name: /^previous$/i });
const pageText = () => within(pager()).getByText(/^Page \d+ of \d+$/).textContent;
const taskNames = (arr) => arr.map((r) => r.name);

describe('pagination', () => {
  it('defaults to 10 rows per page with page indicators and Previous/Next', async () => {
    await open();
    expect(names()).toEqual(taskNames(many.slice(0, 10)));
    expect(pageText()).toBe('Page 1 of 3');
    expect(within(pager()).getByText(/rows 1–10 of 23/i)).toBeInTheDocument();
    expect(prev()).toHaveAttribute('aria-disabled', 'true');
    expect(next()).not.toHaveAttribute('aria-disabled', 'true');
  });
  it('moves between pages and stops at the ends', async () => {
    const { user } = await open();
    await user.click(next());
    expect(names()).toEqual(taskNames(many.slice(10, 20)));
    expect(pageText()).toBe('Page 2 of 3');
    await user.click(next());
    expect(names()).toEqual(taskNames(many.slice(20)));
    expect(next()).toHaveAttribute('aria-disabled', 'true');
    await user.click(next());
    expect(pageText()).toBe('Page 3 of 3');
    await user.click(prev());
    expect(pageText()).toBe('Page 2 of 3');
  });
  it('supports 5, 10 and 20 rows per page and returns to page 1 when the size changes', async () => {
    const { user } = await open();
    const size = screen.getByLabelText(/rows per page/i);
    expect([...size.options].map((o) => o.value)).toEqual(['5', '10', '20']);
    await user.click(next());
    await user.selectOptions(size, '5');
    expect(pageText()).toBe('Page 1 of 5');
    expect(names()).toHaveLength(5);
    await user.selectOptions(size, '20');
    expect(pageText()).toBe('Page 1 of 2');
    expect(names()).toHaveLength(20);
  });
  it('Previous/Next work from the keyboard and keep focus', async () => {
    const { user } = await open();
    next().focus();
    await user.keyboard('{Enter}');
    expect(pageText()).toBe('Page 2 of 3');
    expect(next()).toHaveFocus();
  });
  it('shows no pager when everything fits on one page or there are no results', async () => {
    await open(seed);
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });
  it('keeps the sort order across pages', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: /sort by current/i }));
    await user.click(screen.getByRole('button', { name: /sort by current/i }));
    expect(names()[0]).toBe('Task 23');
    await user.click(next());
    expect(names()[0]).toBe('Task 13');
  });
  it('after a delete leaves the current page empty, falls back to a valid page', async () => {
    const user = userEvent.setup();
    const api = makeStatefulApi(many.slice(0, 11));
    renderAt('#records', <App api={api} />);
    await loaded();
    await user.click(next());
    expect(names()).toEqual(['Task 11']);
    await user.click(screen.getByRole('button', { name: 'Delete Task 11' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /delete record/i }));
    await screen.findByText(/record deleted/i);
    expect(names()).toHaveLength(10);
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });
});

describe('advanced filters work together with search, sort and pagination', () => {
  it('filters by department and offers every department', async () => {
    const { user } = await open();
    const dept = screen.getByLabelText(/filter by department/i);
    expect([...dept.options].map((o) => o.value)).toEqual(['All', ...DEPARTMENTS]);
    await user.selectOptions(dept, 'Engineering');
    expect(names()).toEqual(taskNames(many.filter((r) => r.department === 'Engineering')));
    expect(pageText).toBeDefined();
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });
  it('combines department, status and search', async () => {
    const { user } = await open();
    await user.selectOptions(screen.getByLabelText(/filter by department/i), 'Engineering');
    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'Pending');
    expect(names()).toEqual(taskNames(many.filter((r) => r.department === 'Engineering' && r.status === 'Pending')));
    await user.type(screen.getByLabelText(/search records/i), 'task 16');
    expect(names()).toEqual(['Task 16']);
  });
  it('filters by current and target performance ranges (inclusive), separately and combined', async () => {
    const { user } = await open();
    await user.type(screen.getByLabelText('Current min (%)'), '40');
    await user.type(screen.getByLabelText('Current max (%)'), '60');
    expect(names()).toEqual(taskNames(many.filter((r) => r.current >= 40 && r.current <= 60)));
    await user.type(screen.getByLabelText('Target min (%)'), '80');
    expect(names()).toEqual(taskNames(many.filter((r) => r.current >= 40 && r.current <= 60 && r.target >= 80)));
    await user.type(screen.getByLabelText('Target max (%)'), '80');
    expect(names()).toEqual(taskNames(many.filter((r) => r.current >= 40 && r.current <= 60 && r.target === 80)));
  });
  it('flags a malformed bound accessibly and ignores it', async () => {
    const { user } = await open();
    const min = screen.getByLabelText('Current min (%)');
    await user.type(min, 'abc');
    expect(min).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(min.getAttribute('aria-describedby'))).toHaveTextContent(/0 and 100/);
    expect(names()).toHaveLength(10);
    expect(pageText()).toBe('Page 1 of 3');
  });
  it('flags a minimum above the maximum, ignores the range, and recovers once fixed', async () => {
    const { user } = await open();
    await user.type(screen.getByLabelText('Target min (%)'), '90');
    await user.type(screen.getByLabelText('Target max (%)'), '60');
    const max = screen.getByLabelText('Target max (%)');
    expect(max).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(max.getAttribute('aria-describedby'))).toHaveTextContent(/greater than or equal/i);
    expect(pageText()).toBe('Page 1 of 3');
    await user.clear(max);
    await user.type(max, '95');
    expect(max).not.toHaveAttribute('aria-invalid', 'true');
    expect(names().length).toBeGreaterThan(0);
  });
  it('returns to page 1 whenever a filter changes, and never shows an out-of-range page', async () => {
    const { user } = await open();
    await user.click(next());
    await user.click(next());
    expect(pageText()).toBe('Page 3 of 3');
    await user.selectOptions(screen.getByLabelText(/filter by department/i), 'Revenue');
    expect(names()).toEqual(taskNames(many.filter((r) => r.department === 'Revenue')));
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/filter by department/i), 'All');
    expect(pageText()).toBe('Page 1 of 3');
    await user.click(next());
    await user.type(screen.getByLabelText(/search records/i), 'Task 01');
    expect(names()).toEqual(['Task 01']);
  });
  it('shows "No data found" for zero results without crashing, then Reset filters restores everything', async () => {
    const { user } = await open();
    await user.selectOptions(screen.getByLabelText(/rows per page/i), '5');
    await user.selectOptions(screen.getByLabelText(/filter by department/i), 'Product');
    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'Completed');
    await user.type(screen.getByLabelText('Current min (%)'), '99');
    expect(screen.getByText('No data found')).toBeInTheDocument();
    expect(screen.getByText(/different search term or clear the filters/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reset filters/i }));
    expect(screen.getByLabelText(/filter by department/i)).toHaveValue('All');
    expect(screen.getByLabelText(/filter by status/i)).toHaveValue('All');
    expect(screen.getByLabelText('Current min (%)')).toHaveValue('');
    expect(screen.getByLabelText(/search records/i)).toHaveValue('');
    expect(pageText()).toBe('Page 1 of 5');
    expect(screen.queryByRole('button', { name: /reset filters/i })).not.toBeInTheDocument();
  });
  it('shows Reset filters as soon as any new filter is active', async () => {
    const { user } = await open();
    expect(screen.queryByRole('button', { name: /reset filters/i })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/filter by department/i), 'Revenue');
    expect(screen.getByRole('button', { name: /reset filters/i })).toBeInTheDocument();
  });
  it('card filters from the summary still combine with the new filters', async () => {
    const user = userEvent.setup();
    renderAt('#summary', <App api={makeApi({ list: vi.fn(async () => many) })} />);
    await loaded();
    await user.click(screen.getByRole('button', { name: /pending tasks/i }));
    await user.selectOptions(screen.getByLabelText(/filter by department/i), 'Engineering');
    expect(names()).toEqual(taskNames(many.filter((r) => r.status === 'Pending' && r.department === 'Engineering')));
  });
});

describe('CSV and JSON export', () => {
  const last = (fn) => fn.mock.calls.at(-1)[0];
  const csvRows = (content) => content.split('\r\n');

  it('offers exactly one Export CSV and one Export JSON button', async () => {
    await open();
    expect(screen.getAllByRole('button', { name: /export csv/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /export json/i })).toHaveLength(1);
  });
  it('exports every record matching the filters and sort, not just the visible page', async () => {
    const { user, download } = await open();
    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'Pending');
    await user.selectOptions(screen.getByLabelText(/rows per page/i), '5');
    await user.click(screen.getByRole('button', { name: /sort by current/i }));
    await user.click(screen.getByRole('button', { name: /sort by current/i }));
    expect(names()).toHaveLength(5);
    const expected = many.filter((r) => r.status === 'Pending').sort((a, b) => b.current - a.current);
    await user.click(screen.getByRole('button', { name: /export csv/i }));
    const csv = last(download);
    expect(csvRows(csv.content)).toHaveLength(1 + expected.length);
    expect(csvRows(csv.content).slice(1).map((l) => l.split(',')[0])).toEqual(expected.map((r) => r.id));
    expect(csv.mime).toMatch(/text\/csv/);
    await user.click(screen.getByRole('button', { name: /export json/i }));
    const json = last(download);
    expect(JSON.parse(json.content).map((r) => r.id)).toEqual(expected.map((r) => r.id));
    expect(json.mime).toBe('application/json');
  });
  it('uses meaningful filenames containing the current date', async () => {
    const { user, download } = await open();
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await user.click(screen.getByRole('button', { name: /export csv/i }));
    expect(last(download).filename).toBe(`performance-records-${stamp}.csv`);
    await user.click(screen.getByRole('button', { name: /export json/i }));
    expect(last(download).filename).toBe(`performance-records-${stamp}.json`);
  });
  it('keeps numeric values numeric', async () => {
    const { user, download } = await open(seed);
    await user.click(screen.getByRole('button', { name: /export json/i }));
    expect(JSON.parse(last(download).content)[0]).toMatchObject({ current: 60, target: 90 });
    await user.click(screen.getByRole('button', { name: /export csv/i }));
    expect(csvRows(last(download).content)[1]).toBe('1,Homepage load time,Engineering,60,90,In Progress,CDN work');
  });
  it('exports an empty result as a header-only CSV and an empty JSON array', async () => {
    const { user, download } = await open();
    await user.type(screen.getByLabelText(/search records/i), 'zzzz');
    await user.click(screen.getByRole('button', { name: /export csv/i }));
    expect(last(download).content).toBe('id,name,department,current,target,status,notes');
    await user.click(screen.getByRole('button', { name: /export json/i }));
    expect(last(download).content).toBe('[]');
  });
  it('escapes special characters and neutralizes spreadsheet formulas', async () => {
    const data = [{ ...seed[0], name: '=HYPERLINK("http://x")', notes: 'a, "b"\nc' }, { ...seed[1], name: '+1+1' }];
    const { user, download } = await open(data);
    await user.click(screen.getByRole('button', { name: /export csv/i }));
    const { content } = last(download);
    expect(content).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(content).toContain(`"a, ""b""\nc"`);
    expect(content).toContain(`'+1+1`);
  });
  it('announces the export and survives a failing download', async () => {
    const { user, download } = await open(many.slice(0, 3));
    await user.click(screen.getByRole('button', { name: /export csv/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Exported 3 records as CSV.');
    download.mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('button', { name: /export json/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not export/i);
    expect(screen.getByText('Task 01')).toBeInTheDocument();
  });
  it('is disabled until records have loaded', () => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(() => new Promise(() => {})) })} />);
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /export json/i })).toBeDisabled();
  });
  it('is keyboard operable', async () => {
    const { user, download } = await open(seed);
    screen.getByRole('button', { name: /export csv/i }).focus();
    await user.keyboard('{Enter}');
    expect(download).toHaveBeenCalledTimes(1);
  });
});
