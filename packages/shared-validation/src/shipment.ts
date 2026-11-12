import { z } from 'zod';
import { itemLineSchema } from './stock';

export const shipmentSchema = z
  .object({
    from_location_id: z.uuid({ error: 'Pilih lokasi asal' }),
    to_location_id: z.uuid({ error: 'Pilih lokasi tujuan' }),
    /** Opsional: kosong = ditugaskan nanti */
    driver_id: z.union([z.uuid(), z.literal('')]).transform((v) => (v === '' ? null : v)),
    notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter'),
    items: z
      .array(itemLineSchema)
      .min(1, 'Tambahkan minimal satu barang')
      .max(100, 'Maksimal 100 baris')
      .refine((l) => new Set(l.map((x) => x.item_id)).size === l.length, 'Barang yang sama tidak boleh dipilih dua kali'),
  })
  .refine((v) => v.from_location_id !== v.to_location_id, {
    path: ['to_location_id'],
    message: 'Lokasi tujuan harus berbeda dari asal',
  });
export type ShipmentInput = z.input<typeof shipmentSchema>;
export type ShipmentValues = z.output<typeof shipmentSchema>;

export const cancelShipmentSchema = z.object({
  reason: z.string().trim().min(5, 'Alasan minimal 5 karakter').max(500, 'Alasan maksimal 500 karakter'),
});
export type CancelShipmentValues = z.output<typeof cancelShipmentSchema>;
