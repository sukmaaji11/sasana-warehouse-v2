import NetInfo from '@react-native-community/netinfo';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    // Online-first: mutasi tidak ditahan lalu dikirim diam-diam saat koneksi kembali
    // ('always' = langsung gagal jika offline) dan tidak di-retry otomatis.
    // Retry dilakukan user dengan idempotency key yang sama (Phase 3+).
    mutations: { retry: false, networkMode: 'always' },
  },
});

/** Hubungkan status jaringan & app state ke TanStack Query. Panggil sekali saat startup. */
export function setupQueryEnvironment(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    }),
  );

  const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
  return () => sub.remove();
}
