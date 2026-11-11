'use client';

import { queryKeys, setProductLocation, type Item } from '@sasana/shared-api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useProductLocations } from '@/features/stock/queries';
import { getSupabase } from '@/lib/supabase/client';
import { useLocations, useSaveMutation } from './queries';

/** Q8: produk hanya boleh diproduksi di pabrik yang dicentang. */
export function ProductLocationsCard({ item, editable }: { item: Item; editable: boolean }) {
  const locations = useLocations();
  const mapping = useProductLocations();
  const toggle = useSaveMutation(
    (v: { locationId: string; enabled: boolean }) => setProductLocation(getSupabase(), item.id, v.locationId, v.enabled),
    [queryKeys.productLocations],
    'Pabrik produksi diperbarui',
  );

  const factories = (locations.data ?? []).filter((l) => l.type === 'FACTORY' && l.is_active);
  const enabled = new Set((mapping.data ?? []).filter((m) => m.finished_item_id === item.id).map((m) => m.location_id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diproduksi di</CardTitle>
        <CardDescription>Produksi produk ini hanya bisa diinput di pabrik yang dicentang.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {toggle.error ? (
          <Alert variant="destructive">
            <AlertDescription>{toggle.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {enabled.size === 0 && !mapping.isPending ? (
          <Alert>
            <AlertDescription>Belum ada pabrik. Produk ini belum bisa diproduksi.</AlertDescription>
          </Alert>
        ) : null}
        {factories.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={enabled.has(f.id)}
              disabled={!editable || toggle.isPending || mapping.isPending}
              onCheckedChange={(c) => toggle.mutate({ locationId: f.id, enabled: Boolean(c) })}
            />
            {f.name}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
