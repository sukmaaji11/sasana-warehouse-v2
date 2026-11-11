'use client';

import type { ReactNode } from 'react';
import { EmptyState } from '@/components/app/data-state';
import { useCurrentUser } from './current-user';
import { can } from './permissions';

/**
 * Sembunyikan halaman dari role yang tidak berhak (UX). Data tetap dijaga RLS.
 * `permission` berupa string supaya bisa dipakai dari Server Component.
 */
export function RequireRole({ permission, children }: { permission: keyof typeof can; children: ReactNode }) {
  const user = useCurrentUser();
  if (!can[permission](user.role)) return <EmptyState message="Anda tidak memiliki akses ke halaman ini." />;
  return <>{children}</>;
}
