'use client';

import type { UserRow } from '@sasana/shared-api';
import { ROLE_LABELS } from '@sasana/shared-constants';
import { KeyRoundIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActiveBadge, EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLocations, useUsers } from '@/features/master/queries';
import { CreateUserDialog, EditUserDialog, ResetPasswordDialog } from './user-dialogs';

type Dialog = { kind: 'create' } | { kind: 'edit'; user: UserRow } | { kind: 'password'; user: UserRow } | null;

export function UsersPage() {
  const users = useUsers();
  const locations = useLocations();
  const [dialog, setDialog] = useState<Dialog>(null);
  const locName = useMemo(() => new Map((locations.data ?? []).map((l) => [l.id, l.name])), [locations.data]);

  const pending = users.isPending || locations.isPending;
  const error = users.error ?? locations.error;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="User"
        description="Akun, role, dan lokasi yang boleh diakses."
        actions={
          <Button onClick={() => setDialog({ kind: 'create' })} disabled={pending}>
            <PlusIcon /> Tambah user
          </Button>
        }
      />
      {pending ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => (users.refetch(), locations.refetch())} />
      ) : users.data!.length === 0 ? (
        <EmptyState message="Belum ada user." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Lokasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data!.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge>
                </TableCell>
                <TableCell className="hidden max-w-xs text-sm md:table-cell">
                  {u.role === 'SUPER_OWNER'
                    ? 'Semua lokasi'
                    : u.user_locations.map((l) => locName.get(l.location_id) ?? '?').join(', ') || '–'}
                </TableCell>
                <TableCell>
                  <ActiveBadge active={u.is_active} />
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${u.full_name}`} onClick={() => setDialog({ kind: 'edit', user: u })}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Reset password ${u.full_name}`} onClick={() => setDialog({ kind: 'password', user: u })}>
                    <KeyRoundIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {dialog?.kind === 'create' ? <CreateUserDialog locations={locations.data ?? []} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'edit' ? <EditUserDialog user={dialog.user} locations={locations.data ?? []} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'password' ? <ResetPasswordDialog user={dialog.user} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
