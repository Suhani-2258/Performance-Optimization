import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { seed, ANALYTICS, makeApi, setOnline, fillForm, renderAt, loaded, resetEnv } from './test/helpers';

let info;
beforeEach(() => { resetEnv(); setOnline(true); info = vi.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe('initial rendering and accessibility', () => {
  it('renders heading, landmarks and navigation', async () => {
    renderAt('#records', <App api={makeApi()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Performance Optimization' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /dashboard sections/i })).toBeInTheDocument();
    await screen.findByText('Homepage load time');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1); // one view at a time
  });
  it('shows a loading indicator, then data and summary cards', async () => {
    let resolve;
    const api = makeApi({ list: vi.fn(() => new Promise((r) => { resolve = r; })) });
    renderAt('#summary', <App api={api} />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    resolve(seed);
    const cards = screen.getByRole('region', { name: /summary/i });
    await waitFor(() => expect(within(cards).getByText('Total records').nextSibling).toHaveTextContent('3'));
    expect(within(cards).getByText('Average performance').nextSibling).toHaveTextContent('60%');
    expect(within(cards).getByText('Completed tasks').nextSibling).toHaveTextContent('1');
    expect(within(cards).getByText('Pending tasks').nextSibling).toHaveTextContent('1'); // In Progress is not Pending
  });
  it('records view: every control has an accessible name and the table scroll region is keyboard reachable', async () => {
    renderAt('#records', <App api={makeApi()} />);
    await screen.findByText('Homepage load time');
    for (const re of [/search records/i, /filter by status/i]) expect(screen.getByLabelText(re)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /performance records table/i })).toHaveAttribute('tabindex', '0');
  });
  it('add-record view: every form control has an accessible name', async () => {
    renderAt('#add-record', <App api={makeApi()} />);
    await loaded();
    for (const re of [/task or process name/i, /^department/i, /current performance/i, /target performance/i, /^status/i, /notes/i]) {
      expect(screen.getByLabelText(re)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /add record/i })).toBeInTheDocument();
  });
  it('supports keyboard navigation to the search field', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi()} />);
    await screen.findByText('Homepage load time');
    for (let i = 0; i < 12 && document.activeElement !== screen.getByLabelText(/search records/i); i++) await user.tab();
    expect(screen.getByLabelText(/search records/i)).toHaveFocus();
  });
});

describe('empty and missing data', () => {
  it.each([[[]], [null], [undefined]])('shows "No data found" for %j', async (data) => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => data) })} />);
    expect(await screen.findByText('No data found')).toBeInTheDocument();
  });
  it('does not crash on malformed rows', async () => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => [null, { id: 'z' }, seed[0]]) })} />);
    expect(await screen.findByText('Homepage load time')).toBeInTheDocument();
  });
});

describe('search, filter and sort', () => {
  it('searches and shows empty state for no matches', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi()} />);
    await screen.findByText('Homepage load time');
    await user.type(screen.getByLabelText(/search records/i), 'editor');
    expect(screen.queryByText('Homepage load time')).not.toBeInTheDocument();
    expect(screen.getByText('Editor autosave')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/search records/i));
    await user.type(screen.getByLabelText(/search records/i), 'zzzz');
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });
  it('filters by status', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi()} />);
    await screen.findByText('Homepage load time');
    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'Completed');
    expect(screen.getByText('Editor autosave')).toBeInTheDocument();
    expect(screen.queryByText('Ad refresh rate')).not.toBeInTheDocument();
  });
  it('sorts via column header buttons and exposes aria-sort', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi()} />);
    await screen.findByText('Homepage load time');
    await user.click(screen.getByRole('button', { name: /sort by current/i }));
    expect(screen.getByRole('columnheader', { name: /current/i })).toHaveAttribute('aria-sort', 'ascending');
    let rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Ad refresh rate');
    await user.click(screen.getByRole('button', { name: /sort by current/i }));
    expect(screen.getByRole('columnheader', { name: /current/i })).toHaveAttribute('aria-sort', 'descending');
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Editor autosave');
  });
});

