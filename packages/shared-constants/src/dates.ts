/** Zona waktu operasional. Semua "hari ini" mengikuti WIB. */
export const TIMEZONE = 'Asia/Jakarta';

/** Q16: transaksi boleh mundur maksimal 7 hari, tidak boleh masa depan. */
export const MAX_BACKDATE_DAYS = 7;

/** Tanggal hari ini di WIB, format YYYY-MM-DD. */
export function todayWib(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(now);
}

/** Geser tanggal YYYY-MM-DD sebanyak n hari. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function minTransactionDate(now: Date = new Date()): string {
  return addDays(todayWib(now), -MAX_BACKDATE_DAYS);
}

/** "12 Nov 2026" */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${isoDate.slice(0, 10)}T00:00:00Z`),
  );
}

/** "12 Nov 2026 14.05" dalam WIB */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}
