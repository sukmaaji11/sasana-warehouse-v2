/**
 * Opsi query `get_my_context` yang sama untuk Android & web.
 * Error akun (profil tidak ada / tidak login) bukan error sementara:
 * jangan di-retry dan jangan refetch otomatis saat komponen dipasang,
 * agar tidak terjadi loop request.
 */
const PERMANENT = new Set(['PROFILE_NOT_FOUND', 'NOT_AUTHENTICATED', 'ACCOUNT_INACTIVE', 'FORBIDDEN']);

export const myContextQueryOptions = {
  staleTime: 60_000,
  retryOnMount: false,
  retry: (failureCount: number, error: Error) =>
    !PERMANENT.has((error as Error & { code?: string }).code ?? '') && failureCount < 2,
} as const;
