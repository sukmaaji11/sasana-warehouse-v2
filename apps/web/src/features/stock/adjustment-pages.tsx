'use client';

import { ADJUSTMENT_KIND_LABELS, formatDate, formatDateTime, formatQty, type AdjustmentKind } from '@sasana/shared-constants';
import { ArrowLeftIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { PageHeader } from '@/components/app/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/features/auth/current-user';
import { cn } from '@/lib/utils';
import { useAdjustment, useAdjustments } from './queries';
import { VoidButton } from './void-button';

export function AdjustmentList() {
  const user = useCurrentUser();
  const { data, error, isPending, refetch } = useAdjustments();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stok awal & penyesuaian"
        description="Input stok hasil hitung fisik dan koreksi selisih (stock opname)."
        actions={
          user.role === 'SUPER_OWNER' ? (
            <Button nativeButton={false} render={<Link href="/stock/adjustments/new" />}>
              <PlusIcon /> Input stok fisik
            </Button>
          ) : null
        }
      />
      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState message="Belum ada stok awal atau penyesuaian." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. dokumen</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="text-right">Barang</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/stock/adjustments/${r.id}`} className="hover:underline">
                    {r.doc_no}
                  </Link>
                </TableCell>
                <TableCell>{ADJUSTMENT_KIND_LABELS[r.kind as AdjustmentKind]}</TableCell>
                <TableCell>{r.location?.name}</TableCell>
                <TableCell>{formatDate(r.adjustment_date)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.stock_adjustment_items.length}</TableCell>
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

export function AdjustmentDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const { data, error, isPending, refetch } = useAdjustment(id);
  if (isPending) return <LoadingRows />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/stock/adjustments" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Stok awal & penyesuaian
      </Link>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">{data.doc_no}</CardTitle>
            <CardDescription className="flex gap-2">
              <Badge variant="secondary">{ADJUSTMENT_KIND_LABELS[data.kind as AdjustmentKind]}</Badge>
              {data.voided_at ? <Badge variant="destructive">Void</Badge> : null}
            </CardDescription>
          </div>
          {user.role === 'SUPER_OWNER' && !data.voided_at ? (
            <VoidButton refType="stock_adjustment" refId={data.id} docNo={data.doc_no} />
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
            <dt className="text-muted-foreground">Lokasi</dt>
            <dd>{data.location?.name}</dd>
            <dt className="text-muted-foreground">Tanggal hitung</dt>
            <dd>{formatDate(data.adjustment_date)}</dd>
            <dt className="text-muted-foreground">Alasan</dt>
            <dd>{data.reason}</dd>
            <dt className="text-muted-foreground">Dicatat</dt>
            <dd>
              {formatDateTime(data.created_at)} oleh {data.creator?.full_name ?? '–'}
            </dd>
          </dl>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barang</TableHead>
                <TableHead className="text-right">Sistem</TableHead>
                <TableHead className="text-right">Fisik</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stock_adjustment_items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{l.item?.sku}</span> {l.item?.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(l.system_qty)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatQty(l.physical_qty)} {l.item?.base_unit}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      (l.delta ?? 0) > 0 ? 'text-emerald-700' : (l.delta ?? 0) < 0 ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {(l.delta ?? 0) > 0 ? '+' : (l.delta ?? 0) < 0 ? '−' : ''}
                    {formatQty(Math.abs(l.delta ?? 0))}
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
