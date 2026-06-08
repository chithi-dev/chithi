const fmt = (ts: number, dateStyle: Intl.DateTimeFormat['dateStyle'], timeStyle: Intl.DateTimeFormat['timeStyle'] = 'short') =>
  new Intl.DateTimeFormat('en-US', { dateStyle, timeStyle }).format(new Date(typeof ts === 'number' ? ts * 1000 : ts));

export function formatDate(value: string | number | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return 'N/A';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', ...options });
}

export function formatDateLong(ts: number): string { return fmt(ts, 'long'); }
