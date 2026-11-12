import {
  buildDistributionReport,
  buildInboundReport,
  buildMutationReport,
  buildProductionReport,
  buildShipmentReport,
  buildStockReport,
  buildTraceReport,
  fetchDistributionReport,
  fetchInboundReport,
  fetchProductionReport,
  fetchShipmentReport,
  fetchTrace,
  getStockMutation,
  listStockLevels,
  type Period,
  type ReportDoc,
  type SasanaClient,
} from '@sasana/shared-api';
import type { LocationType, UserRole } from '@sasana/shared-constants';

export interface ReportParams {
  period: Period;
  locationId: string; // '' = semua lokasi yang terlihat
  locationLabel: string;
  itemId: string;
  itemLabel: string;
}

export interface ReportDef {
  key: string;
  label: string;
  description: string;
  roles: readonly UserRole[];
  /** Laporan memakai periode tanggal */
  usesPeriod: boolean;
  /** Tipe lokasi yang relevan untuk filter; null = tanpa filter lokasi */
  locationTypes: readonly LocationType[] | null;
  needsItem?: boolean;
  build: (c: SasanaClient, p: ReportParams) => Promise<ReportDoc>;
}

const ALL: readonly LocationType[] = ['WAREHOUSE', 'FACTORY', 'SALES_WAREHOUSE'];

/**
 * Hak akses di sini hanya untuk tampilan. Data tetap dibatasi RLS per lokasi.
 * Admin Pabrik tidak melihat distribusi/inbound (sesuai wewenang).
 */
export const REPORTS: readonly ReportDef[] = [
  {
    key: 'stock',
    label: 'Stok saat ini',
    description: 'Saldo stok per lokasi beserta status menipis.',
    roles: ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK'],
    usesPeriod: false,
    locationTypes: ALL,
    build: async (c, p) => {
      const levels = await listStockLevels(c);
      return buildStockReport(p.locationId ? levels.filter((l) => l.location_id === p.locationId) : levels, p.locationLabel);
    },
  },
  {
    key: 'mutation',
    label: 'Mutasi stok',
    description: 'Saldo awal, masuk, keluar, dan saldo akhir per barang.',
    roles: ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK'],
    usesPeriod: true,
    locationTypes: ALL,
    build: async (c, p) => buildMutationReport(await getStockMutation(c, p.period, p.locationId || undefined), p.period, p.locationLabel),
  },
  {
    key: 'inbound',
    label: 'Inbound',
    description: 'Packaging diterima dari vendor.',
    roles: ['SUPER_OWNER', 'ADMIN_GUDANG'],
    usesPeriod: true,
    locationTypes: null,
    build: async (c, p) => buildInboundReport(await fetchInboundReport(c, p.period), p.period),
  },
  {
    key: 'shipment',
    label: 'Shipment',
    description: 'Perpindahan barang antar lokasi dan statusnya.',
    roles: ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK'],
    usesPeriod: true,
    locationTypes: ALL,
    build: async (c, p) => buildShipmentReport(await fetchShipmentReport(c, p.period, p.locationId || undefined), p.period, p.locationLabel),
  },
  {
    key: 'production',
    label: 'Produksi & reject',
    description: 'Good, reject, dan packaging terpakai per pabrik & produk.',
    roles: ['SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_PABRIK'],
    usesPeriod: true,
    locationTypes: ['FACTORY'],
    build: async (c, p) =>
      buildProductionReport(await fetchProductionReport(c, p.period, { locationId: p.locationId || undefined }), p.period, p.locationLabel),
  },
  {
    key: 'distribution',
    label: 'Distribusi per buyer',
    description: 'Produk keluar ke buyer, termasuk konsumsi internal.',
    roles: ['SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_GUDANG'],
    usesPeriod: true,
    locationTypes: ['FACTORY', 'SALES_WAREHOUSE'],
    build: async (c, p) =>
      buildDistributionReport(await fetchDistributionReport(c, p.period, p.locationId || undefined), p.period, p.locationLabel),
  },
  {
    key: 'trace',
    label: 'Lacak produk',
    description: 'Jejak satu produk: diproduksi di mana, dikirim ke mana, keluar ke buyer siapa.',
    roles: ['SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_GUDANG'],
    usesPeriod: true,
    locationTypes: null,
    needsItem: true,
    build: async (c, p) => buildTraceReport(await fetchTrace(c, p.period, p.itemId), p.itemId, p.itemLabel, p.period),
  },
];

export const reportsForRole = (role: UserRole) => REPORTS.filter((r) => r.roles.includes(role));
