'use client';

import { canVoidDistribution } from '@sasana/shared-api';
import { formatDate, formatDateTime, formatQty } from '@sasana/shared-constants';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { ErrorState, LoadingRows } from '@/components/app/data-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/features/auth/current-user';
import { VoidButton } from '@/features/stock/void-button';
import { useDistribution } from './queries';

export function DistributionDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const { data, error, isPending, refetch } = useDistribution(id);

  if (isPending) return <LoadingRows />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/distribution" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Distribusi
      </Link>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">{data.doc_no}</CardTitle>
            <CardDescription>
              {data.voided_at ? <Badge variant="destructive">Void</Badge> : <Badge variant="secondary">Tercatat</Badge>}
            </CardDescription>
          </div>
          {canVoidDistribution(user, data.location_id) && !data.voided_at ? (
            <VoidButton refType="distribution" refId={data.id} docNo={data.doc_no} />
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.voided_at ? (
            <Alert variant="destructive">
              <AlertDescription>
                Di-void {formatDateTime(data.voided_at)} — {data.void_reason}. Stok sudah dikembalikan ke lokasi asal.
              </AlertDescription>
            </Alert>
          ) : null}
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Dari</dt>
            <dd>{data.location?.name ?? '–'}</dd>
            <dt className="text-muted-foreground">Buyer</dt>
            <dd className="font-medium">{data.buyer_name}</dd>
            <dt className="text-muted-foreground">Tanggal</dt>
            <dd>{formatDate(data.transaction_date)}</dd>
            <dt className="text-muted-foreground">Dicatat</dt>
            <dd>
              {formatDateTime(data.created_at)}
              {data.creator?.full_name ? ` oleh ${data.creator.full_name}` : ''}
            </dd>
            {data.notes ? (
              <>
                <dt className="text-muted-foreground">Catatan</dt>
                <dd>{data.notes}</dd>
              </>
            ) : null}
          </dl>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Satuan dasar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.distribution_items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{l.item?.sku}</span> {l.item?.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQty(l.input_qty)} {l.unit_name}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatQty(l.base_qty ?? 0)} {l.item?.base_unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
