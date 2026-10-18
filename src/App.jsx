import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SummaryCards from './components/SummaryCards';
import RecordsTable from './components/RecordsTable';
import RecordForm from './components/RecordForm';
import EditRecord from './components/EditRecord';
import ThemeToggle from './components/ThemeToggle';
import ConfirmDialog from './components/ConfirmDialog';
import AnalyticsView from './components/AnalyticsView';
import ActivityView from './components/ActivityView';
import RangeInput from './components/RangeInput';
import { createDemoAdapter } from './lib/demoAdapter';
import { createActivityLog } from './lib/activityLog';
import { runRequest } from './lib/request';
import { useHashRoute } from './lib/hashRoute';
import { buildExport, downloadPayload } from './lib/exportData';
import { computeAnalytics } from './lib/analytics';
import { DEPARTMENTS, EMPTY_DRAFT, PAGE_SIZES, STATUSES, averageSource, computeSummary, filterRecords, normalizeRecord, paginate, parseRange, sortRecords } from './lib/records';

const ANALYTICS = '[Analytics] User interacted with Performance Optimization';
const OFFLINE_NOTICE = 'You are offline. Saving is paused and your entries are kept.';
const NAV = [
  { route: 'summary', label: 'Summary' },
  { route: 'records', label: 'Records' },
  { route: 'add-record', label: 'Add record' },
  { route: 'analytics', label: 'Analytics' },
  { route: 'activity', label: 'Activity' },
];
const HEADING_ID = { summary: 'summary-heading', records: 'records-heading', 'add-record': 'add-heading', 'edit-record': 'edit-heading', analytics: 'analytics-heading', activity: 'activity-heading' };
const NO_RANGES = { curMin: '', curMax: '', tgtMin: '', tgtMax: '' };
const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

