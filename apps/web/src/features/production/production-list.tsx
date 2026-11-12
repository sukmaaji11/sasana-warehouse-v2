'use client';

import { formatDate, formatQty } from '@sasana/shared-constants';
import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/features/auth/current-user';
import { can } from '@/features/auth/permissions';
import { useProductions } from './queries';

export function ProductionList() {
  const user = useCurrentUser();
  const factories = user.locations.filter((l) => l.type === 'FACTORY');
  const [locationId, setLocationId] = useState('');
  const { data, error, isPending, refetch } = useProductions(locationId ? { locationId } : {});

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Produksi"
        description="Packaging terpakai = good + reject. Produk jadi bertambah sebanyak good."
        actions={
          can.createProduction(user.role) ? (
            <Button nativeButton={false} render={<Link href="/production/new" />}>
              <PlusIcon /> Input produksi
            </Button>
          ) : null
        }
      />
      {factories.length > 1 ? (
        <NativeSelect aria-label="Filter pabrik" className="w-56" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <NativeSelectOption value="">Semua pabrik</NativeSelectOption>
          {factories.map((l) => (
            <NativeSelectOption key={l.id} value={l.id}>
              {l.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}
      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState message="Belum ada produksi." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. dokumen</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="hidden md:table-cell">Pabrik</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead className="text-right">Good</TableHead>
              <TableHead className="text-right">Reject</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/production/${r.id}`} className="hover:underline">
                    {r.doc_no}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(r.production_date)}</TableCell>
                <TableCell className="hidden md:table-cell">{r.location?.name ?? '–'}</TableCell>
                <TableCell>{r.product?.name ?? '–'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQty(r.qty_good ?? 0)} <span className="text-muted-foreground">{r.product?.base_unit}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatQty(r.qty_reject)}</TableCell>
                <TableCell>
                  {r.voided_at ? <Badge variant="destructive">Void</Badge> : <Badge variant="secondary">Tercatat</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
