import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Status koneksi dari onlineManager (diisi NetInfo di setupQueryEnvironment). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
  );
}
