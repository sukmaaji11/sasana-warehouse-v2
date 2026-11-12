import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { DistributionList } from '@/features/distribution/distribution-list';

export const metadata: Metadata = { title: 'Distribusi' };

export default function Page() {
  return (
    <RequireRole permission="viewDistribution">
      <DistributionList />
    </RequireRole>
  );
}
