import type { ItemType, LocationType, ShipmentStatus } from '@sasana/shared-constants';
import type { SasanaClient } from './client';
import { toAppError } from './errors';

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
export interface DashboardLocation {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  packaging_qty: number;
  finished_qty: number;
  low_count: number;
  production_today: { good: number; reject: number };
  production_month: { good: number; reject: number };
  distribution_today: number;
  distribution_month: number;
  incoming: number;
  outgoing: number;
}

export interface LowStockRow {
  location_name: string;
  sku: string;
  item_name: string;
  quantity: number;
  min_stock: number;
  base_unit: string;
}

export interface Dashboard {
  today: string;
  month_start: string;
  locations: DashboardLocation[];
  shipments: { created: number; assigned: number; picked_up: number; received_month: number };
  low_stock: LowStockRow[];
}

export async function getDashboard(client: SasanaClient): Promise<Dashboard> {
  const { data, error } = await client.rpc('get_dashboard');
  if (error) throw toAppError(error);
  return data as unknown as Dashboard;
}

// ---------------------------------------------------------------------
// Data laporan
// ---------------------------------------------------------------------
export interface Period {
  /** YYYY-MM-DD (WIB), inklusif */
  from: string;
  to: string;
}

const PAGE = 1000;

/** Ambil semua baris (PostgREST membatasi 1.000 baris per request). */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await page(offset, offset + PAGE - 1);
    if (error) throw toAppError(error);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const startOf = (d: string) => `${d}T00:00:00+07:00`;
const endOf = (d: string) => `${d}T23:59:59.999+07:00`;

export interface StockMutationRow {
  location_id: string;
  location_name: string;
  item_id: string;
  sku: string;
  item_name: string;
  item_type: ItemType;
  base_unit: string;
  opening: number;
  inbound: number;
  received: number;
  produced: number;
  consumed: number;
  shipped: number;
  distributed: number;
  adjusted: number;
  closing: number;
}

export async function getStockMutation(client: SasanaClient, p: Period, locationId?: string): Promise<StockMutationRow[]> {
  const { data, error } = await client.rpc('report_stock_mutation', {
    p_from: p.from,
    p_to: p.to,
    ...(locationId ? { p_location_id: locationId } : {}),
  });
  if (error) throw toAppError(error);
  return (data ?? []) as StockMutationRow[];
}

type ItemRef = { sku: string; name: string; base_unit: string } | null;
type LineRow = { item_id: string; unit_name: string; input_qty: number; factor: number; base_qty: number | null; item: ItemRef };

export interface InboundReportDoc {
  id: string;
  doc_no: string;
  transaction_date: string;
  voided_at: string | null;
  vendor: { name: string } | null;
  inbound_items: LineRow[];
}

export function fetchInboundReport(client: SasanaClient, p: Period) {
  return fetchAll<InboundReportDoc>((a, b) =>
    client
      .from('inbound_transactions')
      .select('id, doc_no, transaction_date, voided_at, vendor:vendors(name), inbound_items(item_id, unit_name, input_qty, factor, base_qty, item:items(sku, name, base_unit))')
      .gte('transaction_date', p.from)
      .lte('transaction_date', p.to)
      .order('transaction_date')
      .order('doc_no')
      .range(a, b),
  );
}

export interface ShipmentReportDoc {
  id: string;
  doc_no: string;
  created_at: string;
  status: ShipmentStatus;
  received_at: string | null;
  from_location_id: string;
  to_location_id: string;
  from_location: { name: string } | null;
  to_location: { name: string } | null;
  driver: { full_name: string } | null;
  shipment_items: LineRow[];
}

