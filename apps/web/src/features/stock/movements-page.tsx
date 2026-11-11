'use client';

import type { MovementFilter } from '@sasana/shared-api';
import {
  addDays,
  formatDateTime,
  formatQty,
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  todayWib,
  type MovementType,
} from '@sasana/shared-constants';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/features/auth/current-user';
import { useItems } from '@/features/master/queries';
import { cn } from '@/lib/utils';
import { useMovements } from './queries';

const REF_HREF: Record<string, (id: string) => string | null> = {
  inbound: (id) => `/inbound/${id}`,
  stock_adjustment: (id) => `/stock/adjustments/${id}`,
};

export function MovementsPage() {
  const user = useCurrentUser();
  const items = useItems();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Filter disimpan di URL agar bisa dibagikan / di-bookmark.
  const filter: MovementFilter = {
    itemId: params.get('item') ?? undefined,
    locationId: params.get('location') ?? undefined,
    type: (params.get('type') as MovementType | null) ?? undefined,
    from: params.get('from') ?? addDays(todayWib(), -30),
    to: params.get('to') ?? todayWib(),
  };
  const { data, error, isPending, refetch } = useMovements(filter);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/stock" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Stok
      </Link>
      <PageHeader title="Riwayat pergerakan stok" description="Setiap perubahan saldo tercatat di sini (maks. 200 baris terbaru)." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-item">Barang</Label>
          <NativeSelect id="f-item" className="w-full" value={filter.itemId ?? ''} onChange={(e) => setParam('item', e.target.value)}>
            <NativeSelectOption value="">Semua barang</NativeSelectOption>
            {(items.data ?? []).map((i) => (
              <NativeSelectOption key={i.id} value={i.id}>
                {i.sku} · {i.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-loc">Lokasi</Label>
          <NativeSelect id="f-loc" className="w-full" value={filter.locationId ?? ''} onChange={(e) => setParam('location', e.target.value)}>
            <NativeSelectOption value="">Semua lokasi</NativeSelectOption>
            {user.locations.map((l) => (
              <NativeSelectOption key={l.id} value={l.id}>
                {l.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-type">Jenis</Label>
          <NativeSelect id="f-type" className="w-full" value={filter.type ?? ''} onChange={(e) => setParam('type', e.target.value)}>
            <NativeSelectOption value="">Semua jenis</NativeSelectOption>
            {MOVEMENT_TYPES.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {MOVEMENT_LABELS[t]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-from">Dari</Label>
          <Input id="f-from" type="date" value={filter.from} max={filter.to} onChange={(e) => setParam('from', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-to">Sampai</Label>
          <Input id="f-to" type="date" value={filter.to} min={filter.from} onChange={(e) => setParam('to', e.target.value)} />
        </div>
      </div>

      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState message="Tidak ada pergerakan stok pada filter ini." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Dokumen</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Barang</TableHead>
              <TableHead className="hidden md:table-cell">Lokasi</TableHead>
              <TableHead className="text-right">Perubahan</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((m) => {
              const href = REF_HREF[m.ref_type]?.(m.ref_id);
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(m.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {href ? (
                      <Link href={href} className="hover:underline">
                        {m.ref_doc_no}
                      </Link>
                    ) : (
                      m.ref_doc_no
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.movement_type === 'VOID_REVERSAL' ? 'outline' : 'secondary'}>
                      {MOVEMENT_LABELS[m.movement_type as MovementType]}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.item?.name ?? '–'}</TableCell>
                  <TableCell className="hidden md:table-cell">{m.location?.name ?? '–'}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-semibold tabular-nums',
                      m.quantity_delta > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
                    )}
                  >
                    {m.quantity_delta > 0 ? '+' : '−'}
                    {formatQty(Math.abs(m.quantity_delta))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQty(m.balance_after)} <span className="text-xs text-muted-foreground">{m.item?.base_unit}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
