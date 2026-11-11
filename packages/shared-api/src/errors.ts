import { ERROR_MESSAGES, isErrorCode, type ErrorCode } from '@sasana/shared-constants';

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

  const prefix = message.split(':')[0]?.trim() ?? '';
  if (isErrorCode(prefix)) return new AppError(prefix, ERROR_MESSAGES[prefix], error);

  if (e.code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new AppError('INVALID_CREDENTIALS', undefined, error);
  }
  if (e.code === '42501') return new AppError('FORBIDDEN', undefined, error);
  if (
    e.name === 'AuthRetryableFetchError' ||
    e.name === 'TypeError' ||
    /network request failed|failed to fetch|fetch failed/i.test(message)
  ) {
    return new AppError('NETWORK', undefined, error);
  }
  return new AppError('UNKNOWN', undefined, error);
}
