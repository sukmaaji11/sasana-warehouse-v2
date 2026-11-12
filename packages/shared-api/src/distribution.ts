import type { Tables } from '@sasana/shared-types';
import type { MyContext } from '@sasana/shared-types';
import type { DistributionValues } from '@sasana/shared-validation';
import type { SasanaClient } from './client';
import { toAppError } from './errors';
import type { TxResult } from './stock';

export type DistributionRow = Tables<'distributions'> & {
  location: { name: string; code: string } | null;
  creator: { full_name: string } | null;
  distribution_items: (Tables<'distribution_items'> & { item: { sku: string; name: string; base_unit: string } | null })[];
};

function unwrap<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw toAppError(res.error);
  return res.data as NonNullable<R['data']>;
}

const SELECT = `*,
  location:locations(name, code),
  creator:profiles!distributions_created_by_fkey(full_name),
  distribution_items(*, item:items(sku, name, base_unit))`;

export interface DistributionFilter {
  locationId?: string;
  buyerId?: string;
  limit?: number;
}

export async function listDistributions(client: SasanaClient, f: DistributionFilter = {}): Promise<DistributionRow[]> {
  let q = client
    .from('distributions')
    .select(SELECT)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(f.limit ?? 100);
  if (f.locationId) q = q.eq('location_id', f.locationId);
  if (f.buyerId) q = q.eq('buyer_id', f.buyerId);
  return unwrap(await q) as DistributionRow[];
}

export async function getDistribution(client: SasanaClient, id: string): Promise<DistributionRow> {
  return unwrap(await client.from('distributions').select(SELECT).eq('id', id).single()) as DistributionRow;
}

export async function createDistribution(client: SasanaClient, idempotencyKey: string, v: DistributionValues): Promise<TxResult> {
  const data = unwrap(
    await client.rpc('create_distribution', {
      p_idempotency_key: idempotencyKey,
      p_location_id: v.location_id,
      p_buyer_id: v.buyer_id,
      p_transaction_date: v.transaction_date,
      p_notes: v.notes,
      p_items: v.items,
    }),
  );
  return data as unknown as TxResult;
}

type Ctx = Pick<MyContext, 'role' | 'locations'>;

/**
 * Izin UX — sama dengan app.can_distribute_from & void_transaction di database.
 * Owner Pabrik: dari pabriknya. Admin Gudang: dari Gudang Penjualan-nya.
 * Super Owner & Admin Pabrik tidak input (Q10).
 */
export function distributionOrigins(user: Ctx) {
  if (user.role === 'OWNER_PABRIK') return user.locations.filter((l) => l.type === 'FACTORY');
  if (user.role === 'ADMIN_GUDANG') return user.locations.filter((l) => l.type === 'SALES_WAREHOUSE');
  return [];
}

export function canVoidDistribution(user: Ctx, locationId: string) {
  if (user.role === 'SUPER_OWNER') return true;
  return user.role === 'OWNER_PABRIK' && user.locations.some((l) => l.id === locationId && l.type === 'FACTORY');
}
