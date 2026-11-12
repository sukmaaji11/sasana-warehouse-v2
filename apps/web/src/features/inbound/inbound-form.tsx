'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createInbound } from '@sasana/shared-api';
import { formatQty, minTransactionDate, todayWib } from '@sasana/shared-constants';
import { inboundSchema, type InboundInput, type InboundValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ErrorState, LoadingRows } from '@/components/app/data-state';
import { FormField } from '@/components/app/form-field';
import { PageHeader } from '@/components/app/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useOnline } from '@/hooks/use-online';
import { useItems, useParties } from '@/features/master/queries';
import { newIdempotencyKey, STOCK_INVALIDATE } from '@/features/stock/queries';
import { getSupabase } from '@/lib/supabase/client';

export function InboundForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const items = useItems();
  const vendors = useParties('vendors');
  // Satu key per form: retry setelah gagal jaringan tidak menggandakan stok.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState<InboundValues | null>(null);

  const form = useForm<InboundInput, unknown, InboundValues>({
    resolver: zodResolver(inboundSchema),
    defaultValues: { vendor_id: '', transaction_date: todayWib(), notes: '', items: [{ item_id: '', unit_id: '', qty: '' }] },
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });
  const watched = useWatch({ control: form.control, name: 'items' });

  const packaging = useMemo(() => (items.data ?? []).filter((i) => i.type === 'PACKAGING' && i.is_active), [items.data]);
  const byId = useMemo(() => new Map(packaging.map((i) => [i.id, i])), [packaging]);

  const submit = useMutation({
    mutationFn: (v: InboundValues) => createInbound(getSupabase(), idempotencyKey, v),
    onSuccess: async (res) => {
      await Promise.all(STOCK_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey })));
      toast.success(`Inbound ${res.doc_no} tersimpan. Stok gudang pusat bertambah.`);
      router.replace(`/inbound/${res.id}`);
    },
  });

  if (items.isPending || vendors.isPending) return <LoadingRows />;
  if (items.error || vendors.error) {
    return <ErrorState message={(items.error ?? vendors.error)!.message} onRetry={() => (items.refetch(), vendors.refetch())} />;
  }
  const activeVendors = vendors.data.filter((v) => v.is_active);
  const { errors } = form.formState;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/inbound" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Inbound
      </Link>
      <PageHeader title="Inbound baru" description="Packaging diterima dari vendor masuk ke gudang pusat (input per satuan dasar)." />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <form id="inbound-form" className="flex flex-col gap-4" onSubmit={form.handleSubmit(setConfirming)} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="vendor_id" label="Vendor" error={errors.vendor_id?.message} hint={activeVendors.length === 0 ? 'Belum ada vendor — tambahkan di menu Vendor.' : undefined}>
                <NativeSelect id="vendor_id" className="w-full" {...form.register('vendor_id')} aria-invalid={Boolean(errors.vendor_id)}>
                  <NativeSelectOption value="">— Pilih vendor —</NativeSelectOption>
                  {activeVendors.map((v) => (
                    <NativeSelectOption key={v.id} value={v.id}>
                      {v.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="transaction_date" label="Tanggal terima" error={errors.transaction_date?.message} hint="Maksimal 7 hari ke belakang">
                <Input id="transaction_date" type="date" min={minTransactionDate()} max={todayWib()} {...form.register('transaction_date')} />
              </FormField>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Barang</p>
              {lines.fields.map((field, idx) => {
                const item = byId.get(watched?.[idx]?.item_id ?? '');
                const lineErr = errors.items?.[idx];
                return (
                  <div key={field.id} className="grid grid-cols-[1fr_auto] items-start gap-2 sm:grid-cols-[1fr_8rem_auto]">
                    <div className="col-span-2 sm:col-span-1">
                      <NativeSelect
                        aria-label={`Barang baris ${idx + 1}`}
                        className="w-full"
                        {...form.register(`items.${idx}.item_id`, {
                          onChange: (e) => {
                            // Packaging hanya punya satuan dasar (Q6) → pilih otomatis.
                            const it = byId.get(e.target.value);
                            const base = it?.item_units.find((u) => u.is_base);
                            form.setValue(`items.${idx}.unit_id`, base?.id ?? '');
                          },
                        })}
                        aria-invalid={Boolean(lineErr?.item_id)}
                      >
                        <NativeSelectOption value="">— Pilih packaging —</NativeSelectOption>
                        {packaging.map((p) => (
                          <NativeSelectOption key={p.id} value={p.id}>
                            {p.sku} · {p.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      {lineErr?.item_id ? <p className="mt-1 text-sm text-destructive">{lineErr.item_id.message}</p> : null}
                    </div>
                    <div>
                      <div className="relative">
                        <Input
                          aria-label={`Jumlah baris ${idx + 1}`}
                          type="number"
                          min={1}
                          inputMode="numeric"
                          className="pr-14 text-right tabular-nums"
                          {...form.register(`items.${idx}.qty`)}
                          aria-invalid={Boolean(lineErr?.qty)}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                          {item?.base_unit ?? ''}
                        </span>
                      </div>
                      {lineErr?.qty ? <p className="mt-1 text-sm text-destructive">{lineErr.qty.message}</p> : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus baris ${idx + 1}`}
                      disabled={lines.fields.length === 1}
                      onClick={() => lines.remove(idx)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                );
              })}
              {errors.items?.root?.message || errors.items?.message ? (
                <p className="text-sm text-destructive">{errors.items?.root?.message ?? errors.items?.message}</p>
              ) : null}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => lines.append({ item_id: '', unit_id: '', qty: '' })}>
                <PlusIcon /> Tambah baris
              </Button>
            </div>

            <FormField id="notes" label="Catatan (opsional)" error={errors.notes?.message}>
              <Textarea id="notes" rows={2} placeholder="No. surat jalan vendor, dll." {...form.register('notes')} />
            </FormField>
          </form>
        </CardContent>
      </Card>

      {!online ? (
        <Alert variant="destructive">
          <AlertDescription>Tidak ada koneksi. Inbound baru bisa disimpan saat online.</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/inbound" />}>
          Batal
        </Button>
        <Button type="submit" form="inbound-form" disabled={!online}>
          Lanjut konfirmasi
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="Simpan inbound?"
        description="Stok gudang pusat akan bertambah sesuai jumlah berikut."
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
            return (
              <li key={l.item_id} className="flex justify-between gap-4 px-3 py-2">
                <span>{it?.name}</span>
                <span className="font-semibold tabular-nums">
                  +{formatQty(l.qty)} {it?.base_unit}
                </span>
              </li>
            );
          })}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
