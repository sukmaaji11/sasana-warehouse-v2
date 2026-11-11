'use client';

import { formatDate, formatDateTime, formatQty } from '@sasana/shared-constants';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { ErrorState, LoadingRows } from '@/components/app/data-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/features/auth/current-user';
import { useInbound } from '@/features/stock/queries';
import { VoidButton } from '@/features/stock/void-button';

export function InboundDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const { data, error, isPending, refetch } = useInbound(id);

  if (isPending) return <LoadingRows />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/inbound" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Inbound
      </Link>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">{data.doc_no}</CardTitle>
            <CardDescription>
              {data.voided_at ? <Badge variant="destructive">Void</Badge> : <Badge variant="secondary">Tercatat</Badge>}
            </CardDescription>
          </div>
          {user.role === 'SUPER_OWNER' && !data.voided_at ? (
            <VoidButton refType="inbound" refId={data.id} docNo={data.doc_no} />
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.voided_at ? (
            <Alert variant="destructive">
              <AlertDescription>
                Di-void {formatDateTime(data.voided_at)} — {data.void_reason}
              </AlertDescription>
            </Alert>
          ) : null}
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Vendor</dt>
            <dd>{data.vendor?.name ?? '–'}</dd>
            <dt className="text-muted-foreground">Tanggal terima</dt>
            <dd>{formatDate(data.transaction_date)}</dd>
            <dt className="text-muted-foreground">Dicatat</dt>
            <dd>
              {formatDateTime(data.created_at)} oleh {data.creator?.full_name ?? '–'}
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
                <TableHead>Barang</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.inbound_items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{l.item?.sku}</span> {l.item?.name}
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
