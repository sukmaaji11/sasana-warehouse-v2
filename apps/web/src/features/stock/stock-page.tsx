'use client';

import { formatDateTime, formatQty, ITEM_TYPE_LABELS, type ItemType } from '@sasana/shared-constants';
import { HistoryIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentUser } from '@/features/auth/current-user';
import { useStockLevels } from './queries';

export function StockPage() {
  const user = useCurrentUser();
  const { data, error, isPending, refetch } = useStockLevels();
  const [type, setType] = useState<ItemType | 'ALL'>('ALL');
  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (type === 'ALL' || r.item_type === type) &&
        (!locationId || r.location_id === locationId) &&
        (!lowOnly || r.is_low) &&
        (!q || r.item_name?.toLowerCase().includes(q) || r.sku?.toLowerCase().includes(q)),
    );
  }, [data, type, locationId, search, lowOnly]);
  const lowCount = (data ?? []).filter((r) => r.is_low).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stok"
        description="Saldo per barang per lokasi (dalam satuan dasar)."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/stock/movements" />}>
            <HistoryIcon /> Riwayat pergerakan
          </Button>
        }
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={type} onValueChange={(v) => setType(v as ItemType | 'ALL')}>
          <TabsList>
            <TabsTrigger value="ALL">Semua</TabsTrigger>
            <TabsTrigger value="PACKAGING">{ITEM_TYPE_LABELS.PACKAGING}</TabsTrigger>
            <TabsTrigger value="FINISHED_GOOD">{ITEM_TYPE_LABELS.FINISHED_GOOD}</TabsTrigger>
          </TabsList>
        </Tabs>
        <NativeSelect aria-label="Lokasi" value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full lg:w-60">
          <NativeSelectOption value="">Semua lokasi</NativeSelectOption>
          {user.locations.map((l) => (
            <NativeSelectOption key={l.id} value={l.id}>
              {l.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <div className="relative w-full lg:max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Cari SKU atau nama…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <Checkbox checked={lowOnly} onCheckedChange={(c) => setLowOnly(Boolean(c))} />
          Hanya stok menipis {lowCount > 0 ? <Badge variant="destructive">{lowCount}</Badge> : null}
        </label>
      </div>

      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          message={
            data.length === 0
              ? 'Belum ada stok tercatat. Super Owner dapat menginput stok awal di menu Stok Awal & Penyesuaian.'
              : 'Tidak ada stok yang cocok dengan filter.'
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Barang</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="hidden text-right md:table-cell">Min.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Diperbarui</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.item_id}:${r.location_id}`}>
                <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/stock/movements?item=${r.item_id}&location=${r.location_id}`}
                    className="hover:underline"
                  >
                    {r.item_name}
                  </Link>
                </TableCell>
                <TableCell>{r.location_name}</TableCell>
                <TableCell className="text-right text-base font-semibold tabular-nums">
                  {formatQty(r.quantity ?? 0)} <span className="text-xs font-normal text-muted-foreground">{r.base_unit}</span>
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                  {formatQty(r.min_stock ?? 0)}
                </TableCell>
                <TableCell>{r.is_low ? <Badge variant="destructive">Menipis</Badge> : <Badge variant="secondary">Aman</Badge>}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  {r.updated_at ? formatDateTime(r.updated_at) : '–'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
