import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { AdjustmentForm } from '@/features/stock/adjustment-form';

export const metadata: Metadata = { title: 'Input stok fisik' };

export default function Page() {
  return (
    <RequireRole permission="adjustStock">
      <AdjustmentForm />
    </RequireRole>
  );
}
