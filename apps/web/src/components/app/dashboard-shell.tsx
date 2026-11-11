'use client';

import { ROLE_LABELS, type UserRole } from '@sasana/shared-constants';
import { LogOutIcon, WarehouseIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CurrentUserProvider } from '@/features/auth/current-user';
import { navForRole } from '@/features/auth/navigation';
import { SessionGate } from '@/features/auth/session-gate';
import { useSignOut } from '@/features/auth/use-sign-out';
import { cn } from '@/lib/utils';
import { ConnectionBanner } from './connection-status';

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <>
      <ConnectionBanner />
      <SessionGate>
        {(ctx) => (
          <CurrentUserProvider value={ctx}>
            <div className="flex flex-1 flex-col md:flex-row">
              <Sidebar role={ctx.role} />
              <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-14 items-center justify-between gap-4 border-b px-4 md:px-6">
                  <div className="truncate text-sm text-muted-foreground">
                    {ctx.locations.length > 0
                      ? ctx.locations.map((l) => l.name).join(' · ')
                      : 'Belum ada lokasi yang ditugaskan'}
                  </div>
                  <div className="shrink-0 text-right text-sm leading-tight">
                    <div className="font-medium">{ctx.full_name}</div>
                    <div className="text-muted-foreground">{ROLE_LABELS[ctx.role]}</div>
                  </div>
                </header>
                <main className="flex-1 p-4 md:p-6">{children}</main>
              </div>
            </div>
          </CurrentUserProvider>
        )}
      </SessionGate>
    </>
  );
}

function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const items = navForRole(role);

  return (
    <aside className="flex shrink-0 flex-col border-b bg-sidebar md:w-60 md:border-r md:border-b-0">
      <div className="flex h-14 items-center gap-2 px-4 font-semibold">
        <WarehouseIcon className="size-5 text-primary" />
        Sasana Warehouse
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                active
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden p-2 md:block">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <LogOutIcon /> Keluar
        </Button>
      </div>
    </aside>
  );
}