describe('form validation', () => {
  it('flags empty required fields with aria-invalid, described errors, focus, and no analytics', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    renderAt('#add-record', <App api={api} />);
    await loaded();
    await user.click(screen.getByRole('button', { name: /add record/i }));
    const name = screen.getByLabelText(/task or process name/i);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    const errId = name.getAttribute('aria-describedby');
    expect(errId).toBeTruthy();
    expect(document.getElementById(errId)).toHaveTextContent(/required/i);
    expect(name).toHaveFocus();
    expect(api.add).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalledWith(ANALYTICS);
  });
  it('rejects malformed numbers with a visible text error (not color-only)', async () => {
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeApi()} />);
    await loaded();
    await fillForm(user, { current: '150' });
    await user.click(screen.getByRole('button', { name: /add record/i }));
    const cur = screen.getByLabelText(/current performance/i);
    expect(cur).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(cur.getAttribute('aria-describedby'))).toHaveTextContent(/0.*100/);
  });
  it('clears the error once the field is corrected', async () => {
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeApi()} />);
    await loaded();
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await user.type(screen.getByLabelText(/task or process name/i), 'Abc');
    await user.click(screen.getByRole('button', { name: /add record/i }));
    expect(screen.getByLabelText(/task or process name/i)).not.toHaveAttribute('aria-invalid', 'true');
  });
});

