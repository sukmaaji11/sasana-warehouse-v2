/** Token desain Android. Sama dengan warna brand web (hijau jamu). */
export const colors = {
  primary: '#1F7A4D',
  primaryPressed: '#17603C',
  primarySurface: '#E8F3EC',
  primaryBorder: '#CDE5D6',
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
  warningSurface: '#FFF4E0',
  info: '#1565C0',
  infoSurface: '#E8F0FB',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 14 } as const;

export const font = {
  title: 20,
  heading: 16,
  body: 14,
  small: 12,
  /** Angka stok tetap besar supaya mudah dibaca operator. */
  number: 22,
} as const;

/** Tinggi minimum area sentuh untuk operator lapangan. */
export const touchTarget = 46;
