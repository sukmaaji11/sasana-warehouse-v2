import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { ShipmentDetail } from '@/features/shipments/shipment-detail';

export const metadata: Metadata = { title: 'Detail shipment' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireRole permission="shipments">
      <ShipmentDetail id={id} />
    </RequireRole>
  );
}
