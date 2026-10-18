import { cleanRecords } from './records';

const COLUMNS = ['id', 'name', 'department', 'current', 'target', 'status', 'notes'];

// Spreadsheets run text that starts with = + - @ (or tab/CR) as a formula. A leading apostrophe makes it text.
export function neutralizeFormula(value) {
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
const escapeCsv = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

function cell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return escapeCsv(neutralizeFormula(value));
}

export function toCsv(records) {
  const rows = cleanRecords(records).map((r) => COLUMNS.map((c) => cell(r[c])).join(','));
  return [COLUMNS.join(','), ...rows].join('\r\n');
}

export function toJson(records) {
  const pick = (r) => Object.fromEntries(COLUMNS.filter((c) => r[c] !== undefined).map((c) => [c, r[c]]));
  return JSON.stringify(cleanRecords(records).map(pick), null, 2);
}

const pad = (n) => String(n).padStart(2, '0');
export const exportFilename = (ext, now = new Date()) =>
  `performance-records-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${ext}`;

export function buildExport(format, records, now = new Date()) {
  if (format === 'csv') return { filename: exportFilename('csv', now), mime: 'text/csv;charset=utf-8', content: toCsv(records) };
  if (format === 'json') return { filename: exportFilename('json', now), mime: 'application/json', content: toJson(records) };
  throw new Error(`Unsupported export format: ${format}`);
}

export function downloadFile(filename, content, mime) {
  // A UTF-8 byte order mark lets Excel read accented characters in CSV correctly.
  const parts = mime.startsWith('text/csv') ? ['\uFEFF', content] : [content];
  const url = URL.createObjectURL(new Blob(parts, { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const downloadPayload = ({ filename, content, mime }) => downloadFile(filename, content, mime);
