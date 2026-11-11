'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createItemUnit,
  queryKeys,
  setProductPackaging,
  updateItemUnit,
  type Item,
  type ItemUnit,
} from '@sasana/shared-api';
import { ITEM_TYPE_LABELS } from '@sasana/shared-constants';
import { itemUnitSchema, type ItemUnitInput, type ItemUnitValues } from '@sasana/shared-validation';
import { ArrowLeftIcon, PencilIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActiveBadge, ErrorState, LoadingRows } from '@/components/app/data-state';
import { FormField } from '@/components/app/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/features/auth/current-user';
import { can } from '@/features/auth/permissions';
import { getSupabase } from '@/lib/supabase/client';
import { ItemDialog } from './item-dialog';
import { ProductLocationsCard } from './product-locations-card';
import { useItems, useSaveMutation } from './queries';

export function ItemDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const editable = can.manageCatalog(user.role);
  const { data, error, isPending, refetch } = useItems();
  const [editingItem, setEditingItem] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ItemUnit | 'new' | null>(null);

  if (isPending) return <LoadingRows />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const item = data.find((i) => i.id === id);
  if (!item) return <ErrorState message="Barang tidak ditemukan." onRetry={() => refetch()} />;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/master/items" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Barang
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{item.name}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{item.sku}</span>
              <Badge variant="secondary">{ITEM_TYPE_LABELS[item.type]}</Badge>
              <ActiveBadge active={item.is_active} />
            </CardDescription>
          </div>
          {editable ? (
            <Button variant="outline" size="sm" onClick={() => setEditingItem(true)}>
              <PencilIcon /> Ubah
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Satuan dasar</dt>
            <dd>{item.base_unit}</dd>
            <dt className="text-muted-foreground">Minimum stok</dt>
            <dd>
              {item.min_stock.toLocaleString('id-ID')} {item.base_unit}
            </dd>
          </dl>
        </CardContent>
      </Card>

      {item.type === 'FINISHED_GOOD' ? <PackagingCard item={item} items={data} editable={editable} /> : null}
      {item.type === 'FINISHED_GOOD' ? <ProductLocationsCard item={item} editable={editable} /> : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Konversi satuan</CardTitle>
            <CardDescription>
              Stok selalu disimpan dalam {item.base_unit}. Satuan lain dikonversi saat input.
            </CardDescription>
          </div>
          {editable ? (
            <Button size="sm" onClick={() => setEditingUnit('new')}>
              <PlusIcon /> Tambah satuan
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Satuan</TableHead>
                <TableHead className="text-right">Isi ({item.base_unit})</TableHead>
                <TableHead>Status</TableHead>
                {editable ? <TableHead className="w-12" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.item_units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.unit_name} {u.is_base ? <Badge variant="outline">dasar</Badge> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{u.factor.toLocaleString('id-ID')}</TableCell>
                  <TableCell>
                    <ActiveBadge active={u.is_active} />
                  </TableCell>
                  {editable ? (
                    <TableCell>
                      {u.is_base ? null : (
                        <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${u.unit_name}`} onClick={() => setEditingUnit(u)}>
                          <PencilIcon />
                        </Button>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingItem ? <ItemDialog item={item} onClose={() => setEditingItem(false)} /> : null}
      {editingUnit ? (
        <UnitDialog item={item} unit={editingUnit === 'new' ? null : editingUnit} onClose={() => setEditingUnit(null)} />
      ) : null}
    </div>
  );
}

function PackagingCard({ item, items, editable }: { item: Item; items: Item[]; editable: boolean }) {
  const current = item.packaging?.packaging_item_id ?? '';
  const [selected, setSelected] = useState(current);
  const options = items.filter((i) => i.type === 'PACKAGING' && (i.is_active || i.id === current));
  const save = useSaveMutation(
    (packagingId: string) => setProductPackaging(getSupabase(), item.id, packagingId),
    [queryKeys.items],
    'Packaging utama disimpan',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Packaging utama</CardTitle>
        <CardDescription>
          Saat produksi, packaging ini berkurang sebanyak jumlah good + reject (rasio 1:1).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {save.error ? (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        ) : null}
        {!current ? (
          <Alert>
            <AlertDescription>Belum diatur. Produk ini belum bisa diproduksi sampai packaging utama dipilih.</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <NativeSelect
            aria-label="Packaging utama"
            className="w-full sm:w-80"
            value={selected}
            disabled={!editable}
            onChange={(e) => setSelected(e.target.value)}
          >
            <NativeSelectOption value="">— Pilih packaging —</NativeSelectOption>
            {options.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.sku} · {p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {editable ? (
            <Button disabled={!selected || selected === current || save.isPending} onClick={() => save.mutate(selected)}>
              {save.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function UnitDialog({ item, unit, onClose }: { item: Item; unit: ItemUnit | null; onClose: () => void }) {
  const form = useForm<ItemUnitInput, unknown, ItemUnitValues>({
    resolver: zodResolver(itemUnitSchema),
    defaultValues: { unit_name: unit?.unit_name ?? '', factor: unit?.factor ?? '', is_active: unit?.is_active ?? true },
  });
  const save = useSaveMutation(
    (v: ItemUnitValues) =>
      unit ? updateItemUnit(getSupabase(), unit.id, v) : createItemUnit(getSupabase(), item.id, v),
    [queryKeys.items],
    unit ? 'Satuan diperbarui' : 'Satuan ditambahkan',
    onClose,
  );
  const { errors } = form.formState;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{unit ? 'Ubah satuan' : 'Tambah satuan'}</DialogTitle>
        </DialogHeader>
        <form id="unit-form" className="flex flex-col gap-3" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          {save.error ? (
            <Alert variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <FormField id="unit_name" label="Nama satuan" error={errors.unit_name?.message} hint="Contoh: renteng, dus">
            <Input id="unit_name" {...form.register('unit_name')} aria-invalid={Boolean(errors.unit_name)} />
          </FormField>
          <FormField id="factor" label={`Isi per satuan (${item.base_unit})`} error={errors.factor?.message} hint="Contoh: 1 dus = 160 sachet → isi 160">
            <Input id="factor" type="number" min={2} inputMode="numeric" {...form.register('factor')} aria-invalid={Boolean(errors.factor)} />
          </FormField>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch id="unit_active" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="unit_active">Aktif</Label>
              </div>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="unit-form" disabled={save.isPending}>
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
