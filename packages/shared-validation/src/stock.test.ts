import { addDays, todayWib } from '@sasana/shared-constants';
import { describe, expect, it } from 'vitest';
import { adjustmentSchema, inboundSchema, transactionDateSchema, voidSchema } from './stock';

const ID1 = '00000000-0000-4000-8000-000000000001';
const ID2 = '00000000-0000-4000-8000-000000000002';

describe('transactionDateSchema (Q16)', () => {
  const today = todayWib();
  it('accepts today and 7 days back', () => {
    expect(transactionDateSchema.safeParse(today).success).toBe(true);
    expect(transactionDateSchema.safeParse(addDays(today, -7)).success).toBe(true);
  });
  it('rejects 8 days back and tomorrow', () => {
    expect(transactionDateSchema.safeParse(addDays(today, -8)).success).toBe(false);
    expect(transactionDateSchema.safeParse(addDays(today, 1)).success).toBe(false);
  });
});

describe('inboundSchema', () => {
  const base = { vendor_id: ID1, transaction_date: todayWib(), notes: '', items: [{ item_id: ID1, unit_id: ID2, qty: '1000' }] };
  it('coerces qty to integer', () => {
    expect(inboundSchema.parse(base).items[0]?.qty).toBe(1000);
  });
  it('rejects empty lines, zero, decimals, duplicates', () => {
    expect(inboundSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(inboundSchema.safeParse({ ...base, items: [{ item_id: ID1, unit_id: ID2, qty: 0 }] }).success).toBe(false);
    expect(inboundSchema.safeParse({ ...base, items: [{ item_id: ID1, unit_id: ID2, qty: 1.5 }] }).success).toBe(false);
    expect(
      inboundSchema.safeParse({ ...base, items: [base.items[0], { item_id: ID1, unit_id: ID2, qty: 2 }] }).success,
    ).toBe(false);
  });
});

describe('adjustmentSchema', () => {
  it('allows physical qty 0 but requires a reason', () => {
    const v = { kind: 'ADJUSTMENT', location_id: ID1, adjustment_date: todayWib(), reason: 'Opname', items: [{ item_id: ID1, physical_qty: 0 }] };
    expect(adjustmentSchema.safeParse(v).success).toBe(true);
    expect(adjustmentSchema.safeParse({ ...v, reason: ' ' }).success).toBe(false);
  });
});

describe('voidSchema', () => {
  it('requires a meaningful reason', () => {
    expect(voidSchema.safeParse({ reason: 'x' }).success).toBe(false);
    expect(voidSchema.safeParse({ reason: 'Salah input qty' }).success).toBe(true);
  });
});
