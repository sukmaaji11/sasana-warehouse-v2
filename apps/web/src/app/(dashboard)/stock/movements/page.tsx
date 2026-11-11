import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireRole } from '@/features/auth/require-role';
import { MovementsPage } from '@/features/stock/movements-page';

export const metadata: Metadata = { title: 'Riwayat stok' };

export default function Page() {
  return (
    <RequireRole permission="viewStock">
      <Suspense>
        <MovementsPage />
      </Suspense>
    </RequireRole>
  );
}
