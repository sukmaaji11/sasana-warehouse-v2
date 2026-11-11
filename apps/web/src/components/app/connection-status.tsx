'use client';

import { WifiOffIcon } from 'lucide-react';
import { useOnline } from '@/hooks/use-online';

/** Banner yang muncul saat browser offline. Transaksi tidak bisa dikirim saat offline. */
export function ConnectionBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-white"
    >
      <WifiOffIcon className="size-4" />
      Tidak ada koneksi internet. Transaksi tidak dapat dikirim sampai koneksi kembali.
    </div>
  );
}
