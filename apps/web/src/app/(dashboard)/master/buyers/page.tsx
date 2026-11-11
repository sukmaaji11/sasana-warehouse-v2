import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { PartyPage } from '@/features/master/party-page';

export const metadata: Metadata = { title: 'Buyer' };

export default function Page() {
  return (
    <RequireRole permission="manageParties">
      <PartyPage table="buyers" />
    </RequireRole>
  );
}
