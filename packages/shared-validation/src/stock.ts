import { ADJUSTMENT_KINDS, MAX_BACKDATE_DAYS, minTransactionDate, todayWib } from '@sasana/shared-constants';
import { z } from 'zod';

/** Q16: tanggal transaksi maksimal 7 hari ke belakang dan tidak di masa depan (WIB). */
export const transactionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal wajib diisi')
  .refine((d) => d <= todayWib(), 'Tanggal tidak boleh di masa depan')
  .refine((d) => d >= minTransactionDate(), `Tanggal maksimal ${MAX_BACKDATE_DAYS} hari ke belakang`);

const qtySchema = z.coerce
  .number({ error: 'Jumlah harus angka' })
  .int('Jumlah harus bilangan bulat')
  .positive('Jumlah harus lebih dari 0')
  .max(100_000_000, 'Jumlah terlalu besar');

const noDuplicateItems = <T extends { item_id: string }>(lines: T[]) =>
  new Set(lines.map((l) => l.item_id)).size === lines.length;

export const itemLineSchema = z.object({
  item_id: z.uuid({ error: 'Pilih barang' }),
  unit_id: z.uuid({ error: 'Pilih satuan' }),
  qty: qtySchema,
});
export type ItemLineInput = z.input<typeof itemLineSchema>;

export const inboundSchema = z.object({
  vendor_id: z.uuid({ error: 'Pilih vendor' }),
  transaction_date: transactionDateSchema,
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter'),
  items: z
    .array(itemLineSchema)
    .min(1, 'Tambahkan minimal satu barang')
    .max(100, 'Maksimal 100 baris')
    .refine(noDuplicateItems, 'Barang yang sama tidak boleh dipilih dua kali'),
});
export type InboundInput = z.input<typeof inboundSchema>;
export type InboundValues = z.output<typeof inboundSchema>;

export const adjustmentLineSchema = z.object({
  item_id: z.uuid(),
  physical_qty: z.coerce
    .number({ error: 'Jumlah harus angka' })
    .int('Jumlah harus bilangan bulat')
    .min(0, 'Jumlah tidak boleh negatif')
    .max(100_000_000, 'Jumlah terlalu besar'),
});

export const adjustmentSchema = z.object({
  kind: z.enum(ADJUSTMENT_KINDS),
  location_id: z.uuid({ error: 'Pilih lokasi' }),
  adjustment_date: transactionDateSchema,
  reason: z.string().trim().min(1, 'Alasan wajib diisi').max(500, 'Alasan maksimal 500 karakter'),
  items: z
    .array(adjustmentLineSchema)
    .min(1, 'Isi jumlah fisik minimal satu barang')
    .refine(noDuplicateItems, 'Barang yang sama tidak boleh muncul dua kali'),
});
export type AdjustmentValues = z.output<typeof adjustmentSchema>;

export const voidSchema = z.object({
  reason: z.string().trim().min(5, 'Alasan void minimal 5 karakter').max(500, 'Alasan maksimal 500 karakter'),
});
export type VoidValues = z.output<typeof voidSchema>;
