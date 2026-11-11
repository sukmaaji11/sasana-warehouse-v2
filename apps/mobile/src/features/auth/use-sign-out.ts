import { signOut } from '@sasana/shared-api';
import { useMutation } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

export function useSignOut() {
  return useMutation({
    mutationFn: () => signOut(supabase),
    onError: (e) => Alert.alert('Gagal keluar', e.message),
  });
}

/** Konfirmasi sebelum logout supaya tidak tertekan tanpa sengaja. */
export function useConfirmSignOut() {
  const mutation = useSignOut();
  const confirm = () =>
    Alert.alert('Keluar dari akun?', 'Anda perlu login kembali untuk melanjutkan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => mutation.mutate() },
    ]);
  return { confirm, isPending: mutation.isPending };
}
