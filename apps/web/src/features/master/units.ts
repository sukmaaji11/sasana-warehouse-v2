import type { Item } from '@sasana/shared-api';

/** "1 dus = 160 sachet · 1 renteng = 10 sachet" (hanya satuan aktif selain base). */
export function formatUnits(item: Item): string {
  const extra = item.item_units
    .filter((u) => !u.is_base && u.is_active)
    .sort((a, b) => b.factor - a.factor)
    .map((u) => `1 ${u.unit_name} = ${u.factor.toLocaleString('id-ID')} ${item.base_unit}`);
  return extra.length ? extra.join(' · ') : item.base_unit;
}
