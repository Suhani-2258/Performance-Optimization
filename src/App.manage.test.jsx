import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { seed, makeApi, makeStatefulApi, ANALYTICS, setOnline, fillForm, renderAt, loaded, resetEnv } from './test/helpers';

let info;
beforeEach(() => { resetEnv(); setOnline(true); info = vi.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

const nav = () => screen.getByRole('navigation', { name: /dashboard sections/i });
const link = (name) => within(nav()).getByRole('link', { name });
const currentLinks = () => within(nav()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent);
const bodyRows = () => screen.queryAllByRole('row').slice(1);
const heading = (name) => screen.getByRole('heading', { level: 2, name });
const card = (re) => screen.getByRole('button', { name: re });
const logged = () => info.mock.calls.filter((c) => c[0] === ANALYTICS).length;
const field = (re) => screen.getByLabelText(re);

describe('editing records', () => {
  const openEdit = async (name = 'Editor autosave', api = makeStatefulApi()) => {
    const user = userEvent.setup();
    renderAt('#records', <App api={api} />);
    await screen.findByText(name);
    await user.click(screen.getByRole('link', { name: `Edit ${name}` }));
    return { user, api };
  };

  it('every row has an Edit link and a Delete button with a name that identifies the record', async () => {
    renderAt('#records', <App api={makeApi()} />);
    await screen.findByText('Editor autosave');
    for (const r of seed) {
      expect(screen.getByRole('link', { name: `Edit ${r.name}` })).toHaveAttribute('href', `#edit-record?id=${r.id}`);
      expect(screen.getByRole('button', { name: `Delete ${r.name}` })).toBeInTheDocument();
    }
  });
  it('opens an accessible form prefilled with the record, highlighting Records in the nav', async () => {
    await openEdit();
    expect(heading('Edit performance record')).toHaveFocus();
    expect(field(/task or process name/i)).toHaveValue('Editor autosave');
    expect(field(/^department/i)).toHaveValue('Editorial');
    expect(field(/current performance/i)).toHaveValue('80');
    expect(field(/target performance/i)).toHaveValue('95');
    expect(field(/^status/i)).toHaveValue('Completed');
    expect(field(/notes/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^add record$/i })).not.toBeInTheDocument();
    expect(currentLinks()).toEqual(['Records']);
  });
  it('works from a direct URL and after a refresh', async () => {
    const first = renderAt('#edit-record?id=3', <App api={makeApi()} />);
    await loaded();
    expect(field(/task or process name/i)).toHaveValue('Ad refresh rate');
    first.unmount();
    render(<App api={makeApi()} />);
    await loaded();
    expect(field(/task or process name/i)).toHaveValue('Ad refresh rate');
  });
  it('saves changes under the same id, updates the table and summary immediately, shows success, logs once', async () => {
    const { user, api } = await openEdit();
    await user.clear(field(/current performance/i));
    await user.type(field(/current performance/i), '85');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/record updated: editor autosave/i)).toBeInTheDocument();
    expect(api.update).toHaveBeenCalledWith('2', expect.objectContaining({ name: 'Editor autosave', department: 'Editorial', current: 85, target: 95, status: 'Completed' }), expect.anything());
    expect(heading('Performance records')).toBeInTheDocument();
    expect(window.location.hash).toBe('#records');
    expect(within(screen.getByRole('row', { name: /editor autosave/i })).getByText('85%')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
    expect(logged()).toBe(1);
    await user.click(link('Summary'));
    expect(card(/average performance.*62%/i)).toBeInTheDocument(); // (60 + 85 + 40) / 3
  });
  it('a status change moves the record between summary counts', async () => {
    const { user } = await openEdit('Ad refresh rate');
    await user.selectOptions(field(/^status/i), 'Completed');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByText(/record updated/i);
    await user.click(link('Summary'));
    expect(card(/completed tasks.*2/i)).toBeInTheDocument();
    expect(card(/pending tasks.*0/i)).toBeInTheDocument();
  });
  it('reuses the validation rules: flags invalid fields, focuses the first, sends nothing, logs nothing', async () => {
    const { user, api } = await openEdit();
    await user.clear(field(/task or process name/i));
    await user.clear(field(/current performance/i));
    await user.type(field(/current performance/i), '150');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(field(/task or process name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(field(/task or process name/i)).toHaveFocus();
    expect(document.getElementById(field(/current performance/i).getAttribute('aria-describedby'))).toHaveTextContent(/0.*100/);
    expect(api.update).not.toHaveBeenCalled();
    expect(logged()).toBe(0);
  });
  it('keeps entered data and stays on the form when saving fails; Retry succeeds and logs once', async () => {
    const update = vi.fn().mockRejectedValueOnce(new Error('boom')).mockImplementation(async (id, r) => ({ ...r, id }));
    const { user } = await openEdit('Editor autosave', makeApi({ update }));
    await user.clear(field(/notes/i));
    await user.type(field(/notes/i), 'my edit');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(heading('Edit performance record')).toBeInTheDocument();
    expect(field(/notes/i)).toHaveValue('my edit');
    expect(logged()).toBe(0);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText(/record updated/i)).toBeInTheDocument();
    expect(update).toHaveBeenCalledTimes(2);
    expect(logged()).toBe(1);
  });
  it('prevents duplicate submissions fired in the same tick', async () => {
    let resolve;
    const update = vi.fn(() => new Promise((r) => { resolve = r; }));
    await openEdit('Editor autosave', makeApi({ update }));
    const form = screen.getByRole('button', { name: /save changes/i }).closest('form');
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(update).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    await act(async () => { resolve({ ...seed[1] }); });
    await screen.findByText(/record updated/i);
    expect(logged()).toBe(1);
  });
  it('blocks saving while offline and keeps the data', async () => {
    const { user, api } = await openEdit();
    await user.type(field(/notes/i), 'offline edit');
    setOnline(false);
    fireEvent(window, new Event('offline'));
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(api.update).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/offline/i);
    expect(field(/notes/i)).toHaveValue('offline edit');
  });
  it('Cancel returns to the records without saving', async () => {
    const { user, api } = await openEdit();
    await user.type(field(/notes/i), 'discard me');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(heading('Performance records')).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
    expect(logged()).toBe(0);
  });
  it('shows "Record not found" (not a form) for unknown or missing ids, but not while still loading', async () => {
    renderAt('#edit-record?id=nope', <App api={makeApi()} />);
    expect(await screen.findByText(/record not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to records/i })).toHaveAttribute('href', '#records');
    expect(screen.queryByLabelText(/task or process name/i)).not.toBeInTheDocument();
  });
  it('does not flash "Record not found" while records are loading', async () => {
    let resolve;
    renderAt('#edit-record?id=2', <App api={makeApi({ list: vi.fn(() => new Promise((r) => { resolve = r; })) })} />);
    expect(screen.queryByText(/record not found/i)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    await act(async () => { resolve(seed); });
    expect(await screen.findByDisplayValue('Editor autosave')).toBeInTheDocument();
  });
  it('shows no "not found" message when loading failed', async () => {
    renderAt('#edit-record?id=2', <App api={makeApi({ list: vi.fn().mockRejectedValue(new Error('x')) })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.queryByText(/record not found/i)).not.toBeInTheDocument();
  });
  it('renders malicious-looking names as plain text in the table and the edit form', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    const api = makeStatefulApi([{ ...seed[0], name: evil }]);
    renderAt('#records', <App api={api} />);
    expect(await screen.findByText(evil)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: `Edit ${evil}` }));
    expect(field(/task or process name/i)).toHaveValue(evil);
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('deleting records', () => {
  const openDelete = async (name = 'Editor autosave', api = makeStatefulApi()) => {
    const user = userEvent.setup();
    renderAt('#records', <App api={api} />);
    await screen.findByText(name);
    const trigger = screen.getByRole('button', { name: `Delete ${name}` });
    await user.click(trigger);
    return { user, api, trigger, dialog: screen.getByRole('alertdialog') };
  };

  it('asks for confirmation in an accessible modal dialog with Cancel and Confirm, focusing Cancel first', async () => {
    const { dialog } = await openDelete();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/delete record/i);
    expect(dialog).toHaveAccessibleDescription(/editor autosave/i);
    expect(within(dialog).getByRole('button', { name: /^cancel$/i })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: /delete record/i })).toBeInTheDocument();
  });
  it('Cancel closes the dialog, keeps the record, returns focus to the trigger, sends and logs nothing', async () => {
    const { user, api, trigger, dialog } = await openDelete();
    await user.click(within(dialog).getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Editor autosave')).toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(api.remove).not.toHaveBeenCalled();
    expect(logged()).toBe(0);
  });
  it('Escape cancels', async () => {
    const { user, api } = await openDelete();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.remove).not.toHaveBeenCalled();
  });
  it('traps keyboard focus inside the dialog in both directions', async () => {
    const { user, dialog } = await openDelete();
    const cancel = within(dialog).getByRole('button', { name: /^cancel$/i });
    const confirm = within(dialog).getByRole('button', { name: /delete record/i });
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });
  it('Confirm deletes by id, updates the table and summary, shows success, logs once and moves focus to the heading', async () => {
    const { user, api, dialog } = await openDelete();
    await user.click(within(dialog).getByRole('button', { name: /delete record/i }));
    expect(await screen.findByText(/record deleted: editor autosave/i)).toBeInTheDocument();
    expect(api.remove).toHaveBeenCalledWith('2', expect.anything());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Editor autosave')).not.toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);
    expect(heading('Performance records')).toHaveFocus();
    expect(logged()).toBe(1);
    await user.click(link('Summary'));
    expect(card(/total records.*2/i)).toBeInTheDocument();
    expect(card(/completed tasks.*0/i)).toBeInTheDocument();
    expect(card(/average performance.*50%/i)).toBeInTheDocument(); // (60 + 40) / 2
  });
  it('deleting the last record shows the empty state', async () => {
    const { user, dialog } = await openDelete('Ad refresh rate', makeStatefulApi([seed[2]]));
    await user.click(within(dialog).getByRole('button', { name: /delete record/i }));
    expect(await screen.findByText('No data found')).toBeInTheDocument();
  });
  it('failed delete: dialog stays, record stays, error shown, then Confirm again succeeds', async () => {
    const base = makeStatefulApi();
    base.remove = vi.fn().mockRejectedValueOnce(new Error('boom')).mockImplementation(async (id) => ({ id }));
    const { user, dialog } = await openDelete('Editor autosave', base);
    await user.click(within(dialog).getByRole('button', { name: /delete record/i }));
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent(/could not delete/i);
    expect(screen.getByText('Editor autosave')).toBeInTheDocument();
    expect(logged()).toBe(0);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /delete record/i }));
    expect(await screen.findByText(/record deleted/i)).toBeInTheDocument();
    expect(screen.queryByText('Editor autosave')).not.toBeInTheDocument();
    expect(base.remove).toHaveBeenCalledTimes(2);
    expect(logged()).toBe(1);
  });
  it('prevents duplicate deletions fired in the same tick', async () => {
    let resolve;
    const api = makeStatefulApi();
    api.remove = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { dialog } = await openDelete('Editor autosave', api);
    const confirm = within(dialog).getByRole('button', { name: /delete record/i });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(api.remove).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ id: '2' }); });
    await screen.findByText(/record deleted/i);
    expect(logged()).toBe(1);
  });
  it('blocks deleting while offline', async () => {
    const { user, api, dialog } = await openDelete();
    setOnline(false);
    fireEvent(window, new Event('offline'));
    await user.click(within(dialog).getByRole('button', { name: /delete record/i }));
    expect(api.remove).not.toHaveBeenCalled();
    expect(within(screen.getByRole('alertdialog')).getByRole('alert')).toHaveTextContent(/offline/i);
  });
  it('is fully operable by keyboard', async () => {
    const user = userEvent.setup();
    renderAt('#records', <App api={makeStatefulApi()} />);
    await screen.findByText('Editor autosave');
    screen.getByRole('button', { name: 'Delete Editor autosave' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.keyboard('{Tab}{Enter}');
    expect(await screen.findByText(/record deleted/i)).toBeInTheDocument();
  });
});

