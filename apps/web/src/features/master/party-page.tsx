'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createParty, queryKeys, updateParty, type PartyTable, type Vendor } from '@sasana/shared-api';
import { partySchema, type PartyInput, type PartyValues } from '@sasana/shared-validation';
import { PencilIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActiveBadge, EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { FormField } from '@/components/app/form-field';
import { PageHeader } from '@/components/app/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/current-user';
import { can } from '@/features/auth/permissions';
import { getSupabase } from '@/lib/supabase/client';
import { useParties, useSaveMutation } from './queries';

const COPY: Record<PartyTable, { title: string; description: string; noun: string }> = {
  vendors: { title: 'Vendor', description: 'Pemasok packaging untuk inbound Gudang Rumah.', noun: 'vendor' },
  buyers: { title: 'Buyer', description: 'Pembeli produk jadi untuk distribusi.', noun: 'buyer' },
};

export function PartyPage({ table }: { table: PartyTable }) {
  const user = useCurrentUser();
  const editable = can.manageParties(user.role);
  const copy = COPY[table];
  const { data, error, isPending, refetch } = useParties(table);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Vendor | 'new' | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => !q || r.name.toLowerCase().includes(q) || r.phone?.includes(q));
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          editable ? (
            <Button onClick={() => setEditing('new')}>
              <PlusIcon /> Tambah {copy.noun}
            </Button>
          ) : null
        }
      />
      <div className="relative max-w-sm">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder="Cari nama atau telepon…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState message={search ? 'Tidak ada yang cocok.' : `Belum ada ${copy.noun}.`} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead className="hidden md:table-cell">Alamat</TableHead>
              <TableHead>Status</TableHead>
              {editable ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.phone ?? '–'}</TableCell>
                <TableCell className="hidden max-w-xs truncate md:table-cell">{r.address ?? '–'}</TableCell>
                <TableCell>
                  <ActiveBadge active={r.is_active} />
                </TableCell>
                {editable ? (
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${r.name}`} onClick={() => setEditing(r)}>
                      <PencilIcon />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing ? (
        <PartyDialog
          table={table}
          noun={copy.noun}
          party={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function PartyDialog({
  table,
  noun,
  party,
  onClose,
}: {
  table: PartyTable;
  noun: string;
  party: Vendor | null;
  onClose: () => void;
}) {
  const form = useForm<PartyInput, unknown, PartyValues>({
    resolver: zodResolver(partySchema),
    defaultValues: {
      name: party?.name ?? '',
      phone: party?.phone ?? '',
      address: party?.address ?? '',
      notes: party?.notes ?? '',
      is_active: party?.is_active ?? true,
    },
  });
  const save = useSaveMutation(
    (v: PartyValues) =>
      party ? updateParty(getSupabase(), table, party.id, v) : createParty(getSupabase(), table, v),
    [queryKeys[table]],
    party ? `Data ${noun} diperbarui` : `${noun[0]?.toUpperCase()}${noun.slice(1)} ditambahkan`,
    onClose,
  );
  const { errors } = form.formState;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{party ? `Ubah ${noun}` : `Tambah ${noun}`}</DialogTitle>
        </DialogHeader>
        <form id="party-form" className="flex flex-col gap-3" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          {save.error ? (
            <Alert variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <FormField id="name" label="Nama" error={errors.name?.message}>
            <Input id="name" autoFocus {...form.register('name')} aria-invalid={Boolean(errors.name)} />
          </FormField>
          <FormField id="phone" label="Telepon" error={errors.phone?.message}>
            <Input id="phone" inputMode="tel" {...form.register('phone')} />
          </FormField>
          <FormField id="address" label="Alamat" error={errors.address?.message}>
            <Textarea id="address" rows={2} {...form.register('address')} />
          </FormField>
          <FormField id="notes" label="Catatan" error={errors.notes?.message}>
            <Textarea id="notes" rows={2} {...form.register('notes')} />
          </FormField>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="is_active">Aktif</Label>
              </div>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="party-form" disabled={save.isPending}>
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
