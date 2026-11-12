import type { ActivityRow } from '@sasana/shared-api';
import { formatQty } from '@sasana/shared-constants';
import type { IconName } from './kit';

/** Ubah aktivitas menjadi kalimat sehari-hari, mis. "Pabrik Cilacap memproduksi 600 Super Rontox". */
export function describeActivity(a: ActivityRow): { icon: IconName; text: string; tone: 'green' | 'blue' | 'orange' | 'red' | 'gray' } {
  const qty = `${formatQty(a.qty)} sachet`;
  const [left = '', right = ''] = a.title.split(a.kind === 'PRODUCTION' ? ' · ' : ' → ');
  switch (a.kind) {
    case 'INBOUND':
      return { icon: 'package-down', tone: 'green', text: `${qty} kemasan dari ${left}` };
    case 'PRODUCTION':
      return { icon: 'factory', tone: 'green', text: `${right} memproduksi ${qty} ${left}` };
    case 'DISTRIBUTION':
      return { icon: 'cart-outline', tone: 'green', text: `${qty} terjual ke ${right}` };
    case 'SHIPMENT_CREATED':
      return { icon: 'truck-outline', tone: 'gray', text: `Kiriman ${left} → ${right} menunggu driver` };
    case 'SHIPMENT_ASSIGNED':
      return { icon: 'truck-outline', tone: 'orange', text: `Kiriman ${left} → ${right} siap diambil driver` };
    case 'SHIPMENT_PICKED_UP':
      return { icon: 'truck-fast', tone: 'blue', text: `${qty} sedang diantar ${left} → ${right}` };
    case 'SHIPMENT_RECEIVED':
      return { icon: 'truck-check', tone: 'green', text: `${qty} sampai di ${right}` };
    case 'SHIPMENT_CANCELLED':
      return { icon: 'truck-remove-outline', tone: 'red', text: `Kiriman ${left} → ${right} dibatalkan` };
  }
}

/** "5 menit lalu", "2 jam lalu", "kemarin". */
export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return 'baru saja';
  if (diff < 60) return `${Math.floor(diff)} menit lalu`;
  if (diff < 24 * 60) return `${Math.floor(diff / 60)} jam lalu`;
  const days = Math.floor(diff / (24 * 60));
  return days === 1 ? 'kemarin' : `${days} hari lalu`;
}
