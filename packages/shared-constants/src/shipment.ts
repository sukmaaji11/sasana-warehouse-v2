export const SHIPMENT_STATUSES = ['CREATED', 'ASSIGNED', 'PICKED_UP', 'RECEIVED', 'CANCELLED'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  CREATED: 'Belum ada driver',
  ASSIGNED: 'Siap pickup',
  PICKED_UP: 'Dalam perjalanan',
  RECEIVED: 'Diterima',
  CANCELLED: 'Dibatalkan',
};

/** Warna status (hex) yang sama di web & Android agar mudah dibedakan. */
export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, { bg: string; fg: string }> = {
  CREATED: { bg: '#F1F3F5', fg: '#495057' },
  ASSIGNED: { bg: '#FFF4E5', fg: '#B26A00' },
  PICKED_UP: { bg: '#E7F1FF', fg: '#1A5FB4' },
  RECEIVED: { bg: '#E8F5E9', fg: '#2E7D32' },
  CANCELLED: { bg: '#FDECEC', fg: '#C62828' },
};

/** Status yang masih berjalan (belum selesai). */
export const SHIPMENT_ACTIVE: readonly ShipmentStatus[] = ['CREATED', 'ASSIGNED', 'PICKED_UP'];
