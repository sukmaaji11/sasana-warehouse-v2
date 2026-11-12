'use client';

import { formatDateTime, formatQty, SHIPMENT_ACTIVE, type ShipmentStatus } from '@sasana/shared-constants';
import { ArrowRightIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentUser } from '@/features/auth/current-user';
import { StatusBadge, useShipments } from './shared';

const FILTERS: Record<string, { label: string; statuses?: readonly ShipmentStatus[] }> = {
  active: { label: 'Berjalan', statuses: SHIPMENT_ACTIVE },
  transit: { label: 'Dalam perjalanan', statuses: ['PICKED_UP'] },
  done: { label: 'Diterima', statuses: ['RECEIVED'] },
  cancelled: { label: 'Dibatalkan', statuses: ['CANCELLED'] },
  all: { label: 'Semua' },
};

export function ShipmentList() {
  const user = useCurrentUser();
  const [filter, setFilter] = useState('active');
  const { data, error, isPending, refetch } = useShipments(FILTERS[filter]?.statuses);
  const canCreate = user.role !== 'DRIVER';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Shipment"
        description="Perpindahan barang antar lokasi internal. Stok asal berkurang saat pickup, stok tujuan bertambah saat diterima."
        actions={
          canCreate ? (
            <Button nativeButton={false} render={<Link href="/shipments/new" />}>
              <PlusIcon /> Shipment baru
            </Button>
          ) : null
        }
      />
      <Tabs value={filter} onValueChange={(v) => setFilter(String(v))}>
        <TabsList>
          {Object.entries(FILTERS).map(([k, f]) => (
            <TabsTrigger key={k} value={k}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState message="Tidak ada shipment." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. dokumen</TableHead>
              <TableHead>Rute</TableHead>
              <TableHead className="hidden md:table-cell">Driver</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Isi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Dibuat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/shipments/${s.id}`} className="hover:underline">
                    {s.doc_no}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    {s.from_location?.name} <ArrowRightIcon className="size-3.5 text-muted-foreground" /> {s.to_location?.name}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">{s.driver?.full_name ?? '–'}</TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">
                  {s.shipment_items.length} barang · {formatQty(s.shipment_items.reduce((t, l) => t + (l.base_qty ?? 0), 0))}
                </TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{formatDateTime(s.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
