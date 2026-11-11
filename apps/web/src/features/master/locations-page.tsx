'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createLocation, queryKeys, updateLocation, type Location } from '@sasana/shared-api';
import { LOCATION_TYPE_LABELS, LOCATION_TYPES } from '@sasana/shared-constants';
import { locationSchema, type LocationInput, type LocationValues } from '@sasana/shared-validation';
import { PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActiveBadge, EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { FormField } from '@/components/app/form-field';
import { PageHeader } from '@/components/app/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { getSupabase } from '@/lib/supabase/client';
import { useLocations, useSaveMutation } from './queries';

export function LocationsPage() {
  const { data, error, isPending, refetch } = useLocations();
  const [editing, setEditing] = useState<Location | 'new' | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Lokasi"
        description="Gudang, pabrik, dan gudang penjualan."
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon /> Tambah lokasi
          </Button>
        }
      />
      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState message="Belum ada lokasi." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="hidden md:table-cell">Alamat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{l.code}</TableCell>
                <TableCell className="font-medium">
                  {l.name}{' '}
                  {l.is_inbound_hub ? (
                    <Badge variant="outline" className="ml-1">
                      Tujuan inbound
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{LOCATION_TYPE_LABELS[l.type]}</TableCell>
                <TableCell className="hidden md:table-cell">{l.address ?? '–'}</TableCell>
                <TableCell>
                  <ActiveBadge active={l.is_active} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${l.name}`} onClick={() => setEditing(l)}>
                    <PencilIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editing ? <LocationDialog location={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function LocationDialog({ location, onClose }: { location: Location | null; onClose: () => void }) {
  const form = useForm<LocationInput, unknown, LocationValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      code: location?.code ?? '',
      name: location?.name ?? '',
      address: location?.address ?? '',
      type: location?.type ?? 'WAREHOUSE',
      is_active: location?.is_active ?? true,
    },
  });
  const save = useSaveMutation(
    (v: LocationValues) => (location ? updateLocation(getSupabase(), location.id, v) : createLocation(getSupabase(), v)),
    [queryKeys.locations, queryKeys.myContext],
    location ? 'Lokasi diperbarui' : 'Lokasi ditambahkan',
    onClose,
  );
  const { errors } = form.formState;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{location ? 'Ubah lokasi' : 'Tambah lokasi'}</DialogTitle>
        </DialogHeader>
        <form id="location-form" className="flex flex-col gap-3" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          {save.error ? (
            <Alert variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <FormField id="code" label="Kode" error={errors.code?.message} hint="Contoh: GPJ-KMB">
            <Input id="code" className="uppercase" {...form.register('code')} aria-invalid={Boolean(errors.code)} />
          </FormField>
          <FormField id="name" label="Nama" error={errors.name?.message}>
            <Input id="name" {...form.register('name')} aria-invalid={Boolean(errors.name)} />
          </FormField>
          <FormField id="type" label="Tipe" error={errors.type?.message}>
            <NativeSelect id="type" className="w-full" {...form.register('type')}>
              {LOCATION_TYPES.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {LOCATION_TYPE_LABELS[t]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="address" label="Alamat" error={errors.address?.message}>
            <Textarea id="address" rows={2} {...form.register('address')} />
          </FormField>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch id="loc_active" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="loc_active">Aktif</Label>
              </div>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="location-form" disabled={save.isPending}>
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
