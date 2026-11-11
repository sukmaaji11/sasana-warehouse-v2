'use client';

import { createAdjustment } from '@sasana/shared-api';
import {
  ADJUSTMENT_KIND_LABELS,
  formatQty,
  ITEM_TYPE_LABELS,
  minTransactionDate,
  todayWib,
  type AdjustmentKind,
  type ItemType,
} from '@sasana/shared-constants';
import { adjustmentSchema, type AdjustmentValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useItems, useLocations } from '@/features/master/queries';
import { useOnline } from '@/hooks/use-online';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { newIdempotencyKey, STOCK_INVALIDATE, useStockLevels } from './queries';

/**
 * Stok awal (Q1) & penyesuaian/stock opname (Q3). Input = jumlah FISIK dalam satuan dasar.
 * Hanya baris yang diisi yang dikirim. Sistem menghitung selisih terhadap saldo saat ini.
 */
export function AdjustmentForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const online = useOnline();
  const items = useItems();
  const locations = useLocations();
  const stock = useStockLevels();
  const [idempotencyKey] = useState(newIdempotencyKey);

  const [kind, setKind] = useState<AdjustmentKind>('OPENING_BALANCE');
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState(todayWib());
  const [reason, setReason] = useState('Cek fisik saat aplikasi mulai dipakai');
  const [type, setType] = useState<ItemType>('PACKAGING');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<AdjustmentValues | null>(null);

  const systemQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stock.data ?? []) if (s.location_id === locationId) m.set(s.item_id!, s.quantity ?? 0);
    return m;
  }, [stock.data, locationId]);

  const submit = useMutation({
    mutationFn: (v: AdjustmentValues) => createAdjustment(getSupabase(), idempotencyKey, v),
    onSuccess: async (res) => {
      await Promise.all(STOCK_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey })));
      toast.success(`${res.doc_no} tersimpan.`);
      router.replace(`/stock/adjustments/${res.id}`);
    },
  });

  if (items.isPending || locations.isPending || stock.isPending) return <LoadingRows />;
  const loadError = items.error ?? locations.error ?? stock.error;
  if (loadError) return <ErrorState message={loadError.message} onRetry={() => (items.refetch(), locations.refetch(), stock.refetch())} />;

  const allItems = items.data ?? [];
  const allLocations = locations.data ?? [];
  const itemsOfType = allItems.filter((i) => i.type === type && i.is_active);
  const byId = new Map(allItems.map((i) => [i.id, i]));
  const filled = Object.entries(qty).filter(([, v]) => v.trim() !== '');

  function review() {
    const parsed = adjustmentSchema.safeParse({
      kind,
      location_id: locationId,
      adjustment_date: date,
      reason,
      items: filled.map(([item_id, v]) => ({ item_id, physical_qty: v })),
    });
    if (!parsed.success) {
      setErrors([...new Set(parsed.error.issues.map((i) => i.message))]);
      return;
    }
    setErrors([]);
    setConfirming(parsed.data);
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Link href="/stock/adjustments" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Stok awal & penyesuaian
      </Link>
      <PageHeader
        title="Input stok fisik"
        description="Isi jumlah hasil hitung fisik (satuan dasar). Kosongkan barang yang tidak dihitung."
      />

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <FormField id="kind" label="Jenis">
            <NativeSelect id="kind" className="w-full" value={kind} onChange={(e) => setKind(e.target.value as AdjustmentKind)}>
              {(Object.keys(ADJUSTMENT_KIND_LABELS) as AdjustmentKind[]).map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {ADJUSTMENT_KIND_LABELS[k]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="location" label="Lokasi">
            <NativeSelect id="location" className="w-full" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <NativeSelectOption value="">— Pilih lokasi —</NativeSelectOption>
              {allLocations
                .filter((l) => l.is_active)
                .map((l) => (
                  <NativeSelectOption key={l.id} value={l.id}>
                    {l.name}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </FormField>
          <FormField id="date" label="Tanggal hitung" hint="Maksimal 7 hari ke belakang">
            <Input id="date" type="date" min={minTransactionDate()} max={todayWib()} value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField id="reason" label="Alasan">
            <Textarea id="reason" rows={1} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        </CardContent>
      </Card>

      {kind === 'OPENING_BALANCE' ? (
        <Alert>
          <AlertDescription>
            Stok awal hanya bisa diinput sekali per barang per lokasi, sebelum ada transaksi lain. Setelah itu gunakan
            Penyesuaian.
          </AlertDescription>
        </Alert>
      ) : null}

      {locationId ? (
        <>
          <Tabs value={type} onValueChange={(v) => setType(v as ItemType)}>
            <TabsList>
              <TabsTrigger value="PACKAGING">{ITEM_TYPE_LABELS.PACKAGING}</TabsTrigger>
              <TabsTrigger value="FINISHED_GOOD">{ITEM_TYPE_LABELS.FINISHED_GOOD}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barang</TableHead>
                <TableHead className="text-right">Stok sistem</TableHead>
                <TableHead className="w-44 text-right">Jumlah fisik</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsOfType.map((i) => {
                const sys = systemQty.get(i.id) ?? 0;
                const raw = qty[i.id] ?? '';
                const diff = raw.trim() === '' || Number.isNaN(Number(raw)) ? null : Number(raw) - sys;
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{i.sku}</span> {i.name}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatQty(sys)} {i.base_unit}
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Jumlah fisik ${i.name}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="text-right tabular-nums"
                        value={raw}
                        onChange={(e) => setQty((q) => ({ ...q, [i.id]: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        diff === null || diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-emerald-700' : 'text-destructive',
                      )}
                    >
                      {diff === null ? '–' : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${formatQty(Math.abs(diff))}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Pilih lokasi untuk mulai mengisi jumlah fisik.</p>
      )}

      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>{errors.join(' · ')}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-muted-foreground">{filled.length} barang diisi</span>
        <Button onClick={review} disabled={!online || !locationId || filled.length === 0}>
          Lanjut konfirmasi
        </Button>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={`Simpan ${ADJUSTMENT_KIND_LABELS[kind].toLowerCase()}?`}
        description={`${allLocations.find((l) => l.id === locationId)?.name ?? ''} — saldo akan disamakan dengan jumlah fisik.`}
        confirmLabel="Ya, simpan"
        pending={submit.isPending}
        error={submit.error}
        onCancel={() => {
          setConfirming(null);
          submit.reset();
        }}
        onConfirm={() => confirming && submit.mutate(confirming)}
      >
        <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-md border text-sm">
          {confirming?.items.map((l) => {
            const it = byId.get(l.item_id);
            const diff = l.physical_qty - (systemQty.get(l.item_id) ?? 0);
            return (
              <li key={l.item_id} className="flex justify-between gap-4 px-3 py-2">
                <span>{it?.name}</span>
                <span className="tabular-nums">
                  {formatQty(l.physical_qty)} {it?.base_unit}{' '}
                  <span className={diff >= 0 ? 'text-emerald-700' : 'text-destructive'}>
                    ({diff >= 0 ? '+' : '−'}
                    {formatQty(Math.abs(diff))})
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
