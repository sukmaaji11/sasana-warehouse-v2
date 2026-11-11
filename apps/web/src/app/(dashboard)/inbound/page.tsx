import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { InboundList } from '@/features/inbound/inbound-list';

export const metadata: Metadata = { title: 'Inbound' };

export default function Page() {
  return (
    <RequireRole permission="inbound">
      <InboundList />
    </RequireRole>
  );
}
