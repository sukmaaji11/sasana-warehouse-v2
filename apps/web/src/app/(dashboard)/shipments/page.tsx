import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { ShipmentList } from '@/features/shipments/shipment-list';

export const metadata: Metadata = { title: 'Shipment' };

export default function Page() {
  return (
    <RequireRole permission="shipments">
      <ShipmentList />
    </RequireRole>
  );
}
