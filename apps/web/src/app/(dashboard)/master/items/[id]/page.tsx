import type { Metadata } from 'next';
import { ItemDetail } from '@/features/master/item-detail';

export const metadata: Metadata = { title: 'Detail barang' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemDetail id={id} />;
}
