import type { Metadata } from 'next';
import { ItemsPage } from '@/features/master/items-page';

export const metadata: Metadata = { title: 'Barang' };

export default function Page() {
  return <ItemsPage />;
}