describe('submission', () => {
  it('adds a record, announces success, resets form, logs analytics once', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    renderAt('#add-record', <App api={api} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    expect(await screen.findByText(/record added: cache warmup/i)).toBeInTheDocument();
    expect(api.add).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cache warmup', current: 55, target: 85 }), expect.anything());
    expect(screen.getByRole('status')).toHaveTextContent(/record added/i);
    expect(screen.getByLabelText(/task or process name/i)).toHaveValue('');
    expect(info.mock.calls.filter((c) => c[0] === ANALYTICS)).toHaveLength(1);
    await user.click(screen.getByRole('link', { name: 'Summary' }));
    const total = within(screen.getByRole('region', { name: /summary/i })).getByText('Total records').nextSibling;
    expect(total).toHaveTextContent('4');
    await user.click(screen.getByRole('link', { name: 'Records' }));
    expect(screen.getByText('Cache warmup')).toBeInTheDocument();
  });
  it('disables the submit button and shows a loading state while saving', async () => {
    const user = userEvent.setup();
    let resolve;
    renderAt('#add-record', <App api={makeApi({ add: vi.fn(() => new Promise((r) => { resolve = r; })) })} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    resolve({ id: 'n', name: 'Cache warmup', department: 'Engineering', current: 55, target: 85, status: 'Pending', notes: '' });
    await screen.findByRole('button', { name: /add record/i });
  });
  it('preserves form data on failure, shows retry, and only logs analytics after success', async () => {
    const user = userEvent.setup();
    const add = vi.fn().mockRejectedValueOnce(new Error('boom')).mockImplementation(async (r) => ({ ...r, id: 'ok' }));
    renderAt('#add-record', <App api={makeApi({ add })} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(screen.getByLabelText(/task or process name/i)).toHaveValue('Cache warmup');
    expect(screen.getByLabelText(/current performance/i)).toHaveValue('55');
    expect(info).not.toHaveBeenCalledWith(ANALYTICS);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText(/record added: cache warmup/i)).toBeInTheDocument();
    expect(info.mock.calls.filter((c) => c[0] === ANALYTICS)).toHaveLength(1);
  });
  it('renders malicious-looking text as plain text', async () => {
    const user = userEvent.setup();
    const evil = '<img src=x onerror=alert(1)>';
    renderAt('#add-record', <App api={makeApi()} />);
    await loaded();
    await fillForm(user, { name: evil });
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByText(/record added/i);
    await user.click(screen.getByRole('link', { name: 'Records' }));
    expect(await screen.findByText(evil)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('network failures, offline and cancellation', () => {
  it('shows an error with Retry when loading fails, then recovers', async () => {
    const user = userEvent.setup();
    const list = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(seed);
    renderAt('#records', <App api={makeApi({ list })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Homepage load time')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('does not hang forever on a slow request', async () => {
    render(<App api={makeApi({ list: vi.fn(() => new Promise(() => {})) })} timeoutMs={30} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/timed out|too long/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
  it('shows and clears an offline indicator', async () => {
    render(<App api={makeApi()} />);
    await loaded();
    setOnline(false);
    fireEvent(window, new Event('offline'));
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
    setOnline(true);
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument());
  });
  it('does not call the API while offline and keeps the entered data', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    renderAt('#add-record', <App api={api} />);
    await loaded();
    await fillForm(user);
    setOnline(false);
    fireEvent(window, new Event('offline'));
    await user.click(screen.getByRole('button', { name: /add record/i }));
    expect(api.add).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/offline/i);
    expect(screen.getByLabelText(/task or process name/i)).toHaveValue('Cache warmup');
    expect(info).not.toHaveBeenCalledWith(ANALYTICS);
  });
  it('aborts the in-flight request on unmount', async () => {
    let signal;
    const list = vi.fn((opts) => { signal = opts.signal; return new Promise(() => {}); });
    const { unmount } = render(<App api={makeApi({ list })} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    unmount();
    expect(signal.aborted).toBe(true);
  });
  it('labels data as stored locally in this browser', async () => {
    render(<App api={makeApi()} />);
    await loaded();
    expect(screen.getByText(/demo data.*this browser/i)).toBeInTheDocument();
  });
});

describe('load state is distinct from empty state', () => {
  const failingApi = (extra = {}) => makeApi({ list: vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(seed), ...extra });
  it('shows no "No data found" while loading', () => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(() => new Promise(() => {})) })} />);
    expect(screen.queryByText('No data found')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });
  it('shows ONLY the error + Retry (no false empty state, no fake zero metrics) when the load fails', async () => {
    renderAt('#records', <App api={failingApi()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('No data found')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('does not show the error state while searching a failed load, and recovers fully on retry', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={failingApi()} />);
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Homepage load time')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('No data found')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Summary' }));
    expect(within(screen.getByRole('region', { name: /summary/i })).getByText('Total records').nextSibling).toHaveTextContent('3');
  });
  it('keeps the error state if the retry also fails', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi({ list: vi.fn().mockRejectedValue(new Error('down')) })} />);
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.queryByText('No data found')).not.toBeInTheDocument();
  });
  it('shows the timeout error without an empty state', async () => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(() => new Promise(() => {})) })} timeoutMs={30} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/timed out|too long/i);
    expect(screen.queryByText('No data found')).not.toBeInTheDocument();
  });
  it('successful request with zero records shows "No data found" with add-a-record guidance', async () => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => []) })} />);
    expect(await screen.findByText('No data found')).toBeInTheDocument();
    expect(screen.getByText(/add a record/i, { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('successful request with no search matches shows "No data found" with search guidance', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi()} />);
    await screen.findByText('Homepage load time');
    await user.type(screen.getByLabelText(/search records/i), 'zzzz');
    expect(screen.getByText('No data found')).toBeInTheDocument();
    expect(screen.getByText(/different search/i)).toBeInTheDocument();
    expect(screen.queryByText(/add a record to get started/i)).not.toBeInTheDocument();
  });
  it('no matches from the status filter also gets search/filter guidance', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => [seed[0]]) })} />);
    await screen.findByText('Homepage load time');
    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'Completed');
    expect(screen.getByText('No data found')).toBeInTheDocument();
    expect(screen.getByText(/different search/i)).toBeInTheDocument();
  });
  it.each([[{}], ['oops'], [42], [true]])('treats malformed API payload %j as an empty successful load', async (payload) => {
    renderAt('#records', <App api={makeApi({ list: vi.fn(async () => payload) })} />);
    expect(await screen.findByText('No data found')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('does not show a stale error when a later request is superseded by unmount', async () => {
    const { unmount } = renderAt('#records', <App api={makeApi({ list: vi.fn(() => new Promise(() => {})) })} timeoutMs={5000} />);
    unmount();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('submission integrity and retry edge cases', () => {
  it('prevents duplicate submissions even when submit fires twice in the same tick', async () => {
    const user = userEvent.setup();
    let resolve;
    const add = vi.fn(() => new Promise((r) => { resolve = r; }));
    renderAt('#add-record', <App api={makeApi({ add })} />);
    await loaded();
    await fillForm(user);
    const form = screen.getByRole('button', { name: /add record/i }).closest('form');
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(add).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ id: 'n', name: 'Cache warmup', department: 'Engineering', current: 55, target: 85, status: 'Pending', notes: '' }); });
    await screen.findByText(/record added: cache warmup/i);
    expect(info.mock.calls.filter((c) => c[0] === ANALYTICS)).toHaveLength(1);
    await user.click(screen.getByRole('link', { name: 'Records' }));
    expect(screen.getAllByText('Cache warmup')).toHaveLength(1);
  });
  it('Retry re-validates: an invalid field is flagged and focused, nothing is sent, nothing is logged', async () => {
    const user = userEvent.setup();
    const add = vi.fn().mockRejectedValueOnce(new Error('boom')).mockImplementation(async (r) => ({ ...r, id: 'ok' }));
    renderAt('#add-record', <App api={makeApi({ add })} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByRole('alert');
    await user.clear(screen.getByLabelText(/current performance/i));
    await user.type(screen.getByLabelText(/current performance/i), '999');
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(add).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/current performance/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/current performance/i)).toHaveFocus();
    expect(screen.getByLabelText(/task or process name/i)).toHaveValue('Cache warmup');
    expect(info).not.toHaveBeenCalledWith(ANALYTICS);
  });
  it('a stale save-error alert is not shown next to fresh validation errors', async () => {
    const user = userEvent.setup();
    const add = vi.fn().mockRejectedValue(new Error('boom'));
    renderAt('#add-record', <App api={makeApi({ add })} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByRole('alert');
    await user.clear(screen.getByLabelText(/task or process name/i));
    await user.click(screen.getByRole('button', { name: /add record/i }));
    expect(screen.getByLabelText(/task or process name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/could not save/i)).not.toBeInTheDocument();
  });
  it('Retry while offline sends nothing, keeps data and logs nothing; reconnecting then retrying succeeds', async () => {
    const user = userEvent.setup();
    const add = vi.fn().mockRejectedValueOnce(new Error('boom')).mockImplementation(async (r) => ({ ...r, id: 'ok' }));
    renderAt('#add-record', <App api={makeApi({ add })} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByRole('alert');
    setOnline(false);
    fireEvent(window, new Event('offline'));
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(add).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent(/offline/i);
    expect(screen.getByLabelText(/task or process name/i)).toHaveValue('Cache warmup');
    expect(info).not.toHaveBeenCalledWith(ANALYTICS);
    setOnline(true);
    fireEvent(window, new Event('online'));
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText(/record added: cache warmup/i)).toBeInTheDocument();
    expect(info.mock.calls.filter((c) => c[0] === ANALYTICS)).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('does not reset the form while the save is still in flight', async () => {
    const user = userEvent.setup();
    let resolve;
    renderAt('#add-record', <App api={makeApi({ add: vi.fn(() => new Promise((r) => { resolve = r; })) })} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    expect(screen.getByLabelText(/task or process name/i)).toHaveValue('Cache warmup');
    await act(async () => { resolve({ id: 'n', name: 'Cache warmup', department: 'Engineering', current: 55, target: 85, status: 'Pending', notes: '' }); });
    await waitFor(() => expect(screen.getByLabelText(/task or process name/i)).toHaveValue(''));
  });
  it('normalizes values before saving (trimmed, collapsed whitespace, numeric)', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    renderAt('#add-record', <App api={api} />);
    await loaded();
    await fillForm(user, { name: '  Cache    warmup  ', current: ' 55.5 ', target: '80' });
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByText(/record added: cache warmup/i);
    expect(api.add).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cache warmup', current: 55.5, target: 80 }), expect.anything());
  });
});
