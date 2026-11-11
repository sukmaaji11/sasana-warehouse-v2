import { ITEM_TYPES, LOCATION_TYPES, USER_ROLES } from '@sasana/shared-constants';
import { z } from 'zod';
import { usernameSchema } from './auth';

const trimmed = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} wajib diisi`).max(max, `${label} maksimal ${max} karakter`);

const optionalText = (max = 250) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/** Satuan: huruf kecil, mis. "sachet", "renteng", "dus". */
export const unitNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9 ]{0,19}$/, 'Satuan: huruf kecil, maksimal 20 karakter (mis. sachet, dus)');

// ---------- Lokasi ----------
export const locationSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'Kode: huruf besar, angka, atau strip (2–20 karakter)'),
  name: trimmed('Nama lokasi'),
  address: optionalText(),
  type: z.enum(LOCATION_TYPES, { error: 'Pilih tipe lokasi' }),
  is_active: z.boolean(),
});
export type LocationInput = z.input<typeof locationSchema>;
export type LocationValues = z.output<typeof locationSchema>;

// ---------- Item ----------
export const itemSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,30}$/, 'SKU: huruf besar, angka, atau strip (2–30 karakter)'),
  name: trimmed('Nama barang'),
  type: z.enum(ITEM_TYPES, { error: 'Pilih tipe barang' }),
  base_unit: unitNameSchema,
  min_stock: z.coerce
    .number({ error: 'Minimum stok harus angka' })
    .int('Minimum stok harus bilangan bulat')
    .min(0, 'Minimum stok tidak boleh negatif'),
  is_active: z.boolean(),
});
export type ItemInput = z.input<typeof itemSchema>;
export type ItemValues = z.output<typeof itemSchema>;

export const itemUnitSchema = z.object({
  unit_name: unitNameSchema,
  factor: z.coerce
    .number({ error: 'Isi harus angka' })
    .int('Isi harus bilangan bulat')
    .min(2, 'Isi minimal 2 (satuan dasar sudah otomatis = 1)'),
  is_active: z.boolean(),
});
export type ItemUnitInput = z.input<typeof itemUnitSchema>;
export type ItemUnitValues = z.output<typeof itemUnitSchema>;

// ---------- Vendor & Buyer ----------
export const partySchema = z.object({
  name: trimmed('Nama'),
  phone: optionalText(30),
  address: optionalText(),
  notes: optionalText(),
  is_active: z.boolean(),
});
export type PartyInput = z.input<typeof partySchema>;
export type PartyValues = z.output<typeof partySchema>;

// ---------- User ----------
export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .regex(/[a-zA-Z]/, 'Password harus mengandung huruf')
  .regex(/\d/, 'Password harus mengandung angka');

export const userUpdateSchema = z.object({
  full_name: trimmed('Nama'),
  role: z.enum(USER_ROLES, { error: 'Pilih role' }),
  is_active: z.boolean(),
  location_ids: z.array(z.uuid()),
});
export type UserUpdateInput = z.input<typeof userUpdateSchema>;
export type UserUpdateValues = z.output<typeof userUpdateSchema>;

export const userCreateSchema = userUpdateSchema.omit({ is_active: true }).extend({
  username: usernameSchema,
  password: passwordSchema,
});
export type UserCreateInput = z.input<typeof userCreateSchema>;
export type UserCreateValues = z.output<typeof userCreateSchema>;

export const resetPasswordSchema = z.object({ password: passwordSchema });
export type ResetPasswordValues = z.output<typeof resetPasswordSchema>;
