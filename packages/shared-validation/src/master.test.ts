import { describe, expect, it } from 'vitest';
import { itemSchema, itemUnitSchema, locationSchema, partySchema, userCreateSchema } from './master';

describe('itemSchema', () => {
  const base = { sku: 'fg-020', name: ' Produk Baru ', type: 'FINISHED_GOOD', base_unit: 'Sachet', min_stock: '50', is_active: true };
  it('normalizes sku, name, base unit, min stock', () => {
    const r = itemSchema.parse(base);
    expect(r).toMatchObject({ sku: 'FG-020', name: 'Produk Baru', base_unit: 'sachet', min_stock: 50 });
  });
  it('rejects negative or fractional min stock', () => {
    expect(itemSchema.safeParse({ ...base, min_stock: -1 }).success).toBe(false);
    expect(itemSchema.safeParse({ ...base, min_stock: 1.5 }).success).toBe(false);
  });
  it('rejects unknown type', () => {
    expect(itemSchema.safeParse({ ...base, type: 'RAW' }).success).toBe(false);
  });
});

describe('itemUnitSchema', () => {
  it('requires factor >= 2 (base unit is automatic)', () => {
    expect(itemUnitSchema.safeParse({ unit_name: 'dus', factor: 1, is_active: true }).success).toBe(false);
    expect(itemUnitSchema.parse({ unit_name: 'DUS', factor: '160', is_active: true })).toMatchObject({ unit_name: 'dus', factor: 160 });
  });
});

describe('locationSchema', () => {
  it('uppercases code and nulls empty address', () => {
    const r = locationSchema.parse({ code: 'gpj-kmb', name: 'Gudang', address: '  ', type: 'SALES_WAREHOUSE', is_active: true });
    expect(r.code).toBe('GPJ-KMB');
    expect(r.address).toBeNull();
  });
});

describe('partySchema', () => {
  it('requires a name', () => {
    expect(partySchema.safeParse({ name: '  ', is_active: true }).success).toBe(false);
  });
});

describe('userCreateSchema', () => {
  const base = { username: 'Budi.Driver', full_name: 'Budi', role: 'DRIVER', password: 'Rahasia123', location_ids: [] };
  it('accepts a valid user and normalizes username', () => {
    expect(userCreateSchema.parse(base).username).toBe('budi.driver');
  });
  it('rejects weak passwords', () => {
    expect(userCreateSchema.safeParse({ ...base, password: 'rahasiaaa' }).success).toBe(false);
    expect(userCreateSchema.safeParse({ ...base, password: '1234567' }).success).toBe(false);
  });
});
