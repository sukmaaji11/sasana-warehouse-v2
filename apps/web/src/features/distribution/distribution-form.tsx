'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createDistribution, distributionOrigins } from '@sasana/shared-api';
import { formatQty, minTransactionDate, todayWib } from '@sasana/shared-constants';
import { distributionSchema, type DistributionInput, type DistributionValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
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
import { useItems, useParties } from '@/features/master/queries';
import { newIdempotencyKey, useStockLevels } from '@/features/stock/queries';
import { useOnline } from '@/hooks/use-online';
import { getSupabase } from '@/lib/supabase/client';
import { DISTRIBUTION_INVALIDATE } from './queries';

export function DistributionForm() {
  const user = useCurrentUser();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const items = useItems();
  const buyers = useParties('buyers');
  const stock = useStockLevels();
  // Satu key per form: retry setelah gagal jaringan tidak menggandakan pengurangan stok.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState<DistributionValues | null>(null);
  const origins = distributionOrigins(user);

  const form = useForm<DistributionInput, unknown, DistributionValues>({
    resolver: zodResolver(distributionSchema),
    defaultValues: {
      location_id: origins.length === 1 ? origins[0]!.id : '',
      buyer_id: '',
      transaction_date: todayWib(),
      notes: '',
      items: [{ item_id: '', unit_id: '', qty: '' }],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });
  const watched = useWatch({ control: form.control });
  const fromId = watched.location_id ?? '';

  const available = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stock.data ?? []) if (s.location_id === fromId) m.set(s.item_id!, s.quantity ?? 0);
    return m;
  }, [stock.data, fromId]);
  const products = useMemo(() => (items.data ?? []).filter((i) => i.type === 'FINISHED_GOOD' && i.is_active), [items.data]);
  const byId = useMemo(() => new Map(products.map((i) => [i.id, i])), [products]);
  // Produk yang ada stoknya di lokasi asal ditampilkan lebih dulu.
  const sorted = useMemo(
    () => [...products].sort((a, b) => Number((available.get(b.id) ?? 0) > 0) - Number((available.get(a.id) ?? 0) > 0)),
    [products, available],
  );

  const submit = useMutation({
    mutationFn: (v: DistributionValues) => createDistribution(getSupabase(), idempotencyKey, v),
    onSuccess: async (res) => {
      await Promise.all(DISTRIBUTION_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey })));
      toast.success(`Distribusi ${res.doc_no} tersimpan. Stok sudah berkurang.`);
      router.replace(`/distribution/${res.id}`);
    },
  });

  if (origins.length === 0) {
    return <EmptyState message="Anda tidak ditugaskan di pabrik atau Gudang Penjualan, jadi tidak bisa mencatat distribusi." />;
  }
  if (items.isPending || buyers.isPending) return <LoadingRows />;
  if (items.error || buyers.error) {
    return <ErrorState message={(items.error ?? buyers.error)!.message} onRetry={() => (items.refetch(), buyers.refetch())} />;
  }
  const activeBuyers = buyers.data.filter((b) => b.is_active);
  const { errors } = form.formState;
  const locName = (id: string) => origins.find((l) => l.id === id)?.name ?? '';

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/distribution" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Distribusi
      </Link>
      <PageHeader title="Distribusi baru" description="Produk jadi keluar ke buyer. Stok lokasi asal langsung berkurang saat disimpan." />
      <Card>
        <CardContent>
          <form id="distribution-form" className="flex flex-col gap-4" onSubmit={form.handleSubmit(setConfirming)} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="location_id" label="Dari" error={errors.location_id?.message}>
                <NativeSelect id="location_id" className="w-full" {...form.register('location_id')}>
                  {origins.length > 1 ? <NativeSelectOption value="">— Lokasi asal —</NativeSelectOption> : null}
                  {origins.map((l) => (
                    <NativeSelectOption key={l.id} value={l.id}>
                      {l.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="transaction_date" label="Tanggal" error={errors.transaction_date?.message} hint="Maksimal 7 hari ke belakang">
                <Input id="transaction_date" type="date" min={minTransactionDate()} max={todayWib()} {...form.register('transaction_date')} />
              </FormField>
            </div>
            <FormField
              id="buyer_id"
              label="Buyer"
              error={errors.buyer_id?.message}
              hint='Pemakaian sendiri (rawatan ayam): pilih "Konsumsi internal". Buyer baru ditambahkan di menu Buyer.'
            >
              <NativeSelect id="buyer_id" className="w-full" aria-invalid={Boolean(errors.buyer_id)} {...form.register('buyer_id')}>
                <NativeSelectOption value="">— Pilih buyer —</NativeSelectOption>
                {activeBuyers.map((b) => (
                  <NativeSelectOption key={b.id} value={b.id}>
                    {b.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Produk</p>
              {lines.fields.map((field, idx) => {
                const line = watched.items?.[idx];
                const item = byId.get(line?.item_id ?? '');
                const unit = item?.item_units.find((u) => u.id === line?.unit_id);
                const need = unit && line?.qty ? Number(line.qty) * unit.factor : 0;
                const avail = item ? (available.get(item.id) ?? 0) : 0;
                const err = errors.items?.[idx];
                return (
                  <div key={field.id} className="flex flex-col gap-1 rounded-md border p-2">
                    <div className="grid grid-cols-[1fr_7rem_7rem_auto] items-start gap-2">
                      <NativeSelect
                        aria-label={`Produk baris ${idx + 1}`}
                        className="w-full"
                        aria-invalid={Boolean(err?.item_id)}
                        {...form.register(`items.${idx}.item_id`, {
                          onChange: (e) => {
                            const base = byId.get(e.target.value)?.item_units.find((u) => u.is_base);
                            form.setValue(`items.${idx}.unit_id`, base?.id ?? '');
                          },
                        })}
                      >
                        <NativeSelectOption value="">— Pilih produk —</NativeSelectOption>
                        {sorted.map((i) => (
                          <NativeSelectOption key={i.id} value={i.id}>
                            {i.sku} · {i.name} ({formatQty(available.get(i.id) ?? 0)})
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <Input
                        aria-label={`Jumlah baris ${idx + 1}`}
                        type="number"
                        min={1}
                        inputMode="numeric"
                        className="text-right tabular-nums"
                        aria-invalid={Boolean(err?.qty)}
                        {...form.register(`items.${idx}.qty`)}
                      />
                      <NativeSelect aria-label={`Satuan baris ${idx + 1}`} className="w-full" {...form.register(`items.${idx}.unit_id`)}>
                        {(item?.item_units ?? [])
                          .filter((u) => u.is_active)
                          .map((u) => (
                            <NativeSelectOption key={u.id} value={u.id}>
                              {u.unit_name}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Hapus baris ${idx + 1}`} disabled={lines.fields.length === 1} onClick={() => lines.remove(idx)}>
                        <Trash2Icon />
                      </Button>
                    </div>
                    {item && fromId ? (
                      <p className={`text-xs ${need > avail ? 'text-destructive' : 'text-muted-foreground'}`}>
                        = {formatQty(need)} {item.base_unit} · stok {formatQty(avail)} {item.base_unit}
                        {need > avail ? ' — stok tidak cukup' : ''}
                      </p>
                    ) : null}
                    {err?.item_id || err?.qty || err?.unit_id ? (
                      <p className="text-sm text-destructive">{err.item_id?.message ?? err.qty?.message ?? err.unit_id?.message}</p>
                    ) : null}
                  </div>
                );
              })}
              {errors.items?.root?.message || errors.items?.message ? (
                <p className="text-sm text-destructive">{errors.items?.root?.message ?? errors.items?.message}</p>
              ) : null}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => lines.append({ item_id: '', unit_id: '', qty: '' })}>
                <PlusIcon /> Tambah produk
              </Button>
            </div>
            <FormField id="notes" label="Catatan (opsional)" error={errors.notes?.message}>
              <Textarea id="notes" rows={2} placeholder="No. nota, pengirim, dll." {...form.register('notes')} />
            </FormField>
          </form>
        </CardContent>
      </Card>
      {!online ? (
        <Alert variant="destructive">
          <AlertDescription>Tidak ada koneksi. Distribusi bisa disimpan saat online.</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/distribution" />}>
          Batal
        </Button>
        <Button type="submit" form="distribution-form" disabled={!online}>
          Lanjut konfirmasi
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="Simpan distribusi?"
        description={
          confirming
            ? `${locName(confirming.location_id)} → ${activeBuyers.find((b) => b.id === confirming.buyer_id)?.name ?? ''}. Stok asal berkurang:`
            : undefined
        }
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
          {confirming?.items.map((l) => {
            const it = byId.get(l.item_id);
            const u = it?.item_units.find((x) => x.id === l.unit_id);
            return (
              <li key={l.item_id} className="flex justify-between gap-4 px-3 py-2">
                <span>{it?.name}</span>
                <span className="font-semibold tabular-nums">
                  −{formatQty(l.qty)} {u?.unit_name}
                  {u && !u.is_base ? ` (${formatQty(l.qty * u.factor)} ${it?.base_unit})` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