export default function App({ api, timeoutMs = 8000, download = downloadPayload, activityLog }) {
  const adapter = useMemo(() => api ?? createDemoAdapter(), [api]);
  const log = useMemo(() => activityLog ?? createActivityLog(), [activityLog]);
  const [records, setRecords] = useState([]);
  const [load, setLoad] = useState({ status: 'loading', message: '' });
  const [online, setOnline] = useState(isOnline);
  const [notice, setNotice] = useState(() => (isOnline() ? null : { text: OFFLINE_NOTICE, kind: 'network' }));
  const { route, params, navigate } = useHashRoute();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [ranges, setRanges] = useState(NO_RANGES);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteState, setDeleteState] = useState({ busy: false, error: '' });
  const [exportError, setExportError] = useState('');
  const [activity, setActivity] = useState(() => log.list());
  const loadCtl = useRef(null);
  const loadId = useRef(0);
  const mutateCtl = useRef(null);
  const savingRef = useRef(false);
  const deletingRef = useRef(false);
  const restoreFocus = useRef(null);

  useEffect(() => {
    loadCtl.current?.abort();
    const ctl = new AbortController();
    loadCtl.current = ctl;
    const id = ++loadId.current;
    (async () => {
      try {
        const data = await runRequest(({ signal }) => adapter.list({ signal }), timeoutMs, ctl.signal);
        if (id !== loadId.current) return; // stale response
        setRecords(Array.isArray(data) ? data : []);
        setLoad({ status: 'ready', message: '' });
      } catch (err) {
        if (err?.name === 'AbortError' || id !== loadId.current) return;
        const reason = err?.name === 'TimeoutError' ? 'The request timed out because it took too long.' : 'Check your connection and try again.';
        setLoad({ status: 'error', message: `Could not load records. ${reason}` });
      }
    })();
    return () => { ctl.abort(); };
  }, [adapter, timeoutMs, reloadKey]);

  useEffect(() => () => { mutateCtl.current?.abort(); }, []);

  const handleRetry = useCallback(() => {
    setLoad({ status: 'loading', message: '' });
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const goOffline = () => { setOnline(false); setNotice({ text: OFFLINE_NOTICE, kind: 'network' }); };
    const goOnline = () => { setOnline(true); setNotice({ text: 'Back online.', kind: 'network' }); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  // ---- create / update / delete (all guarded against duplicates and offline use) ----
  const started = useCallback(() => { const ctl = new AbortController(); mutateCtl.current = ctl; return ctl; }, []);
  const succeeded = useCallback((type, record, text, noticeRoute) => {
    setActivity(log.record({ type, recordId: record?.id, recordName: record?.name }));
    setNotice({ text, kind: 'success', route: noticeRoute });
    console.info(ANALYTICS);
  }, [log]);

  const handleAdd = useCallback(async (values) => {
    if (savingRef.current) return false; // synchronous guard: state is stale within a tick
    if (!isOnline()) {
      setSubmitError({ scope: 'add', message: 'Cannot save while offline. Your entries are kept. Reconnect, then retry.', retryable: true });
      return false;
    }
    const ctl = started();
    savingRef.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      const record = normalizeRecord(values);
      const result = await runRequest(({ signal }) => adapter.add(record, { signal }), timeoutMs, ctl.signal);
      const saved = result && typeof result === 'object' ? result : record;
      setRecords((prev) => [...prev, saved]);
      succeeded('created', saved, `Record added: ${record.name}.`, 'add-record');
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
      setSubmitError({ scope: 'add', message: 'Could not save the record. Your entries are kept. Check your connection and retry.', retryable: true });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [adapter, timeoutMs, started, succeeded]);

  const handleUpdate = useCallback(async (id, values) => {
    if (savingRef.current) return false;
    const scope = `edit:${id}`;
    if (!isOnline()) {
      setSubmitError({ scope, message: 'Cannot save while offline. Your entries are kept. Reconnect, then retry.', retryable: true });
      return false;
    }
    const ctl = started();
    savingRef.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      const record = normalizeRecord(values);
      const result = await runRequest(({ signal }) => adapter.update(id, record, { signal }), timeoutMs, ctl.signal);
      const saved = result && typeof result === 'object' ? { ...result, id } : { ...record, id };
      setRecords((prev) => prev.map((r) => (r && r.id === id ? saved : r)));
      succeeded('updated', saved, `Record updated: ${record.name}.`, 'records');
      navigate('records', {}, { replace: true });
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
      setSubmitError({ scope, message: 'Could not save the record. Your entries are kept. Check your connection and retry.', retryable: true });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [adapter, timeoutMs, started, succeeded, navigate]);

  const requestDelete = useCallback((record, trigger) => {
    restoreFocus.current = trigger;
    setDeleteState({ busy: false, error: '' });
    setPendingDelete({ id: record.id, name: record.name });
  }, []);
  const cancelDelete = useCallback(() => { if (!deletingRef.current) setPendingDelete(null); }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || deletingRef.current) return;
    if (!isOnline()) { setDeleteState({ busy: false, error: 'Cannot delete while offline. Reconnect, then try again.' }); return; }
    const ctl = started();
    deletingRef.current = true;
    setDeleteState({ busy: true, error: '' });
    try {
      await runRequest(({ signal }) => adapter.remove(pendingDelete.id, { signal }), timeoutMs, ctl.signal);
      setRecords((prev) => prev.filter((r) => !(r && r.id === pendingDelete.id)));
      succeeded('deleted', pendingDelete, `Record deleted: ${pendingDelete.name}.`, 'records');
      restoreFocus.current = 'heading';
      setPendingDelete(null);
      setDeleteState({ busy: false, error: '' });
    } catch (err) {
      if (err?.name !== 'AbortError') setDeleteState({ busy: false, error: 'Could not delete the record. Check your connection and try again.' });
    } finally {
      deletingRef.current = false;
    }
  }, [pendingDelete, adapter, timeoutMs, started, succeeded]);

  // After the dialog closes, return focus to the trigger (cancel) or to the records heading (deleted).
  useEffect(() => {
    if (pendingDelete) return;
    const target = restoreFocus.current;
    restoreFocus.current = null;
    if (target === 'heading') document.getElementById('records-heading')?.focus();
    else if (target instanceof HTMLElement && target.isConnected) target.focus();
  }, [pendingDelete]);

  // ---- filters (status/focus live in the URL; the rest is local) ----
  const statusFilter = STATUSES.includes(params.status) ? params.status : 'All';
  const focusAverage = params.focus === 'average';
  const cur = useMemo(() => parseRange(ranges.curMin, ranges.curMax), [ranges.curMin, ranges.curMax]);
  const tgt = useMemo(() => parseRange(ranges.tgtMin, ranges.tgtMax), [ranges.tgtMin, ranges.tgtMax]);
  const filtersActive = query.trim() !== '' || statusFilter !== 'All' || focusAverage || department !== 'All' || Object.values(ranges).some((v) => v.trim() !== '');

  const clearLocalFilters = useCallback(() => { setQuery(''); setDepartment('All'); setRanges(NO_RANGES); setPage(1); }, []);

  const openFromCard = useCallback((kind) => {
    clearLocalFilters();
    setSort(kind === 'average' ? { key: 'current', dir: 'desc' } : { key: null, dir: 'asc' });
    if (kind === 'average') navigate('records', { focus: 'average' });
    else if (kind === 'completed') navigate('records', { status: 'Completed' });
    else if (kind === 'pending') navigate('records', { status: 'Pending' });
    else navigate('records');
  }, [navigate, clearLocalFilters]);

  const handleNavClick = (e, target) => {
    e.preventDefault();
    if (target === 'records') clearLocalFilters();
    navigate(target);
  };
  const handleStatusChange = (e) => {
    const v = e.target.value;
    setPage(1);
    navigate('records', { status: v === 'All' ? undefined : v, focus: focusAverage ? 'average' : undefined });
  };
  const resetFilters = () => { clearLocalFilters(); navigate('records'); };
  const skipToMain = (e) => { e.preventDefault(); document.getElementById('main')?.focus(); };
  const handleSort = useCallback((key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }, []);
  const handleEdit = useCallback((e, record) => { e.preventDefault(); navigate('edit-record', { id: record.id }); }, [navigate]);
  const handleCancelEdit = useCallback(() => navigate('records'), [navigate]);
  const handleInvalid = useCallback(() => setSubmitError(null), []);
  const setRange = (key) => (e) => { const v = e.target.value; setRanges((r) => ({ ...r, [key]: v })); setPage(1); };

  // Move focus to the new view's heading after a route change (not on first load).
  const prevRoute = useRef(route);
  useEffect(() => {
    if (prevRoute.current === route) return;
    prevRoute.current = route;
    document.getElementById(HEADING_ID[route])?.focus();
  }, [route]);

  // ---- derived data ----
  const summary = useMemo(() => computeSummary(records), [records]);
  const analytics = useMemo(() => computeAnalytics(records), [records]);
  const averageCount = useMemo(() => averageSource(records).length, [records]);
  const rows = useMemo(
    () => sortRecords(filterRecords(focusAverage ? averageSource(records) : records, {
      query, status: statusFilter, department: department === 'All' ? '' : department,
      currentMin: cur.min, currentMax: cur.max, targetMin: tgt.min, targetMax: tgt.max,
    }), sort.key, sort.dir),
    [records, query, statusFilter, department, focusAverage, cur, tgt, sort],
  );
  const pageInfo = useMemo(() => paginate(rows, page, pageSize), [rows, page, pageSize]);
  const editRecord = useMemo(() => records.find((r) => r && r.id === params.id), [records, params.id]);

  const exportAs = (format) => {
    try {
      download(buildExport(format, rows, new Date())); // all matching records, in the current sort order
      setExportError('');
      setNotice({ text: `Exported ${rows.length} record${rows.length === 1 ? '' : 's'} as ${format.toUpperCase()}.`, kind: 'success', route: 'records' });
    } catch {
      setExportError('Could not export the records. Please try again.');
    }
  };

  const loading = load.status === 'loading';
  const noticeText = notice && (notice.kind !== 'success' || notice.route === route) ? notice.text : '';
  const liveText = loading ? 'Loading performance records…' : noticeText;
  const activeNav = route === 'edit-record' ? 'records' : route;
  const formError = (scope) => (submitError?.scope === scope ? submitError : null);
  const modalOpen = Boolean(pendingDelete);

  return (
    <>
      <a className="skip" href="#main" onClick={skipToMain}>Skip to main content</a>
      <header className="app-header" inert={modalOpen ? '' : undefined}>
        <div className="container header-inner">
          <h1>Performance Optimization</h1>
          {!online && <span className="badge">Offline</span>}
          <nav aria-label="Dashboard sections">
            <ul>
              {NAV.map((n) => (
                <li key={n.route}>
                  <a href={`#${n.route}`} aria-current={activeNav === n.route ? 'page' : undefined} onClick={(e) => handleNavClick(e, n.route)}>{n.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="container" inert={modalOpen ? '' : undefined}>
        <div role="status" className={liveText ? 'live live--active' : 'live'}>
          {loading && <span className="spinner" aria-hidden="true" />}{liveText}
        </div>
        {load.status === 'error' && (
          <div role="alert" className="alert">
            <p><span aria-hidden="true">⚠ </span>{load.message}</p>
            <button type="button" className="btn btn--secondary" onClick={handleRetry}>Retry</button>
          </div>
        )}
        {route === 'summary' && <SummaryCards summary={summary} status={load.status} onSelect={openFromCard} />}
        {route === 'records' && (
          <section aria-labelledby="records-heading" id="view-records" className="panel">
            <h2 id="records-heading" tabIndex={-1}>Performance records</h2>
            <div className="toolbar">
              <div className="field">
                <label htmlFor="search">Search records</label>
                <input id="search" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="status-filter">Filter by status</label>
                <select id="status-filter" value={statusFilter} onChange={handleStatusChange}>
                  <option value="All">All statuses</option>
                  {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="department-filter">Filter by department</label>
                <select id="department-filter" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
                  <option value="All">All departments</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="page-size">Rows per page</label>
                <select id="page-size" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="toolbar">
              <fieldset>
                <legend>Current performance range</legend>
                <div className="range">
                  <RangeInput id="cur-min" label="Current min (%)" value={ranges.curMin} error={cur.errors.min} onChange={setRange('curMin')} />
                  <RangeInput id="cur-max" label="Current max (%)" value={ranges.curMax} error={cur.errors.max} onChange={setRange('curMax')} />
                </div>
              </fieldset>
              <fieldset>
                <legend>Target performance range</legend>
                <div className="range">
                  <RangeInput id="tgt-min" label="Target min (%)" value={ranges.tgtMin} error={tgt.errors.min} onChange={setRange('tgtMin')} />
                  <RangeInput id="tgt-max" label="Target max (%)" value={ranges.tgtMax} error={tgt.errors.max} onChange={setRange('tgtMax')} />
                </div>
              </fieldset>
            </div>
            <div className="toolbar-actions">
              {filtersActive && <button type="button" className="btn btn--secondary" onClick={resetFilters}>Reset filters</button>}
              <button type="button" className="btn btn--secondary" disabled={load.status !== 'ready'} onClick={() => exportAs('csv')}>Export CSV</button>
              <button type="button" className="btn btn--secondary" disabled={load.status !== 'ready'} onClick={() => exportAs('json')}>Export JSON</button>
            </div>
            {exportError && <div role="alert" className="alert"><p><span aria-hidden="true">⚠ </span>{exportError}</p></div>}
            {focusAverage && load.status === 'ready' && (
              <p className="context">{`Showing the ${averageCount} records used for the ${summary.average}% average performance.`}</p>
            )}
            {load.status === 'ready' && <p className="muted small count">{`Showing ${rows.length} of ${summary.total} records`}</p>}
            <RecordsTable rows={pageInfo.items} sort={sort} onSort={handleSort} status={load.status} filtered={filtersActive} onEdit={handleEdit} onDelete={requestDelete} />
            {load.status === 'ready' && pageInfo.totalPages > 1 && (
              <nav className="pager" aria-label="Pagination">
                <button type="button" className="btn btn--secondary" aria-disabled={pageInfo.page <= 1 ? 'true' : undefined} onClick={() => { if (pageInfo.page > 1) setPage(pageInfo.page - 1); }}>Previous</button>
                <span>{`Page ${pageInfo.page} of ${pageInfo.totalPages}`}</span>
                <button type="button" className="btn btn--secondary" aria-disabled={pageInfo.page >= pageInfo.totalPages ? 'true' : undefined} onClick={() => { if (pageInfo.page < pageInfo.totalPages) setPage(pageInfo.page + 1); }}>Next</button>
                <span className="muted">{`Rows ${pageInfo.start}–${pageInfo.end} of ${pageInfo.total}`}</span>
              </nav>
            )}
            <p className="muted small">Difference is current minus target, in percentage points (pp), not a relative change.</p>
          </section>
        )}
        {route === 'add-record' && (
          <RecordForm draft={draft} onDraftChange={setDraft} onSubmit={handleAdd} onInvalid={handleInvalid} saving={saving} submitError={formError('add')} />
        )}
        {route === 'edit-record' && load.status === 'ready' && (editRecord ? (
          <EditRecord key={editRecord.id} record={editRecord} onSave={handleUpdate} onCancel={handleCancelEdit} onInvalid={handleInvalid} saving={saving} submitError={formError(`edit:${editRecord.id}`)} />
        ) : (
          <section aria-labelledby="edit-heading" className="panel">
            <h2 id="edit-heading" tabIndex={-1}>Record not found</h2>
            <p>It may have been deleted, or the link is out of date.</p>
            <a className="btn btn--secondary" href="#records" onClick={(e) => handleNavClick(e, 'records')}>Back to records</a>
          </section>
        ))}
        {route === 'analytics' && <AnalyticsView analytics={analytics} status={load.status} />}
        {route === 'activity' && <ActivityView entries={activity} />}
        <p className="muted small">
          Demo data stored only in this browser. It is not shared with other employees or devices.
          {adapter.persistent === false && ' Browser storage is unavailable, so changes last only until this page is closed.'}
        </p>
      </main>
      {pendingDelete && (
        <ConfirmDialog
          title="Delete record?"
          message={`This permanently removes “${pendingDelete.name ?? 'this record'}” from this browser's demo data. This cannot be undone.`}
          confirmLabel="Delete record" busyLabel="Deleting…" busy={deleteState.busy} error={deleteState.error}
          onConfirm={confirmDelete} onCancel={cancelDelete}
        />
      )}
    </>
  );
}
