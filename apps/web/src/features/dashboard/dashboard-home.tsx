'use client';

import { LOCATION_TYPE_LABELS, ROLE_LABELS, type UserRole } from '@sasana/shared-constants';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/current-user';

const ROLE_SUMMARY: Record<UserRole, string> = {
  SUPER_OWNER: 'Ringkasan global seluruh lokasi akan tampil di sini (Phase 7).',
  ADMIN_GUDANG: 'Stok packaging, inbound, dan status shipment akan tampil di sini (Phase 3, 4, 7).',
  OWNER_PABRIK: 'Stok pabrik, produksi, dan distribusi akan tampil di sini (Phase 5, 6, 7).',
  DRIVER: '',
};

export function DashboardHome() {
  const user = useCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Halo, {user.full_name}</h1>
        <p className="text-muted-foreground">Dashboard {ROLE_LABELS[user.role]}</p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Lokasi Anda</h2>
        {user.locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada lokasi yang ditugaskan. Hubungi Super Owner.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {user.locations.map((loc) => (
              <Card key={loc.id}>
                <CardHeader>
                  <CardTitle>{loc.name}</CardTitle>
                  <CardDescription>
                    {loc.code} · {LOCATION_TYPE_LABELS[loc.type]}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>
      <p className="text-sm text-muted-foreground">{ROLE_SUMMARY[user.role]}</p>
    </div>
  );
}
