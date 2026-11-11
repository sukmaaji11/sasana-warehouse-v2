'use client';

import type { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Konfirmasi wajib sebelum tindakan yang mengubah stok.
 * Saat error jaringan, tombol menjadi "Kirim ulang" (idempotency key sama → aman).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  pending,
  error,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel: string;
  pending: boolean;
  error: Error | null;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isNetwork = (error as { code?: string } | null)?.code === 'NETWORK';
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error.message}
              {isNetwork ? ' Status transaksi belum pasti — tekan "Kirim ulang"; transaksi tidak akan tercatat dua kali.' : ''}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Batal
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={pending}>
            {pending ? 'Memproses…' : isNetwork ? 'Kirim ulang' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
