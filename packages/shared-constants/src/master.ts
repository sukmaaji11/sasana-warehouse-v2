export const LOCATION_TYPES = ['WAREHOUSE', 'FACTORY', 'SALES_WAREHOUSE'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  WAREHOUSE: 'Gudang',
  FACTORY: 'Pabrik',
  SALES_WAREHOUSE: 'Gudang Penjualan',
};

export const ITEM_TYPES = ['PACKAGING', 'FINISHED_GOOD'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  PACKAGING: 'Packaging',
  FINISHED_GOOD: 'Produk Jadi',
};

export const DEFAULT_MIN_STOCK = 100;
