import { describe, expect, it } from 'vitest';
import { buildDistributionReport, buildProductionReport, buildTraceReport, reportToCsv } from './report-builders';
import type { DistributionReportDoc, ProductionReportRow, ShipmentReportDoc } from './reports';

const p = { from: '2026-11-01', to: '2026-11-12' };
const item = (sku: string) => ({ sku, name: `Produk ${sku}`, base_unit: 'sachet' });

const prod = (id: string, loc: string, good: number, reject: number): ProductionReportRow => ({
  id,
  doc_no: `PRD-${id}`,
  production_date: '2026-11-05',
  location_id: loc,
  finished_item_id: 'fg1',
  qty_good: good,
  qty_reject: reject,
  packaging_consumed: good + reject,
  location: { name: `Pabrik ${loc}` },
  product: item('FG-001'),
  packaging: item('PKG-001'),
});

const dist = (id: string, buyer: string, lines: [string, number][]): DistributionReportDoc => ({
  id,
  doc_no: `DST-${id}`,
  transaction_date: '2026-11-06',
  location_id: 'clp',
  buyer_id: buyer,
  buyer_name: `Toko ${buyer}`,
  location: { name: 'Pabrik clp' },
  distribution_items: lines.map(([itemId, qty]) => ({
    item_id: itemId,
    unit_name: 'sachet',
    input_qty: qty,
    factor: 1,
    base_qty: qty,
    item: item(itemId),
  })),
});

describe('buildProductionReport', () => {
  it('groups per factory & product and computes reject %', () => {
    const doc = buildProductionReport([prod('1', 'clp', 380, 20), prod('2', 'clp', 190, 10), prod('3', 'kmj', 100, 0)], p, 'Semua');
    const summary = doc.sections[0]!;
    expect(summary.rows).toEqual([
      ['Pabrik clp', 'FG-001', 'Produk FG-001', 570, 30, 600, '5%'],
      ['Pabrik kmj', 'FG-001', 'Produk FG-001', 100, 0, 100, '0%'],
    ]);
    expect(summary.footer).toEqual(['Total', '', '', 670, 30, 700, '4,3%']);
    expect(doc.sections[1]!.rows).toHaveLength(3);
  });
});

describe('buildDistributionReport', () => {
  it('sums per buyer & product and per product', () => {
    const doc = buildDistributionReport(
      [dist('1', 'b', [['FG-001', 40], ['FG-002', 10]]), dist('2', 'a', [['FG-001', 5]]), dist('3', 'b', [['FG-001', 60]])],
      p,
      'Semua',
    );
    expect(doc.sections[0]!.rows).toEqual([
      ['Toko a', 'FG-001', 'Produk FG-001', 5],
      ['Toko b', 'FG-001', 'Produk FG-001', 100],
      ['Toko b', 'FG-002', 'Produk FG-002', 10],
    ]);
    expect(doc.sections[0]!.footer).toEqual(['Total', '', '', 115]);
    expect(doc.sections[1]!.rows).toEqual([
      ['FG-001', 'Produk FG-001', 105],
      ['FG-002', 'Produk FG-002', 10],
    ]);
  });
});

describe('buildTraceReport', () => {
  it('follows one product and ignores other items in the same documents', () => {
    const ship = (id: string, status: ShipmentReportDoc['status'], qty: number): ShipmentReportDoc => ({
      id,
      doc_no: `SHP-${id}`,
      created_at: '2026-11-07T03:00:00+00:00',
      status,
      received_at: null,
      from_location_id: 'clp',
      to_location_id: 'gpj',
      from_location: { name: 'Cilacap' },
      to_location: { name: 'Gudang Penjualan' },
      driver: null,
      shipment_items: [
        { item_id: 'FG-001', unit_name: 'sachet', input_qty: qty, factor: 1, base_qty: qty, item: item('FG-001') },
        { item_id: 'FG-009', unit_name: 'sachet', input_qty: 999, factor: 1, base_qty: 999, item: item('FG-009') },
      ],
    });
    const doc = buildTraceReport(
      {
        productions: [prod('1', 'clp', 500, 5)],
        shipments: [ship('1', 'RECEIVED', 300), ship('2', 'PICKED_UP', 50)],
        distributions: [dist('1', 'b', [['FG-001', 120], ['FG-002', 7]])],
      },
      'FG-001',
      'FG-001 · Produk',
      p,
    );
    expect(doc.sections[0]!.footer).toEqual(['Total', 500, 5]);
    expect(doc.sections[1]!.rows).toEqual([['Cilacap', 'Gudang Penjualan', 300, 50, 0]]);
    expect(doc.sections[2]!.rows).toEqual([['Pabrik clp', 'Toko b', 120]]);
    expect(doc.sections[3]!.rows.map((r) => r[1])).toEqual(['Produksi', 'Distribusi', 'Shipment (Diterima)', 'Shipment (Dalam perjalanan)']);
  });
});

describe('reportToCsv', () => {
  it('uses semicolons, BOM, and quotes special characters', () => {
    const csv = reportToCsv({
      title: 'Uji',
      meta: ['Periode: x'],
      sections: [{ heading: 'A', columns: [{ header: 'Nama' }, { header: 'Qty', numeric: true }], rows: [['Toko "Jaya"; Baru', 1200]] }],
    });
    expect(csv.startsWith('﻿Uji\r\n')).toBe(true);
    expect(csv).toContain('Nama;Qty\r\n"Toko ""Jaya""; Baru";1200\r\n');
  });
});
