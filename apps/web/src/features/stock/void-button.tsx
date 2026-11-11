'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { queryKeys, voidTransaction, type VoidableRef } from '@sasana/shared-api';
import { voidSchema, type VoidValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BanIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { FormField } from '@/components/app/form-field';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getSupabase } from '@/lib/supabase/client';
import { STOCK_INVALIDATE } from './queries';

/** Void (Super Owner): membalik seluruh pergerakan stok transaksi. */
export function VoidButton({ refType, refId, docNo }: { refType: VoidableRef; refId: string; docNo: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const form = useForm<VoidValues>({ resolver: zodResolver(voidSchema), defaultValues: { reason: '' } });
  const mutation = useMutation({
    mutationFn: (v: VoidValues) => voidTransaction(getSupabase(), refType, refId, v),
    onSuccess: async () => {
      await Promise.all(
        [...STOCK_INVALIDATE, refType === 'inbound' ? queryKeys.inbound(refId) : queryKeys.adjustment(refId)].map(
          (queryKey) => qc.invalidateQueries({ queryKey }),
        ),
      );
      toast.success(`${docNo} dibatalkan (void). Stok sudah dikembalikan.`);
      setOpen(false);
    },
  });

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <BanIcon /> Void
      </Button>
      <ConfirmDialog
        open={open}
        destructive
        title={`Void ${docNo}?`}
        description="Seluruh perubahan stok dari transaksi ini akan dibalik. Transaksi tetap tersimpan dengan status Void. Ditolak jika stoknya sudah terpakai."
        confirmLabel="Ya, void"
        pending={mutation.isPending}
        error={mutation.error}
        onCancel={() => {
          setOpen(false);
          mutation.reset();
        }}
        onConfirm={form.handleSubmit((v) => mutation.mutate(v))}
      >
        <FormField id="void_reason" label="Alasan void" error={form.formState.errors.reason?.message}>
          <Textarea id="void_reason" rows={2} placeholder="Contoh: salah input jumlah" {...form.register('reason')} />
        </FormField>
      </ConfirmDialog>
    </>
  );
}
