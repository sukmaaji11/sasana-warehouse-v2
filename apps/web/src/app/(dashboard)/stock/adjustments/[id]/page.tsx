import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { AdjustmentDetail } from '@/features/stock/adjustment-pages';

export const metadata: Metadata = { title: 'Detail penyesuaian' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireRole permission="viewStock">
      <AdjustmentDetail id={id} />
    </RequireRole>
  );
}
