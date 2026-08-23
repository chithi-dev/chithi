function toZdt(instant: Temporal.Instant) {
  return instant.toZonedDateTimeISO(Temporal.Now.timeZoneId());
}

export function formatDate(value: string | number | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return 'N/A';
  try {
    const instant = Temporal.Instant.from(String(value));
    return toZdt(instant).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', ...options });
  } catch { return 'N/A'; }
}

export function formatDateLong(ts: number): string {
  try {
    const instant = Temporal.Instant.from(ts.toString());
    return toZdt(instant).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  } catch { return 'N/A'; }
}
