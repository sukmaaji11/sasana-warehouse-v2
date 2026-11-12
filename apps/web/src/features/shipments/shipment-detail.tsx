'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  assignShipmentDriver,
  cancelShipment,
  pickupShipment,
  queryKeys,
  receiveShipment,
  type ShipmentRow,
} from '@sasana/shared-api';
import { formatDateTime, formatQty } from '@sasana/shared-constants';
import { cancelShipmentSchema, type CancelShipmentValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ErrorState, LoadingRows } from '@/components/app/data-state';
import { FormField } from '@/components/app/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/current-user';
import { getSupabase } from '@/lib/supabase/client';
import { SHIPMENT_INVALIDATE, shipmentPermissions, StatusBadge, useDrivers, useShipment } from './shared';

export function ShipmentDetail({ id }: { id: string }) {
  const user = useCurrentUser();
  const { data: s, error, isPending, refetch } = useShipment(id);
  if (isPending) return <LoadingRows />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const can = shipmentPermissions(user, s);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/shipments" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeftIcon className="size-4" /> Shipment
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3 font-mono text-xl">
            {s.doc_no} <StatusBadge status={s.status} />
          </CardTitle>
          <CardDescription className="flex items-center gap-2 text-base text-foreground">
            {s.from_location?.name} <ArrowRightIcon className="size-4 text-muted-foreground" /> {s.to_location?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {s.status === 'CANCELLED' ? (
            <Alert variant="destructive">
              <AlertDescription>
                Dibatalkan {s.cancelled_at ? formatDateTime(s.cancelled_at) : ''} — {s.cancel_reason}
              </AlertDescription>
            </Alert>
          ) : null}
          <Timeline s={s} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barang</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="text-right">Satuan dasar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.shipment_items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{l.item?.sku}</span> {l.item?.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQty(l.input_qty)} {l.unit_name}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatQty(l.base_qty ?? 0)} {l.item?.base_unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {s.notes ? <p className="text-sm text-muted-foreground">Catatan: {s.notes}</p> : null}
        </CardContent>
      </Card>

      {can.assign ? <DriverCard s={s} /> : null}
      {can.receive || can.pickupOnBehalf || can.cancel ? (
        <Card>
          <CardHeader>
            <CardTitle>Tindakan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {can.receive ? <ReceiveAction s={s} /> : null}
            {can.pickupOnBehalf ? <PickupOnBehalfAction s={s} /> : null}
            {can.cancel ? <CancelAction s={s} /> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Timeline({ s }: { s: ShipmentRow }) {
  const rows: [string, string | null, string | null][] = [
    ['Dibuat', s.created_at, s.creator?.full_name ?? null],
    ['Driver', s.assigned_at, s.driver?.full_name ?? null],
    [s.picked_up_on_behalf ? 'Pickup (atas nama driver)' : 'Pickup', s.picked_up_at, s.picker?.full_name ?? null],
    ['Diterima', s.received_at, s.receiver?.full_name ?? null],
  ];
  return (
    <dl className="grid grid-cols-[11rem_1fr] gap-y-1 text-sm">
      {rows.map(([label, at, who]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{at ? `${formatDateTime(at)}${who ? ` · ${who}` : ''}` : label === 'Driver' && who ? who : '–'}</dd>
        </div>
      ))}
    </dl>
  );
}

function useAction<T>(fn: (v: T) => Promise<unknown>, success: string, id: string, onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([...SHIPMENT_INVALIDATE, queryKeys.shipment(id)].map((queryKey) => qc.invalidateQueries({ queryKey })));
      toast.success(success);
      onDone?.();
    },
  });
}

function DriverCard({ s }: { s: ShipmentRow }) {
  const drivers = useDrivers();
  const [driverId, setDriverId] = useState(s.driver_id ?? '');
  const save = useAction((d: string | null) => assignShipmentDriver(getSupabase(), s.id, d), 'Driver diperbarui', s.id);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Driver</CardTitle>
        <CardDescription>Driver bisa ditugaskan, diganti, atau dilepas sebelum pickup.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {save.error ? (
          <Alert variant="destructive">
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <NativeSelect aria-label="Pilih driver" className="w-full sm:w-72" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <NativeSelectOption value="">— Belum ada driver —</NativeSelectOption>
            {(drivers.data ?? []).map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.full_name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button disabled={save.isPending || driverId === (s.driver_id ?? '')} onClick={() => save.mutate(driverId || null)}>
            {save.isPending ? 'Menyimpan…' : driverId ? 'Simpan driver' : 'Lepas driver'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionWithConfirm({
  label,
  variant,
  title,
  description,
  confirmLabel,
  mutation,
  onConfirm,
  children,
}: {
  label: string;
  variant?: 'default' | 'outline' | 'destructive';
  title: string;
  description: string;
  confirmLabel: string;
  mutation: { isPending: boolean; error: Error | null; reset: () => void };
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant ?? 'default'} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        destructive={variant === 'destructive'}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        pending={mutation.isPending}
        error={mutation.error}
        onCancel={() => {
          setOpen(false);
          mutation.reset();
        }}
        onConfirm={onConfirm}
      >
        {children}
      </ConfirmDialog>
    </>
  );
}

function ReceiveAction({ s }: { s: ShipmentRow }) {
  const m = useAction(() => receiveShipment(getSupabase(), s.id), `${s.doc_no} diterima. Stok ${s.to_location?.name} bertambah.`, s.id);
  return (
    <ActionWithConfirm
      label="Terima barang"
      title="Terima semua barang?"
      description={`Stok ${s.to_location?.name} akan bertambah sesuai daftar barang. Pastikan jumlah fisik sudah dicek. Selisih/rusak dicatat lewat Penyesuaian.`}
      confirmLabel="Ya, terima"
      mutation={m}
      onConfirm={() => m.mutate(undefined)}
    />
  );
}

function PickupOnBehalfAction({ s }: { s: ShipmentRow }) {
  const m = useAction(() => pickupShipment(getSupabase(), s.id), `${s.doc_no} di-pickup. Stok ${s.from_location?.name} berkurang.`, s.id);
  return (
    <ActionWithConfirm
      label="Pickup atas nama driver"
      variant="outline"
      title="Pickup atas nama driver?"
      description={`Gunakan bila driver ${s.driver?.full_name ?? ''} tidak bisa menekan pickup sendiri. Stok ${s.from_location?.name} langsung berkurang dan tercatat atas nama Anda.`}
      confirmLabel="Ya, pickup"
      mutation={m}
      onConfirm={() => m.mutate(undefined)}
    />
  );
}

function CancelAction({ s }: { s: ShipmentRow }) {
  const form = useForm<CancelShipmentValues>({ resolver: zodResolver(cancelShipmentSchema), defaultValues: { reason: '' } });
  const m = useAction((v: CancelShipmentValues) => cancelShipment(getSupabase(), s.id, v), `${s.doc_no} dibatalkan.`, s.id);
  const afterPickup = s.status === 'PICKED_UP';
  return (
    <ActionWithConfirm
      label={afterPickup ? 'Batal kirim' : 'Batalkan shipment'}
      variant="destructive"
      title={afterPickup ? 'Batal kirim?' : 'Batalkan shipment?'}
      description={
        afterPickup
          ? `Barang sudah di-pickup. Stok akan dikembalikan ke ${s.from_location?.name}.`
          : 'Stok tidak berubah karena barang belum di-pickup.'
      }
      confirmLabel="Ya, batalkan"
      mutation={m}
      onConfirm={form.handleSubmit((v) => m.mutate(v))}
    >
      <FormField id="cancel_reason" label="Alasan" error={form.formState.errors.reason?.message}>
        <Textarea id="cancel_reason" rows={2} {...form.register('reason')} />
      </FormField>
    </ActionWithConfirm>
  );
}
