import { z } from 'zod';
import { transactionDateSchema } from './stock';

const countSchema = z.coerce
  .number({ error: 'Jumlah harus angka' })
  .int('Jumlah harus bilangan bulat')
  .min(0, 'Jumlah tidak boleh negatif')
  .max(100_000_000, 'Jumlah terlalu besar');

/**
 * Produksi (Q7): good diinput dalam satuan produk (sachet/renteng/dus),
 * reject selalu dalam sachet packaging. Packaging terpakai = good + reject.
 */
export const productionSchema = z
  .object({
    location_id: z.uuid({ error: 'Pilih pabrik' }),
    finished_item_id: z.uuid({ error: 'Pilih produk' }),
    unit_id: z.uuid({ error: 'Pilih satuan' }),
    qty_good: countSchema,
    qty_reject: countSchema,
    production_date: transactionDateSchema,
    notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter'),
  })
  .refine((v) => v.qty_good + v.qty_reject > 0, { message: 'Isi jumlah good atau reject', path: ['qty_good'] });
export type ProductionInput = z.input<typeof productionSchema>;
export type ProductionValues = z.output<typeof productionSchema>;
