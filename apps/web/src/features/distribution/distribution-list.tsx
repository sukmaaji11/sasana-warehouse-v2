'use client';

import { distributionOrigins } from '@sasana/shared-api';
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
import { useDistributions } from './queries';

export function DistributionList() {
  const user = useCurrentUser();
  const sources = user.locations.filter((l) => l.type === 'FACTORY' || l.type === 'SALES_WAREHOUSE');
  const [locationId, setLocationId] = useState('');
  const { data, error, isPending, refetch } = useDistributions(locationId ? { locationId } : {});
  const canCreate = distributionOrigins(user).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Distribusi"
        description="Produk jadi keluar ke buyer (termasuk konsumsi internal). Stok lokasi asal berkurang."
        actions={
          canCreate ? (
            <Button nativeButton={false} render={<Link href="/distribution/new" />}>
              <PlusIcon /> Distribusi baru
            </Button>
          ) : null
        }
      />
      {sources.length > 1 ? (
        <NativeSelect aria-label="Filter lokasi" className="w-60" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <NativeSelectOption value="">Semua lokasi</NativeSelectOption>
          {sources.map((l) => (
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
        <EmptyState message="Belum ada distribusi." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. dokumen</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="hidden md:table-cell">Dari</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead className="text-right">Produk</TableHead>
              <TableHead className="hidden text-right md:table-cell">Total (satuan dasar)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/distribution/${r.id}`} className="hover:underline">
                    {r.doc_no}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(r.transaction_date)}</TableCell>
                <TableCell className="hidden md:table-cell">{r.location?.name ?? '–'}</TableCell>
                <TableCell>{r.buyer_name}</TableCell>
                <TableCell className="text-right tabular-nums">{r.distribution_items.length}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {formatQty(r.distribution_items.reduce((s, l) => s + (l.base_qty ?? 0), 0))}
                </TableCell>
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
