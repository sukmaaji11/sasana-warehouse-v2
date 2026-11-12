import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { ProductionForm } from '@/features/production/production-form';

export const metadata: Metadata = { title: 'Input produksi' };

export default function Page() {
  return (
    <RequireRole permission="createProduction">
      <ProductionForm />
    </RequireRole>
  );
}
