import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'Catat penjualan' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detail penjualan' }} />
    </Stack>
  );
}

/** Halaman daftar selalu ada di bawah detail/form → tombol kembali menuju daftar. */
export const unstable_settings = { anchor: 'index' };
