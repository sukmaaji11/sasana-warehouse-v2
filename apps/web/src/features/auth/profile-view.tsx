'use client';

import { LOCATION_TYPE_LABELS, ROLE_LABELS } from '@sasana/shared-constants';
import { LogOutIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCurrentUser } from './current-user';
import { useSignOut } from './use-sign-out';

export function ProfileView() {
  const user = useCurrentUser();
  const signOut = useSignOut();

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Profil</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Nama</dt>
          <dd>{user.full_name}</dd>
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-mono">{user.username}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          </dd>
        </dl>
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Lokasi</p>
          {user.locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada lokasi yang ditugaskan.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {user.locations.map((l) => (
                <li key={l.id}>
                  {l.name} <span className="text-muted-foreground">· {LOCATION_TYPE_LABELS[l.type]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Separator />
        <Button variant="outline" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
          <LogOutIcon /> Keluar
        </Button>
      </CardContent>
    </Card>
  );
}
