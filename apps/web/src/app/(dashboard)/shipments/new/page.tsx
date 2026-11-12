import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { ShipmentForm } from '@/features/shipments/shipment-form';

export const metadata: Metadata = { title: 'Shipment baru' };

export default function Page() {
  return (
    <RequireRole permission="shipments">
      <ShipmentForm />
    </RequireRole>
  );
}
