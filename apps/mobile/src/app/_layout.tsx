import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConnectionBanner } from '@/components/connection-banner';
import { Button } from '@/components/ui/button';
import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { useMyContext } from '@/features/auth/use-my-context';
import { queryClient, setupQueryEnvironment } from '@/lib/query-client';
import { colors, font, spacing } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => setupQueryEnvironment(), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          <ConnectionBanner />
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Navigasi berdasarkan sesi + role. Ini hanya untuk UX:
 * otorisasi data tetap dilakukan RLS/RPC di database.
 */
function RootNavigator() {
  const { session } = useSession();
  const ctx = useMyContext(Boolean(session));

  const loadingSession = session === undefined;
  const loadingContext = Boolean(session) && ctx.isPending && ctx.fetchStatus !== 'idle';
  const ready = !loadingSession && !loadingContext;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const errorCode = (ctx.error as { code?: string } | null)?.code;
  if (session && ctx.error && errorCode !== 'PROFILE_NOT_FOUND' && !ctx.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{ctx.error.message}</Text>
        <Button title="Coba lagi" variant="outline" onPress={() => ctx.refetch()} />
      </View>
    );
  }

  const user = ctx.data;
  const loggedIn = Boolean(session);
  const blocked = loggedIn && (!user || !user.is_active);
  const role = loggedIn && !blocked ? user?.role : undefined;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={blocked}>
        <Stack.Screen name="blocked" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(role)}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'DRIVER'}>
        <Stack.Screen name="driver" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'ADMIN_GUDANG'}>
        <Stack.Screen name="warehouse" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'OWNER_PABRIK'}>
        <Stack.Screen name="factory" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'SUPER_OWNER'}>
        <Stack.Screen name="owner" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  error: { fontSize: font.body, color: colors.danger, textAlign: 'center' },
});
