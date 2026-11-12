'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createProduction, queryKeys } from '@sasana/shared-api';
import { formatQty, minTransactionDate, todayWib } from '@sasana/shared-constants';
import { productionSchema, type ProductionInput, type ProductionValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { FormField } from '@/components/app/form-field';
import { PageHeader } from '@/components/app/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/current-user';
import { useItems } from '@/features/master/queries';
import { newIdempotencyKey, STOCK_INVALIDATE, useProductLocations, useStockLevels } from '@/features/stock/queries';
import { useOnline } from '@/hooks/use-online';
import { getSupabase } from '@/lib/supabase/client';

export function ProductionForm() {
  const user = useCurrentUser();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const items = useItems();
  const productLocations = useProductLocations();
  const stock = useStockLevels();
  // Satu key per form: retry setelah gagal jaringan tidak menggandakan stok.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState<ProductionValues | null>(null);
  const factories = user.locations.filter((l) => l.type === 'FACTORY');

  const form = useForm<ProductionInput, unknown, ProductionValues>({
    resolver: zodResolver(productionSchema),
    defaultValues: {
      location_id: factories.length === 1 ? factories[0]!.id : '',
      finished_item_id: '',
      unit_id: '',
      qty_good: '',
      qty_reject: '0',
      production_date: todayWib(),
      notes: '',
    },
  });
  const v = useWatch({ control: form.control });

  const byId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  // Q8: hanya produk yang terdaftar di pabrik terpilih.
  const products = useMemo(() => {
    const allowed = new Set((productLocations.data ?? []).filter((p) => p.location_id === v.location_id).map((p) => p.finished_item_id));
    return (items.data ?? []).filter((i) => i.type === 'FINISHED_GOOD' && i.is_active && allowed.has(i.id));
  }, [items.data, productLocations.data, v.location_id]);

  const product = byId.get(v.finished_item_id ?? '');
  const packaging = product?.packaging ? byId.get(product.packaging.packaging_item_id) : undefined;
  const unit = product?.item_units.find((u) => u.id === v.unit_id);
  const qtyAt = (itemId: string | undefined) =>
    (stock.data ?? []).find((s) => s.item_id === itemId && s.location_id === v.location_id)?.quantity ?? 0;
  const good = (Number(v.qty_good) || 0) * (unit?.factor ?? 1);
  const reject = Number(v.qty_reject) || 0;
  const need = good + reject;
  const available = qtyAt(packaging?.id);

  const submit = useMutation({
    mutationFn: (values: ProductionValues) => createProduction(getSupabase(), idempotencyKey, values),
    onSuccess: async (res) => {
      await Promise.all([...STOCK_INVALIDATE, queryKeys.productionsAll].map((queryKey) => qc.invalidateQueries({ queryKey })));
      toast.success(`Produksi ${res.doc_no} tersimpan.`);
      router.replace(`/production/${res.id}`);
    },
  });

  if (items.isPending || productLocations.isPending) return <LoadingRows />;
  if (items.error || productLocations.error) {
    return (
      <ErrorState
        message={(items.error ?? productLocations.error)!.message}
        onRetry={() => (items.refetch(), productLocations.refetch())}
      />
    );
  }
  if (factories.length === 0) return <EmptyState message="Anda belum ditugaskan ke pabrik. Hubungi Super Owner." />;
  const { errors } = form.formState;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/production" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Produksi
      </Link>
      <PageHeader title="Input produksi" description="Packaging terpakai = good + reject (1 produk = 1 sachet packaging)." />

      <Card>
        <CardContent>
          <form id="production-form" className="flex flex-col gap-4" onSubmit={form.handleSubmit(setConfirming)} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="location_id" label="Pabrik" error={errors.location_id?.message}>
                <NativeSelect
                  id="location_id"
                  className="w-full"
                  {...form.register('location_id', {
                    onChange: () => (form.setValue('finished_item_id', ''), form.setValue('unit_id', '')),
                  })}
                >
                  {factories.length > 1 ? <NativeSelectOption value="">— Pilih pabrik —</NativeSelectOption> : null}
                  {factories.map((l) => (
                    <NativeSelectOption key={l.id} value={l.id}>
                      {l.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="production_date" label="Tanggal produksi" error={errors.production_date?.message} hint="Maksimal 7 hari ke belakang">
                <Input id="production_date" type="date" min={minTransactionDate()} max={todayWib()} {...form.register('production_date')} />
              </FormField>
            </div>

            <FormField
              id="finished_item_id"
              label="Produk"
              error={errors.finished_item_id?.message}
              hint={v.location_id && products.length === 0 ? 'Belum ada produk yang terdaftar untuk pabrik ini.' : undefined}
            >
              <NativeSelect
                id="finished_item_id"
                className="w-full"
                aria-invalid={Boolean(errors.finished_item_id)}
                {...form.register('finished_item_id', {
                  onChange: (e) => {
                    const base = byId.get(e.target.value)?.item_units.find((u) => u.is_base);
                    form.setValue('unit_id', base?.id ?? '');
                  },
                })}
              >
                <NativeSelectOption value="">— Pilih produk —</NativeSelectOption>
                {products.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.sku} · {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>

            {product ? (
              <>
                <div className="grid gap-3 sm:grid-cols-[1fr_10rem_1fr]">
                  <FormField id="qty_good" label="Good" error={errors.qty_good?.message}>
                    <Input id="qty_good" type="number" min={0} inputMode="numeric" className="text-right tabular-nums" {...form.register('qty_good')} />
                  </FormField>
                  <FormField id="unit_id" label="Satuan" error={errors.unit_id?.message}>
                    <NativeSelect id="unit_id" className="w-full" {...form.register('unit_id')}>
                      {product.item_units
                        .filter((u) => u.is_active)
                        .map((u) => (
                          <NativeSelectOption key={u.id} value={u.id}>
                            {u.unit_name}
                            {u.factor > 1 ? ` (${formatQty(u.factor)})` : ''}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                  </FormField>
                  <FormField id="qty_reject" label={`Reject (${packaging?.base_unit ?? 'sachet'})`} error={errors.qty_reject?.message}>
                    <Input id="qty_reject" type="number" min={0} inputMode="numeric" className="text-right tabular-nums" {...form.register('qty_reject')} />
                  </FormField>
                </div>

                {packaging ? (
                  <div className={`rounded-md border p-3 text-sm ${need > available ? 'border-destructive text-destructive' : ''}`}>
                    <p>
                      Packaging <span className="font-medium">{packaging.name}</span>: terpakai{' '}
                      <span className="font-semibold tabular-nums">{formatQty(need)}</span> {packaging.base_unit} (good {formatQty(good)} + reject{' '}
                      {formatQty(reject)}) · stok pabrik <span className="tabular-nums">{formatQty(available)}</span>
                    </p>
                    {need > available ? <p className="font-medium">Stok packaging tidak cukup.</p> : null}
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertDescription>Packaging untuk produk ini belum diatur. Hubungi Super Owner.</AlertDescription>
                  </Alert>
                )}
              </>
            ) : null}

            <FormField id="notes" label="Catatan (opsional)" error={errors.notes?.message}>
              <Textarea id="notes" rows={2} placeholder="Shift, penyebab reject, dll." {...form.register('notes')} />
            </FormField>
          </form>
        </CardContent>
      </Card>

      {!online ? (
        <Alert variant="destructive">
          <AlertDescription>Tidak ada koneksi. Produksi bisa disimpan saat online.</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/production" />}>
          Batal
        </Button>
        <Button type="submit" form="production-form" disabled={!online || !packaging}>
          Lanjut konfirmasi
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="Simpan produksi?"
        description={`Stok ${factories.find((f) => f.id === confirming?.location_id)?.name ?? 'pabrik'} akan berubah sebagai berikut.`}
        confirmLabel="Ya, simpan"
        pending={submit.isPending}
        error={submit.error}
        onCancel={() => {
          setConfirming(null);
          submit.reset();
        }}
        onConfirm={() => confirming && submit.mutate(confirming)}
      >
        <ul className="flex flex-col divide-y rounded-md border text-sm">
          <li className="flex justify-between gap-4 px-3 py-2">
            <span>{packaging?.name}</span>
            <span className="font-semibold tabular-nums">
              −{formatQty(need)} {packaging?.base_unit}
            </span>
          </li>
          {good > 0 ? (
            <li className="flex justify-between gap-4 px-3 py-2">
              <span>{product?.name}</span>
              <span className="font-semibold tabular-nums">
                +{formatQty(good)} {product?.base_unit}
              </span>
            </li>
          ) : null}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
