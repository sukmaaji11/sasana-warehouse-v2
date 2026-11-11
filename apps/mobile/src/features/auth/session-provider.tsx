import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface SessionState {
  /** undefined = masih memuat sesi dari storage */
  session: Session | null | undefined;
}

const SessionContext = createContext<SessionState>({ session: undefined });

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <SessionContext value={{ session }}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  return use(SessionContext);
}
