import { describe, it, expect, vi, afterEach } from 'vitest';
import { toCsv, toJson, exportFilename, buildExport, neutralizeFormula, downloadFile } from './exportData';

const rec = (over = {}) => ({ id: '1', name: 'Page load', department: 'Engineering', current: 60, target: 90, status: 'Pending', notes: '', ...over });
const HEADER = 'id,name,department,current,target,status,notes';
afterEach(() => vi.restoreAllMocks());

describe('toCsv', () => {
  it('exports only a header for empty or invalid input', () => {
    for (const input of [[], null, undefined, 'x', {}]) expect(toCsv(input)).toBe(HEADER);
  });
  it('writes numbers unquoted and preserves them (including 0 and decimals)', () => {
    expect(toCsv([rec({ current: 0, target: 55.5 })]).split('\r\n')[1]).toBe('1,Page load,Engineering,0,55.5,Pending,');
  });
  it('escapes commas, quotes and newlines', () => {
    const line = toCsv([rec({ name: 'A, "B"', notes: 'line1\nline2' })]).slice(HEADER.length + 2);
    expect(line).toBe('1,"A, ""B""",Engineering,60,90,Pending,"line1\nline2"');
  });
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=x', '\r=x'])('neutralizes formula injection in %j', (name) => {
    const out = toCsv([rec({ name, notes: name })]);
    expect(out.split('\r\n')[1]).toContain("'" + name.replace(/"/g, '""'));
  });
  it('does not alter harmless text or numbers', () => {
    expect(neutralizeFormula('Plain text')).toBe('Plain text');
    expect(neutralizeFormula("It's fine")).toBe("It's fine");
    expect(neutralizeFormula('=A1')).toBe("'=A1");
  });
  it('skips malformed records and blank values', () => {
    const out = toCsv([null, 'x', [], rec({ notes: null, current: null })]).split('\r\n');
    expect(out).toHaveLength(2);
    expect(out[1]).toBe('1,Page load,Engineering,,90,Pending,');
  });
  it('keeps the given order', () => {
    const out = toCsv([rec({ id: 'b', name: 'B' }), rec({ id: 'a', name: 'A' })]).split('\r\n');
    expect(out[1].startsWith('b,')).toBe(true);
    expect(out[2].startsWith('a,')).toBe(true);
  });
});

describe('toJson', () => {
  it('exports [] for empty input', () => { expect(toJson([])).toBe('[]'); expect(toJson(null)).toBe('[]'); });
  it('preserves numbers and exports only schema fields', () => {
    const parsed = JSON.parse(toJson([{ ...rec({ current: 55.5 }), secret: 'x' }, null]));
    expect(parsed).toEqual([{ id: '1', name: 'Page load', department: 'Engineering', current: 55.5, target: 90, status: 'Pending', notes: '' }]);
    expect(typeof parsed[0].current).toBe('number');
  });
  it('keeps raw text (formula neutralization is a CSV concern)', () => {
    expect(JSON.parse(toJson([rec({ name: '=1+1' })]))[0].name).toBe('=1+1');
  });
});

describe('filenames and builders', () => {
  it('uses the local date, zero-padded', () => {
    expect(exportFilename('csv', new Date(2026, 9, 17))).toBe('performance-records-2026-10-17.csv');
    expect(exportFilename('json', new Date(2026, 0, 5))).toBe('performance-records-2026-01-05.json');
  });
  it('builds csv and json payloads', () => {
    const d = new Date(2026, 9, 17);
    expect(buildExport('csv', [rec()], d)).toMatchObject({ filename: 'performance-records-2026-10-17.csv', mime: 'text/csv;charset=utf-8' });
    expect(buildExport('json', [rec()], d)).toMatchObject({ filename: 'performance-records-2026-10-17.json', mime: 'application/json' });
    expect(buildExport('csv', [], d).content).toBe(HEADER);
    expect(buildExport('json', [], d).content).toBe('[]');
    expect(() => buildExport('xml', [], d)).toThrow();
  });
});

describe('downloadFile', () => {
  it('creates a download link, clicks it and cleans up; CSV gets a UTF-8 BOM so Excel reads accents', () => {
    const blobs = [];
    URL.createObjectURL = vi.fn((b) => { blobs.push(b); return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    const clicked = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { clicked.push([this.download, this.href]); });
    downloadFile('f.csv', 'é', 'text/csv;charset=utf-8');
    downloadFile('f.json', 'é', 'application/json');
    expect(click).toHaveBeenCalledTimes(2);
    expect(clicked.map((c) => c[0])).toEqual(['f.csv', 'f.json']);
    expect(clicked.every((c) => c[1].includes('blob:x'))).toBe(true);
    expect(blobs[0].size).toBe(new TextEncoder().encode('é').length + 3);
    expect(blobs[1].size).toBe(new TextEncoder().encode('é').length);
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
