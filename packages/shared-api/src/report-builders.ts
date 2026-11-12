import {
  formatDate,
  formatDateTime,
  ITEM_TYPE_LABELS,
  SHIPMENT_STATUS_LABELS,
  type ItemType,
} from '@sasana/shared-constants';
import type { Tables } from '@sasana/shared-types';
import type {
  DistributionReportDoc,
  InboundReportDoc,
  Period,
  ProductionReportRow,
  ShipmentReportDoc,
  StockMutationRow,
  TraceData,
} from './reports';

/**
 * Dokumen laporan netral-format: dipakai untuk pratinjau tabel, CSV, dan PDF.
 * Sel angka disimpan sebagai number (CSV memakai angka mentah; PDF/tabel memformat).
 */
export type Cell = string | number;
export interface ReportColumn {
  header: string;
  numeric?: boolean;
}
export interface ReportSection {
  heading?: string;
  columns: ReportColumn[];
  rows: Cell[][];
  footer?: Cell[];
}
export interface ReportDoc {
  title: string;
  /** Baris keterangan: periode, lokasi, catatan */
  meta: string[];
  sections: ReportSection[];
  /** Saran orientasi PDF */
  landscape?: boolean;
}

const VOID_NOTE = 'Transaksi yang di-void tidak dihitung.';
export const periodLabel = (p: Period) => (p.from === p.to ? formatDate(p.from) : `${formatDate(p.from)} – ${formatDate(p.to)}`);
const num = (header: string): ReportColumn => ({ header, numeric: true });
const txt = (header: string): ReportColumn => ({ header });
const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%` : '–');

/** Kelompokkan & jumlahkan: key → agregat. Urutan sesuai kemunculan pertama. */
function groupSum<T, K extends string>(rows: T[], key: (r: T) => string, label: (r: T) => Cell[], fields: Record<K, (r: T) => number>) {
  const map = new Map<string, { label: Cell[]; v: Record<K, number> }>();
  for (const r of rows) {
    const k = key(r);
    let g = map.get(k);
    if (!g) {
      g = { label: label(r), v: Object.fromEntries(Object.keys(fields).map((f) => [f, 0])) as Record<K, number> };
      map.set(k, g);
    }
    for (const f of Object.keys(fields) as K[]) g.v[f] += fields[f](r);
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------
// 1. Stok saat ini
// ---------------------------------------------------------------------
export function buildStockReport(levels: Tables<'stock_levels'>[], locationLabel: string): ReportDoc {
  const rows = levels
    .filter((l) => (l.quantity ?? 0) !== 0 || l.is_low)
    .map((l) => [
      l.location_name ?? '',
      l.sku ?? '',
      l.item_name ?? '',
      ITEM_TYPE_LABELS[l.item_type as ItemType] ?? '',
      l.quantity ?? 0,
      l.min_stock ?? 0,
      l.base_unit ?? '',
      l.is_low ? 'Menipis' : 'Aman',
    ]);
  return {
    title: 'Laporan Stok',
    meta: [`Per ${formatDateTime(new Date().toISOString())}`, `Lokasi: ${locationLabel}`, 'Satuan dasar (sachet).'],
    sections: [
      {
        columns: [txt('Lokasi'), txt('SKU'), txt('Barang'), txt('Jenis'), num('Stok'), num('Minimum'), txt('Satuan'), txt('Status')],
        rows,
      },
    ],
  };
}

// ---------------------------------------------------------------------
// 2. Mutasi stok
// ---------------------------------------------------------------------
export function buildMutationReport(rows: StockMutationRow[], p: Period, locationLabel: string): ReportDoc {
  return {
    title: 'Laporan Mutasi Stok',
    meta: [
      `Periode: ${periodLabel(p)}`,
      `Lokasi: ${locationLabel}`,
      'Satuan dasar (sachet). Berdasarkan waktu pencatatan. Void mengurangi kolom transaksi aslinya; penyesuaian = stok awal & opname.',
    ],
    landscape: true,
    sections: [
      {
        columns: [
          txt('Lokasi'),
          txt('SKU'),
          txt('Barang'),
          num('Awal'),
          num('Inbound'),
          num('Terima'),
          num('Hasil prod.'),
          num('Pakai prod.'),
          num('Kirim'),
          num('Distribusi'),
          num('Penyesuaian'),
          num('Akhir'),
        ],
        rows: rows.map((r) => [
          r.location_name,
          r.sku,
          r.item_name,
          r.opening,
          r.inbound,
          r.received,
          r.produced,
          r.consumed,
          r.shipped,
          r.distributed,
          r.adjusted,
          r.closing,
        ]),
      },
    ],
  };
}

// ---------------------------------------------------------------------
// 3. Inbound
// ---------------------------------------------------------------------
export function buildInboundReport(docs: InboundReportDoc[], p: Period): ReportDoc {
  const active = docs.filter((d) => !d.voided_at);
  const lines = active.flatMap((d) => d.inbound_items.map((l) => ({ d, l })));
  const perItem = groupSum(
    lines,
    (x) => x.l.item_id,
    (x) => [x.l.item?.sku ?? '', x.l.item?.name ?? ''],
    { qty: (x) => x.l.base_qty ?? 0 },
  );
  return {
    title: 'Laporan Inbound (Penerimaan dari Vendor)',
    meta: [`Periode: ${periodLabel(p)}`, `${active.length} dokumen`, VOID_NOTE],
    sections: [
      {
        heading: 'Ringkasan per packaging',
        columns: [txt('SKU'), txt('Packaging'), num('Jumlah (sachet)')],
        rows: perItem.map((g) => [...g.label, g.v.qty]),
        footer: ['', 'Total', sum(perItem, (g) => g.v.qty)],
      },
      {
        heading: 'Rincian',
        columns: [txt('Tanggal'), txt('No. dokumen'), txt('Vendor'), txt('SKU'), txt('Packaging'), num('Jumlah'), txt('Satuan')],
        rows: lines.map(({ d, l }) => [
          formatDate(d.transaction_date),
          d.doc_no,
          d.vendor?.name ?? '',
          l.item?.sku ?? '',
          l.item?.name ?? '',
          l.base_qty ?? 0,
          l.item?.base_unit ?? '',
        ]),
      },
    ],
  };
}

// ---------------------------------------------------------------------
// 4. Shipment
// ---------------------------------------------------------------------
export function buildShipmentReport(docs: ShipmentReportDoc[], p: Period, locationLabel: string): ReportDoc {
  const lines = docs.flatMap((d) => d.shipment_items.map((l) => ({ d, l })));
  const perStatus = groupSum(
    docs,
    (d) => d.status,
    (d) => [SHIPMENT_STATUS_LABELS[d.status]],
    { n: () => 1 },
  );
  return {
    title: 'Laporan Shipment',
    meta: [`Periode dibuat: ${periodLabel(p)}`, `Lokasi: ${locationLabel}`, `${docs.length} shipment`],
    landscape: true,
    sections: [
      { heading: 'Ringkasan status', columns: [txt('Status'), num('Jumlah shipment')], rows: perStatus.map((g) => [...g.label, g.v.n]) },
      {
        heading: 'Rincian',
        columns: [
          txt('Dibuat'),
          txt('No. dokumen'),
          txt('Dari'),
          txt('Ke'),
          txt('Status'),
          txt('Driver'),
          txt('SKU'),
          txt('Barang'),
          num('Jumlah'),
          txt('Satuan'),
        ],
        rows: lines.map(({ d, l }) => [
          formatDateTime(d.created_at),
          d.doc_no,
          d.from_location?.name ?? '',
          d.to_location?.name ?? '',
          SHIPMENT_STATUS_LABELS[d.status],
          d.driver?.full_name ?? '',
          l.item?.sku ?? '',
          l.item?.name ?? '',
          l.base_qty ?? 0,
          l.item?.base_unit ?? '',
        ]),
      },
    ],
  };
}

// ---------------------------------------------------------------------
// 5. Produksi & reject
// ---------------------------------------------------------------------
export function buildProductionReport(rows: ProductionReportRow[], p: Period, locationLabel: string): ReportDoc {
  const groups = groupSum(
    rows,
    (r) => `${r.location_id}|${r.finished_item_id}`,
    (r) => [r.location?.name ?? '', r.product?.sku ?? '', r.product?.name ?? ''],
    { good: (r) => r.qty_good ?? 0, reject: (r) => r.qty_reject, used: (r) => r.packaging_consumed ?? 0 },
  );
  const tGood = sum(groups, (g) => g.v.good);
  const tReject = sum(groups, (g) => g.v.reject);
  const tUsed = sum(groups, (g) => g.v.used);
  return {
    title: 'Laporan Produksi & Reject',
    meta: [`Periode: ${periodLabel(p)}`, `Pabrik: ${locationLabel}`, `${rows.length} dokumen produksi. Satuan sachet.`, VOID_NOTE],
    sections: [
      {
        heading: 'Ringkasan per pabrik & produk',
        columns: [txt('Pabrik'), txt('SKU'), txt('Produk'), num('Good'), num('Reject'), num('Packaging terpakai'), txt('% Reject')],
        rows: groups.map((g) => [...g.label, g.v.good, g.v.reject, g.v.used, pct(g.v.reject, g.v.used)]),
        footer: ['Total', '', '', tGood, tReject, tUsed, pct(tReject, tUsed)],
      },
      {
        heading: 'Rincian',
        columns: [txt('Tanggal'), txt('No. dokumen'), txt('Pabrik'), txt('Produk'), num('Good'), num('Reject'), num('Packaging terpakai')],
        rows: rows.map((r) => [
          formatDate(r.production_date),
          r.doc_no,
          r.location?.name ?? '',
          r.product?.name ?? '',
          r.qty_good ?? 0,
          r.qty_reject,
          r.packaging_consumed ?? 0,
        ]),
      },
    ],
  };
}

// ---------------------------------------------------------------------
// 6. Distribusi
// ---------------------------------------------------------------------
export function buildDistributionReport(docs: DistributionReportDoc[], p: Period, locationLabel: string): ReportDoc {
  const lines = docs.flatMap((d) => d.distribution_items.map((l) => ({ d, l })));
  const perBuyer = groupSum(
    lines,
    (x) => `${x.d.buyer_id}|${x.l.item_id}`,
    (x) => [x.d.buyer_name, x.l.item?.sku ?? '', x.l.item?.name ?? ''],
    { qty: (x) => x.l.base_qty ?? 0 },
  ).sort((a, b) => String(a.label[0]).localeCompare(String(b.label[0]), 'id') || String(a.label[1]).localeCompare(String(b.label[1])));
  const perProduct = groupSum(
    lines,
    (x) => x.l.item_id,
    (x) => [x.l.item?.sku ?? '', x.l.item?.name ?? ''],
    { qty: (x) => x.l.base_qty ?? 0 },
  );
  return {
    title: 'Laporan Distribusi',
    meta: [`Periode: ${periodLabel(p)}`, `Lokasi asal: ${locationLabel}`, `${docs.length} dokumen. Satuan sachet.`, VOID_NOTE],
    sections: [
      {
        heading: 'Per buyer & produk',
        columns: [txt('Buyer'), txt('SKU'), txt('Produk'), num('Jumlah (sachet)')],
        rows: perBuyer.map((g) => [...g.label, g.v.qty]),
        footer: ['Total', '', '', sum(perBuyer, (g) => g.v.qty)],
      },
      {
        heading: 'Per produk',
        columns: [txt('SKU'), txt('Produk'), num('Jumlah (sachet)')],
        rows: perProduct.map((g) => [...g.label, g.v.qty]),
      },
      {
        heading: 'Rincian',
        columns: [txt('Tanggal'), txt('No. dokumen'), txt('Dari'), txt('Buyer'), txt('Produk'), num('Jumlah'), txt('Input')],
        rows: lines.map(({ d, l }) => [
          formatDate(d.transaction_date),
          d.doc_no,
          d.location?.name ?? '',
          d.buyer_name,
          l.item?.name ?? '',
          l.base_qty ?? 0,
          `${l.input_qty} ${l.unit_name}`,
        ]),
      },
    ],
  };
}

// ---------------------------------------------------------------------
// 7. Lacak produk (produksi → shipment → distribusi)
// ---------------------------------------------------------------------
export function buildTraceReport(data: TraceData, itemId: string, itemLabel: string, p: Period): ReportDoc {
  const qtyOf = (items: { item_id: string; base_qty: number | null }[]) =>
    sum(items.filter((l) => l.item_id === itemId), (l) => l.base_qty ?? 0);

  const prod = groupSum(
    data.productions,
    (r) => r.location_id,
    (r) => [r.location?.name ?? ''],
    { good: (r) => r.qty_good ?? 0, reject: (r) => r.qty_reject },
  );
  const routes = groupSum(
    data.shipments,
    (s) => `${s.from_location_id}|${s.to_location_id}`,
    (s) => [s.from_location?.name ?? '', s.to_location?.name ?? ''],
    {
      received: (s) => (s.status === 'RECEIVED' ? qtyOf(s.shipment_items) : 0),
      transit: (s) => (s.status === 'PICKED_UP' ? qtyOf(s.shipment_items) : 0),
      planned: (s) => (s.status === 'CREATED' || s.status === 'ASSIGNED' ? qtyOf(s.shipment_items) : 0),
    },
  );
  const buyers = groupSum(
    data.distributions,
    (d) => `${d.location_id}|${d.buyer_id}`,
    (d) => [d.location?.name ?? '', d.buyer_name],
    { qty: (d) => qtyOf(d.distribution_items) },
  );

  type Ev = { at: string; row: Cell[] };
  const events: Ev[] = [
    ...data.productions.map((r) => ({
      at: r.production_date,
      row: [formatDate(r.production_date), 'Produksi', r.doc_no, r.location?.name ?? '', '', r.qty_good ?? 0] as Cell[],
    })),
    ...data.shipments.map((s) => ({
      at: s.created_at.slice(0, 10),
      row: [
        formatDate(s.created_at.slice(0, 10)),
        `Shipment (${SHIPMENT_STATUS_LABELS[s.status]})`,
        s.doc_no,
        s.from_location?.name ?? '',
        s.to_location?.name ?? '',
        qtyOf(s.shipment_items),
      ] as Cell[],
    })),
    ...data.distributions.map((d) => ({
      at: d.transaction_date,
      row: [formatDate(d.transaction_date), 'Distribusi', d.doc_no, d.location?.name ?? '', d.buyer_name, qtyOf(d.distribution_items)] as Cell[],
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return {
    title: 'Lacak Produk',
    meta: [`Produk: ${itemLabel}`, `Periode: ${periodLabel(p)}`, 'Satuan sachet. Shipment batal & transaksi void tidak dihitung.'],
    sections: [
      {
        heading: 'Produksi per pabrik',
        columns: [txt('Pabrik'), num('Good'), num('Reject')],
        rows: prod.map((g) => [...g.label, g.v.good, g.v.reject]),
        footer: ['Total', sum(prod, (g) => g.v.good), sum(prod, (g) => g.v.reject)],
      },
      {
        heading: 'Perpindahan antar lokasi (shipment)',
        columns: [txt('Dari'), txt('Ke'), num('Diterima'), num('Dalam perjalanan'), num('Belum pickup')],
        rows: routes.map((g) => [...g.label, g.v.received, g.v.transit, g.v.planned]),
      },
      {
        heading: 'Keluar ke buyer (distribusi)',
        columns: [txt('Dari'), txt('Buyer'), num('Jumlah')],
        rows: buyers.map((g) => [...g.label, g.v.qty]),
        footer: ['Total', '', sum(buyers, (g) => g.v.qty)],
      },
      {
        heading: 'Kronologi dokumen',
        columns: [txt('Tanggal'), txt('Kegiatan'), txt('No. dokumen'), txt('Dari / lokasi'), txt('Ke / buyer'), num('Jumlah')],
        rows: events.map((e) => e.row),
      },
    ],
  };
}

// ---------------------------------------------------------------------
// CSV (Excel Indonesia: pemisah titik koma, BOM UTF-8)
// ---------------------------------------------------------------------
export function reportToCsv(doc: ReportDoc): string {
  const esc = (c: Cell) => {
    const s = String(c);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = (cells: Cell[]) => cells.map(esc).join(';');
  const out: string[] = [line([doc.title]), ...doc.meta.map((m) => line([m]))];
  for (const s of doc.sections) {
    out.push('');
    if (s.heading) out.push(line([s.heading]));
    out.push(line(s.columns.map((c) => c.header)));
    for (const r of s.rows) out.push(line(r));
    if (s.footer) out.push(line(s.footer));
  }
  return '﻿' + out.join('\r\n') + '\r\n';
}
