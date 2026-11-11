import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { InboundForm } from '@/features/inbound/inbound-form';

export const metadata: Metadata = { title: 'Inbound baru' };

export default function Page() {
  return (
    <RequireRole permission="inbound">
      <InboundForm />
    </RequireRole>
  );
}
