import type { MovementType } from '@sasana/shared-constants';
import type { Tables } from '@sasana/shared-types';
import type { AdjustmentValues, InboundValues, VoidValues } from '@sasana/shared-validation';
import type { SasanaClient } from './client';
import { toAppError } from './errors';

export type StockLevel = Tables<'stock_levels'>;
export type StockMovement = Tables<'stock_movements'> & {
  item: { sku: string; name: string; base_unit: string } | null;
  location: { name: string } | null;
};
export type InboundRow = Tables<'inbound_transactions'> & {
  vendor: { name: string } | null;
  creator: { full_name: string } | null;
  inbound_items: (Tables<'inbound_items'> & { item: { sku: string; name: string; base_unit: string } | null })[];
};
export type AdjustmentRow = Tables<'stock_adjustments'> & {
  location: { name: string } | null;
  creator: { full_name: string } | null;
  stock_adjustment_items: (Tables<'stock_adjustment_items'> & {
    item: { sku: string; name: string; base_unit: string } | null;
  })[];
};

/** Hasil RPC transaksi. replayed = request ulang dengan idempotency key yang sama. */
export interface TxResult {
  id: string;
  doc_no: string;
  replayed: boolean;
}

function unwrap<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw toAppError(res.error);
  return res.data as NonNullable<R['data']>;
}

// ---------- Stok ----------
export async function listStockLevels(client: SasanaClient): Promise<StockLevel[]> {
  return unwrap(await client.from('stock_levels').select('*').order('sku').order('location_name'));
}

export interface MovementFilter {
  itemId?: string;
  locationId?: string;
  type?: MovementType;
  /** YYYY-MM-DD (WIB), inklusif */
  from?: string;
  to?: string;
  limit?: number;
}

export async function listMovements(client: SasanaClient, f: MovementFilter = {}): Promise<StockMovement[]> {
  let q = client
    .from('stock_movements')
    .select('*, item:items(sku, name, base_unit), location:locations!stock_movements_location_id_fkey(name)')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(f.limit ?? 200);
  if (f.itemId) q = q.eq('item_id', f.itemId);
  if (f.locationId) q = q.eq('location_id', f.locationId);
  if (f.type) q = q.eq('movement_type', f.type);
  if (f.from) q = q.gte('created_at', `${f.from}T00:00:00+07:00`);
  if (f.to) q = q.lte('created_at', `${f.to}T23:59:59.999+07:00`);
  return unwrap(await q) as StockMovement[];
}

// ---------- Inbound ----------
const INBOUND_SELECT =
  '*, vendor:vendors(name), creator:profiles!inbound_transactions_created_by_fkey(full_name), inbound_items(*, item:items(sku, name, base_unit))';

export async function listInbounds(client: SasanaClient, limit = 100): Promise<InboundRow[]> {
  return unwrap(
    await client
      .from('inbound_transactions')
      .select(INBOUND_SELECT)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
  ) as InboundRow[];
}

export async function getInbound(client: SasanaClient, id: string): Promise<InboundRow> {
  return unwrap(await client.from('inbound_transactions').select(INBOUND_SELECT).eq('id', id).single()) as InboundRow;
}

export async function createInbound(client: SasanaClient, idempotencyKey: string, v: InboundValues): Promise<TxResult> {
  const data = unwrap(
    await client.rpc('create_inbound', {
      p_idempotency_key: idempotencyKey,
      p_vendor_id: v.vendor_id,
      p_transaction_date: v.transaction_date,
      p_notes: v.notes,
      p_items: v.items,
    }),
  );
  return data as unknown as TxResult;
}

// ---------- Stok awal & penyesuaian ----------
const ADJ_SELECT =
  '*, location:locations(name), creator:profiles!stock_adjustments_created_by_fkey(full_name), stock_adjustment_items(*, item:items(sku, name, base_unit))';

export async function listAdjustments(client: SasanaClient, limit = 100): Promise<AdjustmentRow[]> {
  return unwrap(
    await client.from('stock_adjustments').select(ADJ_SELECT).order('created_at', { ascending: false }).limit(limit),
  ) as AdjustmentRow[];
}

export async function getAdjustment(client: SasanaClient, id: string): Promise<AdjustmentRow> {
  return unwrap(await client.from('stock_adjustments').select(ADJ_SELECT).eq('id', id).single()) as AdjustmentRow;
}

export async function createAdjustment(client: SasanaClient, idempotencyKey: string, v: AdjustmentValues): Promise<TxResult> {
  const data = unwrap(
    await client.rpc('create_stock_adjustment', {
      p_idempotency_key: idempotencyKey,
      p_kind: v.kind,
      p_location_id: v.location_id,
      p_reason: v.reason,
      p_adjustment_date: v.adjustment_date,
      p_items: v.items,
    }),
  );
  return data as unknown as TxResult;
}

// ---------- Void (Super Owner) ----------
export type VoidableRef = 'inbound' | 'stock_adjustment';

export async function voidTransaction(client: SasanaClient, refType: VoidableRef, refId: string, v: VoidValues): Promise<void> {
  unwrap(await client.rpc('void_transaction', { p_ref_type: refType, p_ref_id: refId, p_reason: v.reason }));
}

// ---------- Produk per pabrik (Q8) ----------
export async function listProductLocations(client: SasanaClient): Promise<Tables<'product_locations'>[]> {
  return unwrap(await client.from('product_locations').select('*'));
}

export async function setProductLocation(
  client: SasanaClient,
  finishedItemId: string,
  locationId: string,
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    unwrap(
      await client
        .from('product_locations')
        .upsert({ finished_item_id: finishedItemId, location_id: locationId }, { onConflict: 'finished_item_id,location_id', ignoreDuplicates: true }),
    );
  } else {
    unwrap(
      await client.from('product_locations').delete().eq('finished_item_id', finishedItemId).eq('location_id', locationId),
    );
  }
}
