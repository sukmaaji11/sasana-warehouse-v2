/**
 * Kode error yang dikembalikan RPC database (RAISE ... USING ERRCODE / message prefix).
 * Pesan ditampilkan ke operator dalam Bahasa Indonesia.
 */
export const ERROR_MESSAGES = {
  NOT_AUTHENTICATED: 'Sesi berakhir. Silakan login kembali.',
  ACCOUNT_INACTIVE: 'Akun Anda dinonaktifkan. Hubungi Super Owner.',
  PROFILE_NOT_FOUND: 'Profil akun belum dibuat. Hubungi Super Owner.',
  FORBIDDEN: 'Anda tidak memiliki izin untuk tindakan ini.',
  FORBIDDEN_LOCATION: 'Anda tidak memiliki akses ke lokasi ini.',
  INVALID_CREDENTIALS: 'Username atau password salah.',
  INSUFFICIENT_STOCK: 'Stok tidak mencukupi.',
  INVALID_STATUS: 'Status transaksi sudah berubah. Muat ulang data.',
  NETWORK: 'Tidak ada koneksi internet. Transaksi belum dikirim.',
  VALIDATION: 'Data tidak valid. Periksa kembali isian Anda.',
  NOT_FOUND: 'Data tidak ditemukan.',
  DUPLICATE: 'Data dengan nama atau kode yang sama sudah ada.',
  USERNAME_TAKEN: 'Username sudah dipakai.',
  SELF_LOCKOUT: 'Anda tidak bisa menurunkan role atau menonaktifkan akun sendiri.',
  BASE_UNIT_LOCKED: 'Satuan dasar tidak bisa diubah dari sini.',
  ITEM_TYPE_LOCKED: 'Tipe barang tidak bisa diubah karena sudah dipakai di mapping packaging.',
  INVALID_ITEM_TYPE: 'Tipe barang tidak sesuai (produk jadi ↔ packaging).',
  IDEMPOTENCY_CONFLICT: 'Transaksi ini sudah pernah dikirim. Muat ulang halaman.',
  UNKNOWN: 'Terjadi kesalahan. Coba lagi.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function isErrorCode(value: string): value is ErrorCode {
  return value in ERROR_MESSAGES;
}
