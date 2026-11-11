'use client';

import type { Item } from '@sasana/shared-api';
import { ITEM_TYPE_LABELS, type ItemType } from '@sasana/shared-constants';
import { PlusIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ActiveBadge, EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentUser } from '@/features/auth/current-user';
import { can } from '@/features/auth/permissions';
import { ItemDialog } from './item-dialog';
import { useItems } from './queries';
import { formatUnits } from './units';

export function ItemsPage() {
  const user = useCurrentUser();
  const editable = can.manageCatalog(user.role);
  const { data, error, isPending, refetch } = useItems();
  const [type, setType] = useState<ItemType>('FINISHED_GOOD');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const byId = useMemo(() => new Map((data ?? []).map((i) => [i.id, i])), [data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (i) => i.type === type && (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)),
    );
  }, [data, type, search]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Barang"
        description="Packaging dan produk jadi, beserta konversi satuan dan packaging utama."
        actions={
          editable ? (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon /> Tambah barang
            </Button>
          ) : null
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={type} onValueChange={(v) => setType(v as ItemType)}>
          <TabsList>
            <TabsTrigger value="FINISHED_GOOD">{ITEM_TYPE_LABELS.FINISHED_GOOD}</TabsTrigger>
            <TabsTrigger value="PACKAGING">{ITEM_TYPE_LABELS.PACKAGING}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Cari SKU atau nama…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState message={search ? 'Tidak ada yang cocok.' : 'Belum ada barang.'} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Satuan</TableHead>
              {type === 'FINISHED_GOOD' ? <TableHead className="hidden md:table-cell">Packaging utama</TableHead> : null}
              <TableHead className="text-right">Min. stok</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((i) => (
              <ItemRow key={i.id} item={i} packaging={i.packaging ? byId.get(i.packaging.packaging_item_id) : undefined} />
            ))}
          </TableBody>
        </Table>
      )}

      {creating ? <ItemDialog item={null} defaultType={type} onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function ItemRow({ item, packaging }: { item: Item; packaging?: Item }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
      <TableCell className="font-medium">
        <Link href={`/master/items/${item.id}`} className="hover:underline">
          {item.name}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatUnits(item)}</TableCell>
      {item.type === 'FINISHED_GOOD' ? (
        <TableCell className="hidden md:table-cell">
          {packaging ? packaging.name : <span className="text-destructive">Belum diatur</span>}
        </TableCell>
      ) : null}
      <TableCell className="text-right tabular-nums">{item.min_stock.toLocaleString('id-ID')}</TableCell>
      <TableCell>
        <ActiveBadge active={item.is_active} />
      </TableCell>
    </TableRow>
  );
}
