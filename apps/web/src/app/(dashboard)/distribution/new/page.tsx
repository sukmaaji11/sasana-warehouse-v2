import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { DistributionForm } from '@/features/distribution/distribution-form';

export const metadata: Metadata = { title: 'Distribusi baru' };

export default function Page() {
  return (
    <RequireRole permission="createDistribution">
      <DistributionForm />
    </RequireRole>
  );
}
