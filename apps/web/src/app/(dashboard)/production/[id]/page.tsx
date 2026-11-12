import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { ProductionDetail } from '@/features/production/production-detail';

export const metadata: Metadata = { title: 'Detail produksi' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireRole permission="viewProduction">
      <ProductionDetail id={id} />
    </RequireRole>
  );
}
