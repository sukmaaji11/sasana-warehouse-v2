import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { ReportsPage } from '@/features/reports/reports-page';

export const metadata: Metadata = { title: 'Laporan' };

export default function Page() {
  return (
    <RequireRole permission="viewReports">
      <ReportsPage />
    </RequireRole>
  );
}
