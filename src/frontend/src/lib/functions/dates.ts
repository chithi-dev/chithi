import type { DateTimeFormat } from 'intl';

const defaultFormat: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short'
};

/** Format a Unix timestamp (seconds) or ISO string to a localized date string */
export function formatDate(
  value: string | number | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return 'N/A';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  return date.toLocaleString(undefined, { ...defaultFormat, ...options });
}

/** Format a Unix timestamp (seconds) with long date style */
export function formatDateLong(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(new Date(ts * 1000));
}