export function fetchShipmentReport(client: SasanaClient, p: Period, locationId?: string) {
  return fetchAll<ShipmentReportDoc>((a, b) => {
    let q = client
      .from('shipments')
      .select(
        `id, doc_no, created_at, status, received_at, from_location_id, to_location_id,
         from_location:locations!shipments_from_location_id_fkey(name),
         to_location:locations!shipments_to_location_id_fkey(name),
         driver:profiles!shipments_driver_id_fkey(full_name),
         shipment_items(item_id, unit_name, input_qty, factor, base_qty, item:items(sku, name, base_unit))`,
      )
      .gte('created_at', startOf(p.from))
      .lte('created_at', endOf(p.to))
      .order('created_at');
    if (locationId) q = q.or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`);
    return q.range(a, b);
  });
}

export interface ProductionReportRow {
  id: string;
  doc_no: string;
  production_date: string;
  location_id: string;
  finished_item_id: string;
  qty_good: number | null;
  qty_reject: number;
  packaging_consumed: number | null;
  location: { name: string } | null;
  product: ItemRef;
  packaging: ItemRef;
}

export function fetchProductionReport(client: SasanaClient, p: Period, opts: { locationId?: string; itemId?: string } = {}) {
  return fetchAll<ProductionReportRow>((a, b) => {
    let q = client
      .from('productions')
      .select(
        `id, doc_no, production_date, location_id, finished_item_id, qty_good, qty_reject, packaging_consumed,
         location:locations(name),
         product:items!productions_finished_item_id_fkey(sku, name, base_unit),
         packaging:items!productions_packaging_item_id_fkey(sku, name, base_unit)`,
      )
      .is('voided_at', null)
      .gte('production_date', p.from)
      .lte('production_date', p.to)
      .order('production_date')
      .order('doc_no');
    if (opts.locationId) q = q.eq('location_id', opts.locationId);
    if (opts.itemId) q = q.eq('finished_item_id', opts.itemId);
    return q.range(a, b);
  });
}

export interface DistributionReportDoc {
  id: string;
  doc_no: string;
  transaction_date: string;
  location_id: string;
  buyer_id: string;
  buyer_name: string;
  location: { name: string } | null;
  distribution_items: LineRow[];
}

export function fetchDistributionReport(client: SasanaClient, p: Period, locationId?: string) {
  return fetchAll<DistributionReportDoc>((a, b) => {
    let q = client
      .from('distributions')
      .select(
        `id, doc_no, transaction_date, location_id, buyer_id, buyer_name, location:locations(name),
         distribution_items(item_id, unit_name, input_qty, factor, base_qty, item:items(sku, name, base_unit))`,
      )
      .is('voided_at', null)
      .gte('transaction_date', p.from)
      .lte('transaction_date', p.to)
      .order('transaction_date')
      .order('doc_no');
    if (locationId) q = q.eq('location_id', locationId);
    return q.range(a, b);
  });
}

/** Data pelacakan satu produk: produksi → shipment → distribusi. */
export async function fetchTrace(client: SasanaClient, p: Period, itemId: string) {
  const [productions, shipments, distributions] = await Promise.all([
    fetchProductionReport(client, p, { itemId }),
    fetchAll<ShipmentReportDoc>((a, b) =>
      client
        .from('shipments')
        .select(
          `id, doc_no, created_at, status, received_at, from_location_id, to_location_id,
           from_location:locations!shipments_from_location_id_fkey(name),
           to_location:locations!shipments_to_location_id_fkey(name),
           driver:profiles!shipments_driver_id_fkey(full_name),
           shipment_items!inner(item_id, unit_name, input_qty, factor, base_qty, item:items(sku, name, base_unit))`,
        )
        .eq('shipment_items.item_id', itemId)
        .neq('status', 'CANCELLED')
        .gte('created_at', startOf(p.from))
        .lte('created_at', endOf(p.to))
        .order('created_at')
        .range(a, b),
    ),
    fetchAll<DistributionReportDoc>((a, b) =>
      client
        .from('distributions')
        .select(
          `id, doc_no, transaction_date, location_id, buyer_id, buyer_name, location:locations(name),
           distribution_items!inner(item_id, unit_name, input_qty, factor, base_qty, item:items(sku, name, base_unit))`,
        )
        .eq('distribution_items.item_id', itemId)
        .is('voided_at', null)
        .gte('transaction_date', p.from)
        .lte('transaction_date', p.to)
        .order('transaction_date')
        .range(a, b),
    ),
  ]);
  return { productions, shipments, distributions };
}
export type TraceData = Awaited<ReturnType<typeof fetchTrace>>;
