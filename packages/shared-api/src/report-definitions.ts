import type { SasanaClient } from './client';
import {
  buildDistributionReport,
  buildInboundReport,
  buildMutationReport,
  buildProductionReport,
  buildShipmentReport,
  buildStockReport,
  buildTraceReport,
  type ReportDoc,
} from './report-builders';
import {
  fetchDistributionReport,
  fetchInboundReport,
  fetchProductionReport,
  fetchShipmentReport,
  fetchTrace,
  getStockMutation,
  type Period,
} from './reports';
import { listStockLevels } from './stock';
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
    label: 'Keluar-masuk stok',
    description: 'Stok awal, barang masuk, keluar, dan stok akhir per barang.',
    roles: ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK'],
    usesPeriod: true,
    locationTypes: ALL,
    build: async (c, p) => buildMutationReport(await getStockMutation(c, p.period, p.locationId || undefined), p.period, p.locationLabel),
  },
  {
    key: 'inbound',
    label: 'Kemasan dari vendor',
    description: 'Kemasan yang diterima dari vendor.',
    roles: ['SUPER_OWNER', 'ADMIN_GUDANG'],
    usesPeriod: true,
    locationTypes: null,
    build: async (c, p) => buildInboundReport(await fetchInboundReport(c, p.period), p.period),
  },
  {
    key: 'shipment',
    label: 'Pengiriman',
    description: 'Pengiriman barang antar lokasi dan statusnya.',
    roles: ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK'],
    usesPeriod: true,
    locationTypes: ALL,
    build: async (c, p) => buildShipmentReport(await fetchShipmentReport(c, p.period, p.locationId || undefined), p.period, p.locationLabel),
  },
  {
    key: 'production',
    label: 'Produksi & reject',
    description: 'Hasil produksi, reject, dan kemasan terpakai per pabrik & produk.',
    roles: ['SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_PABRIK'],
    usesPeriod: true,
    locationTypes: ['FACTORY'],
    build: async (c, p) =>
      buildProductionReport(await fetchProductionReport(c, p.period, { locationId: p.locationId || undefined }), p.period, p.locationLabel),
  },
  {
    key: 'distribution',
    label: 'Penjualan per pembeli',
    description: 'Produk terjual ke pembeli, termasuk pemakaian sendiri.',
    roles: ['SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_GUDANG'],
    usesPeriod: true,
    locationTypes: ['FACTORY', 'SALES_WAREHOUSE'],
    build: async (c, p) =>
      buildDistributionReport(await fetchDistributionReport(c, p.period, p.locationId || undefined), p.period, p.locationLabel),
  },
  {
    key: 'trace',
    label: 'Lacak produk',
    description: 'Satu produk: dibuat di mana, dikirim ke mana, terjual ke siapa.',
    roles: ['SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_GUDANG'],
    usesPeriod: true,
    locationTypes: null,
    needsItem: true,
    build: async (c, p) => buildTraceReport(await fetchTrace(c, p.period, p.itemId), p.itemId, p.itemLabel, p.period),
  },
];

export const reportsForRole = (role: UserRole) => REPORTS.filter((r) => r.roles.includes(role));
