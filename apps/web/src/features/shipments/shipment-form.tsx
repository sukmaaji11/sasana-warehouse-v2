'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createShipment } from '@sasana/shared-api';
import { formatQty, ITEM_TYPE_LABELS, SHIPPABLE_ITEM_TYPES } from '@sasana/shared-constants';
import { shipmentSchema, type ShipmentInput, type ShipmentValues } from '@sasana/shared-validation';
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
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/current-user';
import { useItems, useLocations } from '@/features/master/queries';
import { newIdempotencyKey, useStockLevels } from '@/features/stock/queries';
import { useOnline } from '@/hooks/use-online';
import { getSupabase } from '@/lib/supabase/client';
import { SHIPMENT_INVALIDATE, useDrivers } from './shared';

export function ShipmentForm() {
  const user = useCurrentUser();
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const items = useItems();
  const locations = useLocations();
  const drivers = useDrivers();
  const stock = useStockLevels();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState<ShipmentValues | null>(null);

  // Lokasi asal: lokasi yang dikelola user (SO: semua).
  const origins = user.locations;
  const form = useForm<ShipmentInput, unknown, ShipmentValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      from_location_id: origins.length === 1 ? origins[0]!.id : '',
      to_location_id: '',
      driver_id: '',
      notes: '',
      items: [{ item_id: '', unit_id: '', qty: '' }],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'items' });
  const watched = useWatch({ control: form.control });
  const fromId = watched.from_location_id ?? '';
  // Jenis barang mengikuti lokasi asal (gudang kemasan → kemasan saja, dst.).
  const fromType = origins.find((l) => l.id === fromId)?.type;
  const allowedTypes = fromType ? SHIPPABLE_ITEM_TYPES[fromType] : (['PACKAGING', 'FINISHED_GOOD'] as const);

  const active = useMemo(() => (items.data ?? []).filter((i) => i.is_active), [items.data]);
  const byId = useMemo(() => new Map(active.map((i) => [i.id, i])), [active]);
  const available = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stock.data ?? []) if (s.location_id === fromId) m.set(s.item_id!, s.quantity ?? 0);
    return m;
  }, [stock.data, fromId]);

  const submit = useMutation({
    mutationFn: (v: ShipmentValues) => createShipment(getSupabase(), idempotencyKey, v),
    onSuccess: async (res) => {
      await Promise.all(SHIPMENT_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey })));
      toast.success(`Shipment ${res.doc_no} dibuat.`);
      router.replace(`/shipments/${res.id}`);
    },
  });

  if (items.isPending || locations.isPending || drivers.isPending) return <LoadingRows />;
  const loadErr = items.error ?? locations.error ?? drivers.error;
  if (loadErr) return <ErrorState message={loadErr.message} onRetry={() => (items.refetch(), locations.refetch(), drivers.refetch())} />;

  const destinations = (locations.data ?? []).filter((l) => l.is_active && l.id !== fromId);
  const { errors } = form.formState;
  const locName = (id: string) => (locations.data ?? []).find((l) => l.id === id)?.name ?? '';

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/shipments" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Shipment
      </Link>
      <PageHeader title="Shipment baru" description="Membuat shipment belum mengubah stok. Stok asal berkurang saat pickup." />
      <Card>
        <CardContent>
          <form id="shipment-form" className="flex flex-col gap-4" onSubmit={form.handleSubmit(setConfirming)} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="from" label="Dari" error={errors.from_location_id?.message}>
                <NativeSelect id="from" className="w-full" {...form.register('from_location_id')}>
                  <NativeSelectOption value="">— Lokasi asal —</NativeSelectOption>
                  {origins.map((l) => (
                    <NativeSelectOption key={l.id} value={l.id}>
                      {l.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="to" label="Ke" error={errors.to_location_id?.message}>
                <NativeSelect id="to" className="w-full" {...form.register('to_location_id')}>
                  <NativeSelectOption value="">— Lokasi tujuan —</NativeSelectOption>
                  {destinations.map((l) => (
                    <NativeSelectOption key={l.id} value={l.id}>
                      {l.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <FormField id="driver" label="Driver (opsional)" hint="Bisa ditugaskan atau diganti nanti sebelum pickup">
              <NativeSelect id="driver" className="w-full" {...form.register('driver_id')}>
                <NativeSelectOption value="">— Tugaskan nanti —</NativeSelectOption>
                {(drivers.data ?? []).map((d) => (
                  <NativeSelectOption key={d.id} value={d.id}>
                    {d.full_name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Barang</p>
              {fromType && fromType !== 'FACTORY' ? (
                <p className="text-xs text-muted-foreground">
                  {fromType === 'WAREHOUSE' ? 'Dari gudang kemasan hanya bisa mengirim kemasan.' : 'Dari gudang penjualan hanya bisa mengirim produk jadi.'}
                </p>
              ) : null}
              {lines.fields.map((field, idx) => {
                const line = watched.items?.[idx];
                const item = byId.get(line?.item_id ?? '');
                const unit = item?.item_units.find((u) => u.id === line?.unit_id);
                const need = unit && line?.qty ? Number(line.qty) * unit.factor : 0;
                const avail = item ? (available.get(item.id) ?? 0) : null;
                const err = errors.items?.[idx];
                return (
                  <div key={field.id} className="flex flex-col gap-1 rounded-md border p-2">
                    <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
                      <NativeSelect
                        aria-label={`Barang baris ${idx + 1}`}
                        className="col-span-3 w-full sm:col-span-1"
                        {...form.register(`items.${idx}.item_id`, {
                          onChange: (e) => {
                            const base = byId.get(e.target.value)?.item_units.find((u) => u.is_base);
                            form.setValue(`items.${idx}.unit_id`, base?.id ?? '');
                          },
                        })}
                      >
                        <NativeSelectOption value="">— Pilih barang —</NativeSelectOption>
                        {allowedTypes.map((t) => (
                          <NativeSelectOptGroup key={t} label={ITEM_TYPE_LABELS[t]}>
                            {active
                              .filter((i) => i.type === t)
                              .map((i) => (
                                <NativeSelectOption key={i.id} value={i.id}>
                                  {i.sku} · {i.name}
                                </NativeSelectOption>
                              ))}
                          </NativeSelectOptGroup>
                        ))}
                      </NativeSelect>
                      <Input
                        aria-label={`Jumlah baris ${idx + 1}`}
                        type="number"
                        min={1}
                        inputMode="numeric"
                        className="text-right tabular-nums"
                        {...form.register(`items.${idx}.qty`)}
                        aria-invalid={Boolean(err?.qty)}
                      />
                      <NativeSelect aria-label={`Satuan baris ${idx + 1}`} className="w-full" {...form.register(`items.${idx}.unit_id`)}>
                        {(item?.item_units ?? []).filter((u) => u.is_active).map((u) => (
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
                      <p className={`text-xs ${need > (avail ?? 0) ? 'text-destructive' : 'text-muted-foreground'}`}>
                        = {formatQty(need)} {item.base_unit} · stok di asal saat ini {formatQty(avail ?? 0)} {item.base_unit}
                        {need > (avail ?? 0) ? ' — kurang, pickup akan ditolak bila belum ditambah' : ''}
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
                <PlusIcon /> Tambah baris
              </Button>
            </div>
            <FormField id="notes" label="Catatan (opsional)" error={errors.notes?.message}>
              <Textarea id="notes" rows={2} {...form.register('notes')} />
            </FormField>
          </form>
        </CardContent>
      </Card>
      {!online ? (
        <Alert variant="destructive">
          <AlertDescription>Tidak ada koneksi. Shipment bisa dibuat saat online.</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/shipments" />}>
          Batal
        </Button>
        <Button type="submit" form="shipment-form" disabled={!online}>
          Lanjut konfirmasi
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="Buat shipment?"
        description={confirming ? `${locName(confirming.from_location_id)} → ${locName(confirming.to_location_id)}. Stok belum berubah sampai pickup.` : undefined}
        confirmLabel="Ya, buat"
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
                <span className="tabular-nums">
                  {formatQty(l.qty)} {u?.unit_name}
                  {u && !u.is_base ? ` = ${formatQty(l.qty * u.factor)} ${it?.base_unit}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
