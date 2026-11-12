'use client';

import { formatDate, formatDateTime, formatQty } from '@sasana/shared-constants';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { ErrorState, LoadingRows } from '@/components/app/data-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/current-user';
import { can } from '@/features/auth/permissions';
import { VoidButton } from '@/features/stock/void-button';
import { useProduction } from './queries';

export function ProductionDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const { data, error, isPending, refetch } = useProduction(id);

  if (isPending) return <LoadingRows />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const unit = data.product?.base_unit ?? '';
  const pkgUnit = data.packaging?.base_unit ?? '';

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/production" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Produksi
      </Link>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-xl">{data.doc_no}</CardTitle>
            <CardDescription>
              {data.voided_at ? <Badge variant="destructive">Void</Badge> : <Badge variant="secondary">Tercatat</Badge>}
            </CardDescription>
          </div>
          {can.voidProduction(user.role) && !data.voided_at ? (
            <VoidButton refType="production" refId={data.id} docNo={data.doc_no} />
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
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Good"
              value={`${formatQty(data.qty_good ?? 0)} ${unit}`}
              hint={data.factor > 1 ? `${formatQty(data.input_qty_good)} ${data.unit_name}` : undefined}
            />
            <Stat label="Reject" value={`${formatQty(data.qty_reject)} ${pkgUnit}`} />
            <Stat label="Kemasan terpakai" value={`${formatQty(data.packaging_consumed ?? 0)} ${pkgUnit}`} />
          </div>
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Pabrik</dt>
            <dd>{data.location?.name ?? '–'}</dd>
            <dt className="text-muted-foreground">Produk</dt>
            <dd>
              <span className="font-mono text-xs text-muted-foreground">{data.product?.sku}</span> {data.product?.name}
            </dd>
            <dt className="text-muted-foreground">Kemasan</dt>
            <dd>
              <span className="font-mono text-xs text-muted-foreground">{data.packaging?.sku}</span> {data.packaging?.name}
            </dd>
            <dt className="text-muted-foreground">Tanggal produksi</dt>
            <dd>{formatDate(data.production_date)}</dd>
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
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
