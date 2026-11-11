import { ERROR_MESSAGES, isErrorCode, type ErrorCode } from '@sasana/shared-constants';

/** Kode error yang detail dari server-nya lebih berguna daripada pesan umum. */
const DETAIL_CODES = new Set<ErrorCode>(['VALIDATION', 'INSUFFICIENT_STOCK', 'NOT_FOUND', 'INVALID_ITEM_TYPE']);

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string = ERROR_MESSAGES[code],
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

interface ErrorLike {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
}

/**
 * Normalisasi error dari supabase-js (PostgREST, Auth, fetch) menjadi AppError
 * dengan pesan Bahasa Indonesia. RPC database memakai pesan berupa kode (mis. 'INSUFFICIENT_STOCK: ...').
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as ErrorLike;
  const message = e.message ?? '';

  const [prefix = '', ...rest] = message.split(':');
  const code = prefix.trim();
  if (isErrorCode(code)) {
    // 'VALIDATION: nama wajib diisi' → tampilkan detail dari server bila ada.
    const detail = rest.join(':').trim();
    const msg = DETAIL_CODES.has(code) && detail ? capitalize(detail) : ERROR_MESSAGES[code];
    return new AppError(code, msg, error);
  }

  if (e.code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new AppError('INVALID_CREDENTIALS', undefined, error);
  }
  if (e.code === '42501') return new AppError('FORBIDDEN', undefined, error);
  if (e.code === '23505') return new AppError('DUPLICATE', undefined, error);
  if (e.code === '23514' || e.code === '22P02') return new AppError('VALIDATION', undefined, error);
  if (
    e.name === 'AuthRetryableFetchError' ||
    e.name === 'TypeError' ||
    /network request failed|failed to fetch|fetch failed/i.test(message)
  ) {
    return new AppError('NETWORK', undefined, error);
  }
  return new AppError('UNKNOWN', undefined, error);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
