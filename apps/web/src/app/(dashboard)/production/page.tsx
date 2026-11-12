import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { ProductionList } from '@/features/production/production-list';

export const metadata: Metadata = { title: 'Produksi' };

export default function Page() {
  return (
    <RequireRole permission="viewProduction">
      <ProductionList />
    </RequireRole>
  );
}
