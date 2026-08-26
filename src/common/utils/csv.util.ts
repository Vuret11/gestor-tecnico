const BOM = '﻿'; // Necesario para que Excel abra UTF-8 correctamente

function escape(value: unknown): string {
  if (value == null) return '';
  const s = String(value).replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

export function buildCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
): string {
  const header = columns.map(c => escape(c.label)).join(',');
  const body = rows.map(row => columns.map(c => escape(row[c.key])).join(','));
  return BOM + [header, ...body].join('\r\n');
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}