describe('recent activity history', () => {
  const list = () => screen.getByRole('list', { name: /activity entries/i });
  const items = () => within(list()).getAllByRole('listitem');

  it('starts empty with a clear browser-local, non-audit disclaimer', async () => {
    renderAt('#activity', <App api={makeApi()} />);
    await loaded();
    expect(heading('Recent activity')).toBeInTheDocument();
    expect(currentLinks()).toEqual(['Activity']);
    expect(screen.getByText('No data found')).toBeInTheDocument();
    expect(screen.getByText(/browser-local demo activity history/i)).toBeInTheDocument();
    expect(screen.getByText(/not a secure, centralized or multi-user audit log/i)).toBeInTheDocument();
  });
  it('records created, updated and deleted actions, newest first, with names and ISO timestamps', async () => {
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeStatefulApi()} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByText(/record added/i);
    await user.click(link('Records'));
    await user.click(screen.getByRole('link', { name: 'Edit Cache warmup' }));
    await user.type(field(/notes/i), ' more');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByText(/record updated/i);
    await user.click(screen.getByRole('button', { name: 'Delete Cache warmup' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /delete record/i }));
    await screen.findByText(/record deleted/i);
    await user.click(link('Activity'));
    expect(items()).toHaveLength(3);
    expect(items()[0]).toHaveTextContent(/deleted.*cache warmup/i);
    expect(items()[1]).toHaveTextContent(/updated.*cache warmup/i);
    expect(items()[2]).toHaveTextContent(/created.*cache warmup/i);
    for (const li of items()) expect(li.querySelector('time').getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
  it('persists in this browser across a reload', async () => {
    const user = userEvent.setup();
    const first = renderAt('#add-record', <App api={makeStatefulApi()} />);
    await loaded();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByText(/record added/i);
    first.unmount();
    renderAt('#activity', <App api={makeApi()} />);
    expect(items()).toHaveLength(1);
    expect(items()[0]).toHaveTextContent(/created.*cache warmup/i);
  });
  it('does not record failed or invalid actions', async () => {
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeApi({ add: vi.fn().mockRejectedValue(new Error('x')) })} />);
    await loaded();
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByRole('alert');
    await user.click(link('Activity'));
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });
  it('survives corrupted storage', async () => {
    localStorage.setItem('news-blog:perf-activity:v1', '{bad json');
    renderAt('#activity', <App api={makeApi()} />);
    expect(await screen.findByText('No data found')).toBeInTheDocument();
  });
  it('renders record names as plain text', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    const user = userEvent.setup();
    renderAt('#add-record', <App api={makeStatefulApi()} />);
    await loaded();
    await fillForm(user, { name: evil });
    await user.click(screen.getByRole('button', { name: /add record/i }));
    await screen.findByText(/record added/i);
    await user.click(link('Activity'));
    expect(within(list()).getByText(new RegExp('created', 'i'))).toBeInTheDocument();
    expect(items()[0]).toHaveTextContent(evil);
    expect(document.querySelector('img')).toBeNull();
  });
});
