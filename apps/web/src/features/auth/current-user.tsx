'use client';

import type { MyContext } from '@sasana/shared-types';
import { createContext, use, type ReactNode } from 'react';

const CurrentUserContext = createContext<MyContext | null>(null);

export function CurrentUserProvider({ value, children }: { value: MyContext; children: ReactNode }) {
  return <CurrentUserContext value={value}>{children}</CurrentUserContext>;
}

/** User aktif (sudah lolos SessionGate). Hanya dipakai di dalam layout dashboard. */
export function useCurrentUser(): MyContext {
  const ctx = use(CurrentUserContext);
  if (!ctx) throw new Error('useCurrentUser harus dipakai di dalam CurrentUserProvider');
  return ctx;
}
