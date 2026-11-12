import { z } from 'zod';
import { itemLineSchema, transactionDateSchema } from './stock';

/** Distribusi: produk jadi keluar ke buyer. Satu dokumen = satu buyer, banyak produk. */
export const distributionSchema = z.object({
  location_id: z.uuid({ error: 'Pilih lokasi asal' }),
  buyer_id: z.uuid({ error: 'Pilih buyer' }),
  transaction_date: transactionDateSchema,
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter'),
  items: z
    .array(itemLineSchema)
    .min(1, 'Tambahkan minimal satu produk')
    .max(100, 'Maksimal 100 baris')
    .refine((l) => new Set(l.map((x) => x.item_id)).size === l.length, 'Produk yang sama tidak boleh dipilih dua kali'),
});
export type DistributionInput = z.input<typeof distributionSchema>;
export type DistributionValues = z.output<typeof distributionSchema>;
