import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { AdjustmentList } from '@/features/stock/adjustment-pages';

export const metadata: Metadata = { title: 'Stok awal & penyesuaian' };

export default function Page() {
  return (
    <RequireRole permission="viewStock">
      <AdjustmentList />
    </RequireRole>
  );
}
