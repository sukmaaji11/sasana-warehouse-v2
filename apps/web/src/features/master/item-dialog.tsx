'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createItem, queryKeys, updateItem, type Item } from '@sasana/shared-api';
import { DEFAULT_MIN_STOCK, ITEM_TYPE_LABELS, ITEM_TYPES, type ItemType } from '@sasana/shared-constants';
import { itemSchema, type ItemInput, type ItemValues } from '@sasana/shared-validation';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { FormField } from '@/components/app/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { getSupabase } from '@/lib/supabase/client';
import { useSaveMutation } from './queries';

export function ItemDialog({
  item,
  defaultType = 'FINISHED_GOOD',
  onClose,
}: {
  item: Item | null;
  defaultType?: ItemType;
  onClose: () => void;
}) {
  const router = useRouter();
  const form = useForm<ItemInput, unknown, ItemValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      sku: item?.sku ?? '',
      name: item?.name ?? '',
      type: item?.type ?? defaultType,
      base_unit: item?.base_unit ?? 'sachet',
      min_stock: item?.min_stock ?? DEFAULT_MIN_STOCK,
      is_active: item?.is_active ?? true,
    },
  });
  const save = useSaveMutation(
    async (v: ItemValues) => {
      if (item) {
        await updateItem(getSupabase(), item.id, v);
        return item.id;
      }
      return createItem(getSupabase(), v);
    },
    [queryKeys.items],
    item ? 'Barang diperbarui' : 'Barang ditambahkan',
  );
  const { errors } = form.formState;

  const submit = form.handleSubmit((v) =>
    save.mutate(v, {
      onSuccess: (id) => {
        onClose();
        // Barang baru: lanjut atur satuan & packaging di halaman detail.
        if (!item && typeof id === 'string') router.push(`/master/items/${id}`);
      },
    }),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Ubah barang' : 'Tambah barang'}</DialogTitle>
        </DialogHeader>
        <form id="item-form" className="flex flex-col gap-3" onSubmit={submit} noValidate>
          {save.error ? (
            <Alert variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <FormField id="sku" label="SKU" error={errors.sku?.message} hint="Contoh: FG-016">
              <Input id="sku" className="uppercase" {...form.register('sku')} aria-invalid={Boolean(errors.sku)} />
            </FormField>
            <FormField id="type" label="Tipe" error={errors.type?.message}>
              <NativeSelect id="type" className="w-full" {...form.register('type')}>
                {ITEM_TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {ITEM_TYPE_LABELS[t]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField id="name" label="Nama barang" error={errors.name?.message}>
            <Input id="name" {...form.register('name')} aria-invalid={Boolean(errors.name)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="base_unit" label="Satuan dasar" error={errors.base_unit?.message} hint="sachet, botol, karton">
              <Input id="base_unit" {...form.register('base_unit')} aria-invalid={Boolean(errors.base_unit)} />
            </FormField>
            <FormField id="min_stock" label="Minimum stok" error={errors.min_stock?.message} hint="Dalam satuan dasar">
              <Input id="min_stock" type="number" min={0} inputMode="numeric" {...form.register('min_stock')} />
            </FormField>
          </div>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch id="item_active" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="item_active">Aktif</Label>
              </div>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="item-form" disabled={save.isPending}>
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
