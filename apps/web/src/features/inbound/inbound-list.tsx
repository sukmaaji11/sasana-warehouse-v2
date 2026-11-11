'use client';

import { formatDate, formatQty } from '@sasana/shared-constants';
import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useInbounds } from '@/features/stock/queries';

export function InboundList() {
  const { data, error, isPending, refetch } = useInbounds();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inbound"
        description="Penerimaan packaging dari vendor ke gudang pusat."
        actions={
          <Button nativeButton={false} render={<Link href="/inbound/new" />}>
            <PlusIcon /> Inbound baru
          </Button>
        }
      />
      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState message="Belum ada inbound." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. dokumen</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Baris</TableHead>
              <TableHead className="hidden text-right md:table-cell">Total (satuan dasar)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/inbound/${r.id}`} className="hover:underline">
                    {r.doc_no}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(r.transaction_date)}</TableCell>
                <TableCell>{r.vendor?.name ?? '–'}</TableCell>
                <TableCell className="text-right tabular-nums">{r.inbound_items.length}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {formatQty(r.inbound_items.reduce((s, l) => s + (l.base_qty ?? 0), 0))}
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
