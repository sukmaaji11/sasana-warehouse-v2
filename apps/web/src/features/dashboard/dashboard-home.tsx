'use client';

import { ACTIVITY_LABELS, getDashboard, type ActivityRow, type Dashboard, type DashboardLocation } from '@sasana/shared-api';
import { formatDate, formatDateTime, formatQty, LOCATION_TYPE_LABELS, ROLE_LABELS, type UserRole } from '@sasana/shared-constants';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BoxesIcon,
  ChevronRightIcon,
  FactoryIcon,
  FileTextIcon,
  PackagePlusIcon,
  SendIcon,
  TrophyIcon,
  TruckIcon,
  WarehouseIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState, LoadingRows } from '@/components/app/data-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentUser } from '@/features/auth/current-user';
import { getSupabase } from '@/lib/supabase/client';

export function DashboardHome() {
  const user = useCurrentUser();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard(getSupabase()),
    refetchInterval: 60_000,
  });

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
          <FlowStrip data={data} role={user.role} />

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Lokasi</h2>
            {data.locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada lokasi yang ditugaskan. Hubungi Super Owner.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.locations.map((l) => (
                  <LocationCard key={l.id} l={l} seesDistribution={user.role !== 'ADMIN_PABRIK'} />
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <ActivityCard rows={data.activity} />
            <div className="flex flex-col gap-4">
              <LowStockCard data={data} />
              {data.top_products.length > 0 ? (
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrophyIcon className="size-4 text-amber-600" /> Produk terlaris bulan ini
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="flex flex-col gap-1.5 text-sm">
                      {data.top_products.map((p, i) => (
                        <li key={p.sku} className="flex justify-between gap-3">
                          <span>
                            <span className="text-muted-foreground">{i + 1}.</span> {p.name}
                          </span>
                          <span className="font-medium tabular-nums">{formatQty(p.qty)}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Alur bisnis: kemasan → pabrik → produksi → gudang penjualan → buyer
// ---------------------------------------------------------------------
function FlowStrip({ data, role }: { data: Dashboard; role: UserRole }) {
  const [period, setPeriod] = useState<'month' | 'today'>('month');
  const f = data.flow[period];
  const steps: { icon: LucideIcon; label: string; value: number; hint?: string; show: boolean }[] = [
    { icon: PackagePlusIcon, label: 'Kemasan masuk', value: f.inbound, hint: 'dari vendor', show: role === 'SUPER_OWNER' || role === 'ADMIN_GUDANG' },
    { icon: TruckIcon, label: 'Kemasan ke pabrik', value: f.packaging_to_factory, hint: 'diterima pabrik', show: true },
    { icon: FactoryIcon, label: 'Diproduksi', value: f.produced, hint: `reject ${formatQty(f.rejected)}`, show: true },
    { icon: WarehouseIcon, label: 'Ke gudang penjualan', value: f.goods_to_sales, hint: 'diterima', show: true },
    { icon: SendIcon, label: 'Keluar ke buyer', value: f.distributed, hint: 'distribusi', show: role !== 'ADMIN_PABRIK' },
  ];
  const visible = steps.filter((s) => s.show);
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">Alur barang</CardTitle>
          <CardDescription>
            Dari kemasan sampai ke buyer · satuan sachet
            {f.in_transit > 0 ? ` · ${formatQty(f.in_transit)} sedang dalam perjalanan` : ''}
          </CardDescription>
        </div>
        <div className="flex rounded-lg border p-0.5 text-xs">
          {(['today', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 ${period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {p === 'today' ? 'Hari ini' : 'Bulan ini'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid grid-cols-2 gap-2 md:flex md:items-stretch">
          {visible.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2 md:flex-1">
              <div className="flex flex-1 flex-col gap-1 rounded-lg bg-muted/60 p-3">
                <s.icon className="size-4 text-primary" />
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="text-xl font-semibold tabular-nums">{formatQty(s.value)}</span>
                {s.hint ? <span className="text-xs text-muted-foreground">{s.hint}</span> : null}
              </div>
              {i < visible.length - 1 ? <ArrowRightIcon className="hidden size-4 shrink-0 text-muted-foreground md:block" /> : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Kartu lokasi ringkas + detail dalam modal
// ---------------------------------------------------------------------
function locationRows(l: DashboardLocation, seesDistribution: boolean): [string, string][] {
  const rows: [string, string][] = [];
  if (l.type === 'FACTORY') {
    rows.push(['Produksi hari ini', `${formatQty(l.production_today.good)} · reject ${formatQty(l.production_today.reject)}`]);
    rows.push(['Produksi bulan ini', `${formatQty(l.production_month.good)} · reject ${formatQty(l.production_month.reject)}`]);
  }
  if (l.type !== 'WAREHOUSE' && seesDistribution) {
    rows.push(['Distribusi hari ini', formatQty(l.distribution_today)]);
    rows.push(['Distribusi bulan ini', formatQty(l.distribution_month)]);
  }
  if (l.type !== 'SALES_WAREHOUSE') rows.push(['Stok kemasan', formatQty(l.packaging_qty)]);
  if (l.type !== 'WAREHOUSE') rows.push(['Stok produk jadi', formatQty(l.finished_qty)]);
  rows.push(['Shipment masuk (di jalan)', String(l.incoming)]);
  rows.push(['Shipment keluar (belum pickup)', String(l.outgoing)]);
  rows.push(['Barang menipis', String(l.low_count)]);
  return rows;
}

/** Dua angka utama per tipe lokasi. */
function keyStats(l: DashboardLocation, seesDistribution: boolean): [string, number][] {
  if (l.type === 'FACTORY') return [['Produksi bulan ini', l.production_month.good], ['Stok produk', l.finished_qty]];
  if (l.type === 'SALES_WAREHOUSE')
    return seesDistribution ? [['Stok produk', l.finished_qty], ['Distribusi bulan ini', l.distribution_month]] : [['Stok produk', l.finished_qty]];
  return [['Stok kemasan', l.packaging_qty], ['Shipment keluar', l.outgoing]];
}

const LOCATION_ICON = { WAREHOUSE: BoxesIcon, FACTORY: FactoryIcon, SALES_WAREHOUSE: WarehouseIcon } as const;

function LocationCard({ l, seesDistribution }: { l: DashboardLocation; seesDistribution: boolean }) {
  const [open, setOpen] = useState(false);
  const Icon = LOCATION_ICON[l.type];
  return (
    <>
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{l.name}</p>
              <p className="text-xs text-muted-foreground">{LOCATION_TYPE_LABELS[l.type]}</p>
            </div>
            {l.low_count > 0 ? (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{l.low_count} menipis</span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {keyStats(l, seesDistribution).map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="text-lg font-semibold tabular-nums">{formatQty(v)}</p>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="self-start px-0" onClick={() => setOpen(true)}>
            Lihat detail <ChevronRightIcon />
          </Button>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{l.name}</DialogTitle>
            <DialogDescription>
              {l.code} · {LOCATION_TYPE_LABELS[l.type]} · satuan sachet
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
            {locationRows(l, seesDistribution).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/stock" />}>
              Lihat stok
            </Button>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/shipments" />}>
              Lihat shipment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------
// Aktivitas terbaru & stok menipis
// ---------------------------------------------------------------------
const ACTIVITY_HREF: Record<string, (id: string) => string> = {
  INBOUND: (id) => `/inbound/${id}`,
  PRODUCTION: (id) => `/production/${id}`,
  DISTRIBUTION: (id) => `/distribution/${id}`,
};

function ActivityCard({ rows }: { rows: ActivityRow[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base">Aktivitas terbaru</CardTitle>
        <CardDescription>12 transaksi terakhir di lokasi Anda</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((a) => {
              const href = (ACTIVITY_HREF[a.kind] ?? ((id: string) => `/shipments/${id}`))(a.id);
              return (
                <li key={`${a.kind}-${a.id}`}>
                  <Link href={href} className="flex items-center gap-3 py-2 hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {ACTIVITY_LABELS[a.kind]}
                        {a.voided ? <span className="ml-2 text-xs text-destructive">VOID</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.title} · {a.doc_no} · {formatDateTime(a.at)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatQty(a.qty)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LowStockCard({ data }: { data: Dashboard }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangleIcon className="size-4 text-destructive" /> Stok menipis
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.low_stock.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semua stok di atas minimum.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {data.low_stock.slice(0, 8).map((r) => (
              <li key={`${r.location_name}-${r.sku}`} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate">{r.item_name}</span>
                  <span className="text-xs text-muted-foreground">{r.location_name}</span>
                </span>
                <span className="shrink-0 text-right font-semibold text-destructive tabular-nums">
                  {formatQty(r.quantity)} <span className="text-xs font-normal text-muted-foreground">/ {formatQty(r.min_stock)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
