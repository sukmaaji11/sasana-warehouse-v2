import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { LocationsPage } from '@/features/master/locations-page';

export const metadata: Metadata = { title: 'Lokasi' };

export default function Page() {
  return (
    <RequireRole permission="manageCatalog">
      <LocationsPage />
    </RequireRole>
  );
}
