'use client';

import { getDashboard, type DashboardLocation } from '@sasana/shared-api';
import { formatDate, formatQty, LOCATION_TYPE_LABELS, ROLE_LABELS } from '@sasana/shared-constants';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangleIcon, FileTextIcon } from 'lucide-react';
import Link from 'next/link';
import { ErrorState, LoadingRows } from '@/components/app/data-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/features/auth/current-user';
import { getSupabase } from '@/lib/supabase/client';

export function DashboardHome() {
  const user = useCurrentUser();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard(getSupabase()),
    refetchInterval: 60_000,
  });
  const seesDistribution = user.role !== 'ADMIN_PABRIK';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Halo, {user.full_name}</h1>
          <p className="text-muted-foreground">
            Dashboard {ROLE_LABELS[user.role]}
            {data ? ` · ${formatDate(data.today)}` : ''}
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/reports" />}>
          <FileTextIcon /> Laporan
        </Button>
      </div>

      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : (
        <>
          {data.locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada lokasi yang ditugaskan. Hubungi Super Owner.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.locations.map((l) => (
                <LocationCard key={l.id} l={l} seesDistribution={seesDistribution} />
              ))}
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Shipment</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Menunggu driver" value={data.shipments.created} href="/shipments" />
              <Stat label="Siap pickup" value={data.shipments.assigned} href="/shipments" />
              <Stat label="Dalam perjalanan" value={data.shipments.picked_up} href="/shipments" />
              <Stat label="Diterima bulan ini" value={data.shipments.received_month} href="/shipments" />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangleIcon className="size-4" /> Stok menipis
            </h2>
            {data.low_stock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada stok di bawah minimum.</p>
            ) : (
              <Card>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lokasi</TableHead>
                        <TableHead>Barang</TableHead>
                        <TableHead className="text-right">Stok</TableHead>
                        <TableHead className="text-right">Minimum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.low_stock.map((r) => (
                        <TableRow key={`${r.location_name}-${r.sku}`}>
                          <TableCell>{r.location_name}</TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-muted-foreground">{r.sku}</span> {r.item_name}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-destructive tabular-nums">
                            {formatQty(r.quantity)} {r.base_unit}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatQty(r.min_stock)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function LocationCard({ l, seesDistribution }: { l: DashboardLocation; seesDistribution: boolean }) {
  const rows: [string, string][] = [];
  if (l.type === 'FACTORY') {
    rows.push(['Produksi hari ini', `${formatQty(l.production_today.good)} · reject ${formatQty(l.production_today.reject)}`]);
    rows.push(['Produksi bulan ini', `${formatQty(l.production_month.good)} · reject ${formatQty(l.production_month.reject)}`]);
  }
  if (l.type !== 'WAREHOUSE' && seesDistribution) {
    rows.push(['Distribusi hari ini', formatQty(l.distribution_today)]);
    rows.push(['Distribusi bulan ini', formatQty(l.distribution_month)]);
  }
  if (l.type !== 'SALES_WAREHOUSE') rows.push(['Stok packaging', formatQty(l.packaging_qty)]);
  if (l.type !== 'WAREHOUSE') rows.push(['Stok produk jadi', formatQty(l.finished_qty)]);
  rows.push(['Shipment masuk (di jalan)', String(l.incoming)]);
  rows.push(['Shipment keluar (belum pickup)', String(l.outgoing)]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          {l.name}
          {l.low_count > 0 ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{l.low_count} menipis</span>
          ) : null}
        </CardTitle>
        <CardDescription>
          {l.code} · {LOCATION_TYPE_LABELS[l.type]}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">Satuan sachet.</p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border p-3 transition-colors hover:bg-muted">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}
