import { describe, expect, it } from 'vitest';
import { shipmentSchema } from './shipment';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const line = { item_id: A, unit_id: B, qty: '3' };

describe('shipmentSchema', () => {
  it('allows no driver (assigned later) and coerces qty', () => {
    const r = shipmentSchema.parse({ from_location_id: A, to_location_id: B, driver_id: '', notes: '', items: [line] });
    expect(r.driver_id).toBeNull();
    expect(r.items[0]?.qty).toBe(3);
  });
  it('rejects same origin and destination', () => {
    expect(shipmentSchema.safeParse({ from_location_id: A, to_location_id: A, driver_id: '', notes: '', items: [line] }).success).toBe(false);
  });
});
