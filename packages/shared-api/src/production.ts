import type { Tables } from '@sasana/shared-types';
import type { ProductionValues } from '@sasana/shared-validation';
import type { SasanaClient } from './client';
import { toAppError } from './errors';
import type { TxResult } from './stock';

type ItemRef = { sku: string; name: string; base_unit: string } | null;

export type ProductionRow = Tables<'productions'> & {
  location: { name: string; code: string } | null;
  product: ItemRef;
  packaging: ItemRef;
  creator: { full_name: string } | null;
};

function unwrap<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw toAppError(res.error);
  return res.data as NonNullable<R['data']>;
}

const SELECT = `*,
  location:locations(name, code),
  product:items!productions_finished_item_id_fkey(sku, name, base_unit),
  packaging:items!productions_packaging_item_id_fkey(sku, name, base_unit),
  creator:profiles!productions_created_by_fkey(full_name)`;

export interface ProductionFilter {
  locationId?: string;
  /** YYYY-MM-DD, inklusif */
  from?: string;
  to?: string;
  limit?: number;
}

export async function listProductions(client: SasanaClient, f: ProductionFilter = {}): Promise<ProductionRow[]> {
  let q = client
    .from('productions')
    .select(SELECT)
    .order('production_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(f.limit ?? 100);
  if (f.locationId) q = q.eq('location_id', f.locationId);
  if (f.from) q = q.gte('production_date', f.from);
  if (f.to) q = q.lte('production_date', f.to);
  return unwrap(await q) as ProductionRow[];
}

export async function getProduction(client: SasanaClient, id: string): Promise<ProductionRow> {
  return unwrap(await client.from('productions').select(SELECT).eq('id', id).single()) as ProductionRow;
}

export async function createProduction(client: SasanaClient, idempotencyKey: string, v: ProductionValues): Promise<TxResult> {
  const data = unwrap(
    await client.rpc('create_production', {
      p_idempotency_key: idempotencyKey,
      p_location_id: v.location_id,
      p_finished_item_id: v.finished_item_id,
      p_unit_id: v.unit_id,
      p_qty_good: v.qty_good,
      p_qty_reject: v.qty_reject,
      p_production_date: v.production_date,
      p_notes: v.notes,
    }),
  );
  return data as unknown as TxResult;
}
