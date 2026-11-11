import type { Tables } from '@sasana/shared-types';
import type {
  ItemUnitValues,
  ItemValues,
  LocationValues,
  PartyValues,
  ResetPasswordValues,
  UserCreateValues,
  UserUpdateValues,
} from '@sasana/shared-validation';
import type { SasanaClient } from './client';
import { AppError, toAppError } from './errors';

export type Location = Tables<'locations'>;
export type ItemUnit = Tables<'item_units'>;
export type Vendor = Tables<'vendors'>;
export type Buyer = Tables<'buyers'>;
export type Item = Tables<'items'> & {
  item_units: ItemUnit[];
  /** Packaging utama (hanya untuk FINISHED_GOOD). */
  packaging: { packaging_item_id: string } | null;
};
export type UserRow = Tables<'profiles'> & { user_locations: { location_id: string }[] };

function unwrap<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw toAppError(res.error);
  return res.data as NonNullable<R['data']>;
}

// ---------- Lokasi ----------
export async function listLocations(client: SasanaClient): Promise<Location[]> {
  return unwrap(await client.from('locations').select('*').is('deleted_at', null).order('name'));
}
export async function createLocation(client: SasanaClient, v: LocationValues): Promise<void> {
  unwrap(await client.from('locations').insert(v));
}
export async function updateLocation(client: SasanaClient, id: string, v: LocationValues): Promise<void> {
  unwrap(await client.from('locations').update(v).eq('id', id));
}

// ---------- Item ----------
export async function listItems(client: SasanaClient): Promise<Item[]> {
  const rows = unwrap(
    await client
      .from('items')
      .select('*, item_units(*), packaging:product_packagings!product_packagings_finished_item_id_fkey(packaging_item_id)')
      .order('sku'),
  );
  return rows.map((r) => ({
    ...r,
    item_units: [...r.item_units].sort((a, b) => a.factor - b.factor),
    packaging: Array.isArray(r.packaging) ? (r.packaging[0] ?? null) : r.packaging,
  })) as Item[];
}
export async function createItem(client: SasanaClient, v: ItemValues): Promise<string> {
  const row = unwrap(await client.from('items').insert(v).select('id').single());
  return row.id;
}
export async function updateItem(client: SasanaClient, id: string, v: ItemValues): Promise<void> {
  unwrap(await client.from('items').update(v).eq('id', id));
}
export async function createItemUnit(client: SasanaClient, itemId: string, v: ItemUnitValues): Promise<void> {
  unwrap(await client.from('item_units').insert({ ...v, item_id: itemId }));
}
export async function updateItemUnit(client: SasanaClient, unitId: string, v: ItemUnitValues): Promise<void> {
  unwrap(await client.from('item_units').update(v).eq('id', unitId));
}
/** MVP: satu produk jadi → satu packaging utama (Q7, rasio 1:1). */
export async function setProductPackaging(
  client: SasanaClient,
  finishedItemId: string,
  packagingItemId: string,
): Promise<void> {
  unwrap(
    await client
      .from('product_packagings')
      .upsert({ finished_item_id: finishedItemId, packaging_item_id: packagingItemId }, { onConflict: 'finished_item_id' }),
  );
}

// ---------- Vendor & Buyer ----------
export type PartyTable = 'vendors' | 'buyers';

export async function listParties(client: SasanaClient, table: PartyTable): Promise<Vendor[]> {
  return unwrap(await client.from(table).select('*').order('name'));
}
export async function createParty(client: SasanaClient, table: PartyTable, v: PartyValues): Promise<void> {
  unwrap(await client.from(table).insert(v));
}
export async function updateParty(client: SasanaClient, table: PartyTable, id: string, v: PartyValues): Promise<void> {
  unwrap(await client.from(table).update(v).eq('id', id));
}

// ---------- User ----------
export async function listUsers(client: SasanaClient): Promise<UserRow[]> {
  return unwrap(await client.from('profiles').select('*, user_locations!user_locations_user_id_fkey(location_id)').order('full_name')) as UserRow[];
}

export async function updateUser(client: SasanaClient, userId: string, v: UserUpdateValues): Promise<void> {
  const { error } = await client.rpc('admin_update_user', {
    p_user_id: userId,
    p_full_name: v.full_name,
    p_role: v.role,
    p_is_active: v.is_active,
    p_location_ids: v.location_ids,
  });
  if (error) throw toAppError(error);
}

async function invokeAdminUsers(client: SasanaClient, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.functions.invoke('admin-users', { body });
  if (!error) return data;
  // FunctionsHttpError: body berisi { error: { code, message } }
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    const payload = (await ctx.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    if (payload?.error?.code) throw toAppError({ message: `${payload.error.code}: ${payload.error.message ?? ''}` });
  }
  if ((error as { name?: string }).name === 'FunctionsFetchError') throw new AppError('NETWORK', undefined, error);
  throw toAppError(error);
}

export async function createUser(client: SasanaClient, v: UserCreateValues): Promise<void> {
  await invokeAdminUsers(client, { action: 'create', ...v });
}

export async function resetUserPassword(client: SasanaClient, userId: string, v: ResetPasswordValues): Promise<void> {
  await invokeAdminUsers(client, { action: 'reset_password', user_id: userId, password: v.password });
}
