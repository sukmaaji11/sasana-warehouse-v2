'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createUser, queryKeys, resetUserPassword, updateUser, type Location, type UserRow } from '@sasana/shared-api';
import { LOCATION_TYPE_LABELS, ROLE_LABELS, USER_ROLES } from '@sasana/shared-constants';
import {
  resetPasswordSchema,
  userCreateSchema,
  userUpdateSchema,
  type ResetPasswordValues,
  type UserCreateInput,
  type UserCreateValues,
  type UserUpdateInput,
  type UserUpdateValues,
} from '@sasana/shared-validation';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FormField } from '@/components/app/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { useSaveMutation } from '@/features/master/queries';
import { getSupabase } from '@/lib/supabase/client';

function Shell({
  title,
  description,
  formId,
  pending,
  error,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  formId: string;
  pending: boolean;
  error: Error | null;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleSelect(props: React.ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect className="w-full" {...props}>
      {USER_ROLES.map((r) => (
        <NativeSelectOption key={r} value={r}>
          {ROLE_LABELS[r]}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

function LocationChecklist({
  value,
  onChange,
  locations,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  locations: Location[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Lokasi</legend>
      {locations
        .filter((l) => l.is_active || value.includes(l.id))
        .map((l) => (
          <label key={l.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.includes(l.id)}
              onCheckedChange={(checked) => onChange(checked ? [...value, l.id] : value.filter((id) => id !== l.id))}
            />
            {l.name} <span className="text-muted-foreground">· {LOCATION_TYPE_LABELS[l.type]}</span>
          </label>
        ))}
      <p className="text-xs text-muted-foreground">Super Owner otomatis bisa mengakses semua lokasi.</p>
    </fieldset>
  );
}

export function CreateUserDialog({ locations, onClose }: { locations: Location[]; onClose: () => void }) {
  const form = useForm<UserCreateInput, unknown, UserCreateValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { username: '', full_name: '', role: 'DRIVER', password: '', location_ids: [] },
  });
  const save = useSaveMutation(
    (v: UserCreateValues) => createUser(getSupabase(), v),
    [queryKeys.users],
    'User dibuat',
    onClose,
  );
  const { errors } = form.formState;

  return (
    <Shell title="Tambah user" formId="create-user" pending={save.isPending} error={save.error} onClose={onClose}>
      <form id="create-user" className="flex flex-col gap-3" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <FormField id="full_name" label="Nama lengkap" error={errors.full_name?.message}>
          <Input id="full_name" autoFocus {...form.register('full_name')} aria-invalid={Boolean(errors.full_name)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="username" label="Username" error={errors.username?.message} hint="huruf kecil, angka, titik">
            <Input id="username" autoCapitalize="none" autoComplete="off" {...form.register('username')} aria-invalid={Boolean(errors.username)} />
          </FormField>
          <FormField id="role" label="Role" error={errors.role?.message}>
            <RoleSelect id="role" {...form.register('role')} />
          </FormField>
        </div>
        <FormField id="password" label="Password awal" error={errors.password?.message} hint="Min. 8 karakter, huruf + angka">
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} aria-invalid={Boolean(errors.password)} />
        </FormField>
        <Controller
          control={form.control}
          name="location_ids"
          render={({ field }) => <LocationChecklist value={field.value} onChange={field.onChange} locations={locations} />}
        />
      </form>
    </Shell>
  );
}

export function EditUserDialog({ user, locations, onClose }: { user: UserRow; locations: Location[]; onClose: () => void }) {
  const form = useForm<UserUpdateInput, unknown, UserUpdateValues>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
      location_ids: user.user_locations.map((l) => l.location_id),
    },
  });
  const save = useSaveMutation(
    (v: UserUpdateValues) => updateUser(getSupabase(), user.id, v),
    [queryKeys.users, queryKeys.myContext],
    'User diperbarui',
    onClose,
  );
  const { errors } = form.formState;

  return (
    <Shell title={`Ubah ${user.username}`} formId="edit-user" pending={save.isPending} error={save.error} onClose={onClose}>
      <form id="edit-user" className="flex flex-col gap-3" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <FormField id="full_name" label="Nama lengkap" error={errors.full_name?.message}>
          <Input id="full_name" {...form.register('full_name')} aria-invalid={Boolean(errors.full_name)} />
        </FormField>
        <FormField id="role" label="Role" error={errors.role?.message}>
          <RoleSelect id="role" {...form.register('role')} />
        </FormField>
        <Controller
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Switch id="user_active" checked={field.value} onCheckedChange={field.onChange} />
              <Label htmlFor="user_active">Aktif (nonaktif = tidak bisa login dan mengakses data)</Label>
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="location_ids"
          render={({ field }) => <LocationChecklist value={field.value} onChange={field.onChange} locations={locations} />}
        />
      </form>
    </Shell>
  );
}

export function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '' },
  });
  const save = useSaveMutation(
    (v: ResetPasswordValues) => resetUserPassword(getSupabase(), user.id, v),
    [],
    `Password ${user.username} direset`,
    onClose,
  );

  return (
    <Shell
      title="Reset password"
      description={`Password baru untuk ${user.full_name} (${user.username}). Sampaikan langsung ke yang bersangkutan.`}
      formId="reset-password"
      pending={save.isPending}
      error={save.error}
      onClose={onClose}
    >
      <form id="reset-password" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <FormField id="new_password" label="Password baru" error={form.formState.errors.password?.message} hint="Min. 8 karakter, huruf + angka">
          <Input id="new_password" type="password" autoComplete="new-password" autoFocus {...form.register('password')} />
        </FormField>
      </form>
    </Shell>
  );
}
