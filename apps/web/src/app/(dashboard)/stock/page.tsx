import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { StockPage } from '@/features/stock/stock-page';

export const metadata: Metadata = { title: 'Stok' };

export default function Page() {
  return (
    <RequireRole permission="viewStock">
      <StockPage />
    </RequireRole>
  );
}
