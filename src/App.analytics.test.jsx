import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { makeApi, makeStatefulApi, setOnline, fillForm, renderAt, loaded, resetEnv } from './test/helpers';

beforeEach(() => { resetEnv(); setOnline(true); vi.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

const data = [
  { id: 'a', name: 'Alpha', department: 'Engineering', current: 60, target: 90, status: 'In Progress', notes: '' },
  { id: 'b', name: 'Bravo', department: 'Editorial', current: 80, target: 95, status: 'Completed', notes: '' },
  { id: 'c', name: 'Charlie', department: 'Revenue', current: 40, target: 70, status: 'Pending', notes: '' },
  { id: 'd', name: 'Delta', department: 'Engineering', current: 95, target: 90, status: 'Completed', notes: '' },
  { id: 'e', name: 'Echo', department: 'Revenue', current: 70, target: 70, status: 'Pending', notes: '' },
  { id: 'f', name: 'Foxtrot', department: 'Engineering', current: 50, target: 80, status: 'In Progress', notes: '' },
];
const nav = () => screen.getByRole('navigation', { name: /dashboard sections/i });
const stat = (label) => screen.getByText(label).nextSibling;
const region = (re) => screen.getByRole('region', { name: re });
const rowOf = (reg, label) => within(reg).getAllByRole('listitem').find((li) => li.textContent.includes(label));

describe('analytics view', () => {
  it('is reachable from the navigation, with a single h2 and h3 sections', async () => {
    const user = userEvent.setup();
    renderAt('#summary', <App api={makeApi({ list: vi.fn(async () => data) })} />);
    await loaded();
    await user.click(within(nav()).getByRole('link', { name: 'Analytics' }));
    expect(window.location.hash).toBe('#analytics');
    expect(screen.getByRole('heading', { level: 2, name: 'Performance analytics' })).toHaveFocus();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Current versus target performance', 'Average current performance by department', 'Task status distribution']);
    expect(within(nav()).getByRole('link', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page');
  });
  it('shows headline metrics derived from the records', async () => {
    renderAt('#analytics', <App api={makeApi({ list: vi.fn(async () => data) })} />);
    await loaded();
    expect(stat('Total performance records')).toHaveTextContent('6');
    expect(stat('Average current performance')).toHaveTextContent('66%');
    expect(stat('Completed tasks')).toHaveTextContent('2');
    expect(stat('Pending tasks')).toHaveTextContent('2');
    expect(stat('In progress tasks')).toHaveTextContent('2');
    expect(stat('Records meeting or exceeding target')).toHaveTextContent(/33%.*2 of 6 records/);
  });
  it('compares average current with average target', async () => {
    renderAt('#analytics', <App api={makeApi({ list: vi.fn(async () => data) })} />);
    await loaded();
    const r = region(/current versus target/i);
    expect(rowOf(r, 'Average current')).toHaveTextContent('65.8%');
    expect(rowOf(r, 'Average target')).toHaveTextContent('82.5%');
    expect(within(r).getByText(/6 records that have both values/i)).toBeInTheDocument();
  });
  it('shows department averages and the status distribution from the data', async () => {
    renderAt('#analytics', <App api={makeApi({ list: vi.fn(async () => data) })} />);
    await loaded();
    const d = region(/by department/i);
    expect(rowOf(d, 'Editorial')).toHaveTextContent('80%');
    expect(rowOf(d, 'Engineering')).toHaveTextContent(/68\.3%.*3 records/);
    expect(rowOf(d, 'Revenue')).toHaveTextContent('55%');
    const s = region(/status distribution/i);
    for (const label of ['Pending', 'In Progress', 'Completed']) expect(rowOf(s, label)).toHaveTextContent(/2.*33%/);
  });
  it('bars are decorative and every value is also available as text', async () => {
    renderAt('#analytics', <App api={makeApi({ list: vi.fn(async () => data) })} />);
    await loaded();
    expect(document.querySelectorAll('.bar[aria-hidden="true"]').length).toBeGreaterThanOrEqual(8);
    expect(document.querySelectorAll('.bar:not([aria-hidden="true"])')).toHaveLength(0);
  });
  it('recalculates after create, edit and delete (nothing is hardcoded)', async () => {
    const user = userEvent.setup();
    const api = makeStatefulApi(data);
    renderAt('#add-record', <App api={api} />);
    await loaded();
    await fillForm(user); // Pending, current 55, target 85 (below target)
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByText(/record added/i);
    await user.click(within(nav()).getByRole('link', { name: 'Analytics' }));
    expect(stat('Total performance records')).toHaveTextContent('7');
    expect(stat('Average current performance')).toHaveTextContent('64%'); // 450 / 7
    expect(stat('Pending tasks')).toHaveTextContent('3');
    expect(stat('Records meeting or exceeding target')).toHaveTextContent(/29%.*2 of 7 records/);
    await user.click(within(nav()).getByRole('link', { name: 'Records' }));
    await user.click(screen.getByRole('button', { name: 'Delete Delta' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /delete record/i }));
    await screen.findByText(/record deleted/i);
    await user.click(within(nav()).getByRole('link', { name: 'Analytics' }));
    expect(stat('Total performance records')).toHaveTextContent('6');
    expect(stat('Records meeting or exceeding target')).toHaveTextContent(/17%.*1 of 6 records/);
    await user.click(within(nav()).getByRole('link', { name: 'Records' }));
    await user.click(screen.getByRole('link', { name: 'Edit Charlie' }));
    await user.clear(screen.getByLabelText(/current performance/i));
    await user.type(screen.getByLabelText(/current performance/i), '75');
    await user.selectOptions(screen.getByLabelText(/^status/i), 'Completed');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByText(/record updated/i);
    await user.click(within(nav()).getByRole('link', { name: 'Analytics' }));
    expect(stat('Records meeting or exceeding target')).toHaveTextContent(/33%.*2 of 6 records/);
    expect(stat('Completed tasks')).toHaveTextContent('2');
  });
  it('shows "No data found" and no charts for an empty dataset', async () => {
    renderAt('#analytics', <App api={makeApi({ list: vi.fn(async () => []) })} />);
    expect(await screen.findByText('No data found')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /by department/i })).not.toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });
  it('handles malformed data: null rows, invalid numbers, zero denominators', async () => {
    const bad = [null, { id: 'z', name: 'Zed', department: 'Revenue', current: 'abc', target: 'def', status: 'Pending' }];
    renderAt('#analytics', <App api={makeApi({ list: vi.fn(async () => bad) })} />);
    await loaded();
    expect(stat('Total performance records')).toHaveTextContent('1');
    expect(stat('Average current performance')).toHaveTextContent('–');
    expect(stat('Records meeting or exceeding target')).toHaveTextContent(/–.*no records have both values/i);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });
  it('shows no numbers while loading and none after a failed load', async () => {
    const first = renderAt('#analytics', <App api={makeApi({ list: vi.fn(() => new Promise(() => {})) })} />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(screen.queryByText('Total performance records')).not.toBeInTheDocument();
    first.unmount();
    renderAt('#analytics', <App api={makeApi({ list: vi.fn().mockRejectedValue(new Error('x')) })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.queryByText('Total performance records')).not.toBeInTheDocument();
    expect(screen.queryByText('No data found')).not.toBeInTheDocument();
  });
});

describe('target achievement indicators in the records table', () => {
  const t = [
    { id: '1', name: 'Below one', department: 'Revenue', current: 60, target: 90, status: 'Pending', notes: '' },
    { id: '2', name: 'Above one', department: 'Revenue', current: 95, target: 90, status: 'Completed', notes: '' },
    { id: '3', name: 'Exact one', department: 'Revenue', current: 70, target: 70, status: 'Completed', notes: '' },
    { id: '4', name: 'Broken one', department: 'Revenue', current: 'abc', target: 70, status: 'Pending', notes: '' },
  ];
  const row = (name) => screen.getByRole('row', { name: new RegExp(name, 'i') });

  it('shows the difference in percentage points with a text indicator for every row', async () => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => t) })} />);
    await screen.findByText('Below one');
    expect(row('Below one')).toHaveTextContent(/-30 pp/);
    expect(row('Below one')).toHaveTextContent(/below target/i);
    expect(row('Above one')).toHaveTextContent(/\+5 pp/);
    expect(row('Above one')).toHaveTextContent(/target met/i);
    expect(row('Exact one')).toHaveTextContent(/0 pp/);
    expect(row('Exact one')).toHaveTextContent(/target met/i);
    expect(row('Broken one')).toHaveTextContent(/not available/i);
    expect(row('Broken one')).not.toHaveTextContent(/pp/);
  });
  it('never relies on color: each badge has text and a decorative icon, and met/below use different classes', async () => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => t) })} />);
    await screen.findByText('Below one');
    const badges = [...document.querySelectorAll('.target-badge')];
    expect(badges).toHaveLength(4);
    for (const b of badges) {
      expect(b.textContent.replace(/[⚠✔–]/g, '').trim().length).toBeGreaterThan(2);
      if (b.querySelector('span')) expect(b.querySelector('span')).toHaveAttribute('aria-hidden', 'true');
    }
    expect(document.querySelectorAll('.target-badge--met')).toHaveLength(2);
    expect(document.querySelectorAll('.target-badge--below')).toHaveLength(1);
  });
  it('explains that differences are percentage points, not relative change', async () => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => t) })} />);
    await screen.findByText('Below one');
    expect(screen.getByText(/difference is current minus target, in percentage points/i)).toBeInTheDocument();
  });
  it('can be sorted by difference, with aria-sort', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => t) })} />);
    await screen.findByText('Below one');
    await user.click(screen.getByRole('button', { name: /sort by difference/i }));
    expect(screen.getByRole('columnheader', { name: /difference/i })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getAllByRole('row').slice(1)[0]).toHaveTextContent('Below one');
    await user.click(screen.getByRole('button', { name: /sort by difference/i }));
    expect(screen.getAllByRole('row').slice(1)[0]).toHaveTextContent('Above one');
  });
});
