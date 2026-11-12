import { todayWib } from '@sasana/shared-constants';
import { describe, expect, it } from 'vitest';
import { distributionSchema } from './distribution';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const base = { location_id: A, buyer_id: B, transaction_date: todayWib(), notes: '' };

describe('distributionSchema', () => {
  it('coerces qty and requires a buyer', () => {
    const r = distributionSchema.parse({ ...base, items: [{ item_id: A, unit_id: B, qty: '4' }] });
    expect(r.items[0]?.qty).toBe(4);
    expect(distributionSchema.safeParse({ ...base, buyer_id: '', items: [{ item_id: A, unit_id: B, qty: '1' }] }).success).toBe(false);
  });
  it('rejects duplicate products and empty lines', () => {
    const line = { item_id: A, unit_id: B, qty: '1' };
    expect(distributionSchema.safeParse({ ...base, items: [line, line] }).success).toBe(false);
    expect(distributionSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });
});
