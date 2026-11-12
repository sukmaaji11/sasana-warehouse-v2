import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { DistributionDetail } from '@/features/distribution/distribution-detail';

export const metadata: Metadata = { title: 'Detail distribusi' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireRole permission="viewDistribution">
      <DistributionDetail id={id} />
    </RequireRole>
  );
}
