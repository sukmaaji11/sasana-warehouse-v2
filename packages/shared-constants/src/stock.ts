export const MOVEMENT_TYPES = [
  'INBOUND',
  'SHIPMENT_PICKUP',
  'SHIPMENT_RECEIVE',
  'SHIPMENT_RETURN',
  'PRODUCTION_CONSUME',
  'PRODUCTION_RESULT',
  'DISTRIBUTION',
  'OPENING_BALANCE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'VOID_REVERSAL',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  INBOUND: 'Inbound vendor',
  SHIPMENT_PICKUP: 'Shipment keluar',
  SHIPMENT_RECEIVE: 'Shipment masuk',
  SHIPMENT_RETURN: 'Shipment batal kirim',
  PRODUCTION_CONSUME: 'Pemakaian produksi',
  PRODUCTION_RESULT: 'Hasil produksi',
  DISTRIBUTION: 'Distribusi',
  OPENING_BALANCE: 'Stok awal',
  ADJUSTMENT_IN: 'Penyesuaian (+)',
  ADJUSTMENT_OUT: 'Penyesuaian (−)',
  VOID_REVERSAL: 'Pembatalan (void)',
};

export const ADJUSTMENT_KINDS = ['OPENING_BALANCE', 'ADJUSTMENT'] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];
export const ADJUSTMENT_KIND_LABELS: Record<AdjustmentKind, string> = {
  OPENING_BALANCE: 'Stok awal',
  ADJUSTMENT: 'Penyesuaian / stock opname',
};

export function formatQty(n: number): string {
  return n.toLocaleString('id-ID');
}
