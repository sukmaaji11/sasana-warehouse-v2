/** Token desain Android. Sama dengan warna brand web (hijau jamu). */
export const colors = {
  primary: '#1F7A4D',
  primaryPressed: '#17603C',
  onPrimary: '#FFFFFF',
  background: '#F6F7F6',
  surface: '#FFFFFF',
  border: '#E2E5E3',
  text: '#16201B',
  textMuted: '#5D6B63',
  danger: '#C62828',
  dangerSurface: '#FDECEC',
  warning: '#B26A00',
  success: '#2E7D32',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 14 } as const;

export const font = {
  title: 24,
  heading: 18,
  body: 16,
  small: 14,
  /** Angka stok dibuat besar supaya mudah dibaca operator. */
  number: 28,
} as const;

/** Tinggi minimum area sentuh untuk operator lapangan. */
export const touchTarget = 52;
