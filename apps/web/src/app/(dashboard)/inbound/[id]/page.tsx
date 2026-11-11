import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { InboundDetail } from '@/features/inbound/inbound-detail';

export const metadata: Metadata = { title: 'Detail inbound' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireRole permission="inbound">
      <InboundDetail id={id} />
    </RequireRole>
  );
}
