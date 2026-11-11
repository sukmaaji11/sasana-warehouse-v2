import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'Inbound baru' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detail inbound' }} />
    </Stack>
  );
}
