'use client';

import type { MyContext } from '@sasana/shared-types';
import { Loader2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMyContext } from './use-my-context';
import { useSignOut } from './use-sign-out';

function BlockedCard({ title, description }: { title: string; description: string }) {
  const signOut = useSignOut();
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
            Keluar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

/** Memuat profil user lalu menahan akses web untuk akun nonaktif, tanpa profil, atau DRIVER. */
export function SessionGate({ children }: { children: (ctx: MyContext) => ReactNode }) {
  const { data, error, isPending, refetch } = useMyContext();

  if (isPending) {
    return (
      <main className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" /> Memuat akun…
      </main>
    );
  }
  if (error) {
    if ((error as { code?: string }).code === 'PROFILE_NOT_FOUND') {
      return <BlockedCard title="Profil belum dibuat" description={error.message} />;
    }
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-destructive">{error.message}</p>
        <Button variant="outline" onClick={() => refetch()}>
          Coba lagi
        </Button>
      </main>
    );
  }
  if (!data.is_active) {
    return <BlockedCard title="Akun nonaktif" description="Akun Anda dinonaktifkan. Hubungi Super Owner." />;
  }
  if (data.role === 'DRIVER') {
    return (
      <BlockedCard
        title="Gunakan aplikasi Android"
        description="Akun driver menggunakan aplikasi Android Sasana Warehouse untuk melihat dan menjalankan tugas pengiriman."
      />
    );
  }
  return <>{children(data)}</>;
}
