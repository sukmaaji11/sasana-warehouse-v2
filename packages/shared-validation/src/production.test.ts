import { todayWib } from '@sasana/shared-constants';
import { describe, expect, it } from 'vitest';
import { productionSchema } from './production';

const A = '00000000-0000-4000-8000-00000000000a';
const base = { location_id: A, finished_item_id: A, unit_id: A, production_date: todayWib(), notes: '' };

describe('productionSchema', () => {
  it('coerces good and reject', () => {
    const r = productionSchema.parse({ ...base, qty_good: '2', qty_reject: '15' });
    expect(r.qty_good).toBe(2);
    expect(r.qty_reject).toBe(15);
  });
  it('allows reject only', () => {
    expect(productionSchema.safeParse({ ...base, qty_good: '0', qty_reject: '5' }).success).toBe(true);
  });
  it('rejects both zero and negatives', () => {
    expect(productionSchema.safeParse({ ...base, qty_good: '0', qty_reject: '0' }).success).toBe(false);
    expect(productionSchema.safeParse({ ...base, qty_good: '-1', qty_reject: '5' }).success).toBe(false);
  });
});
