import { MaterialCommunityIcons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { queryKeys, signInWithUsername } from '@sasana/shared-api';
import { loginSchema, type LoginInput, type LoginValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRef, useState, type ComponentRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useOnline } from '@/hooks/use-online';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/theme';

export function LoginScreen() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, formState } = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const login = useMutation({
    mutationFn: (values: LoginValues) => signInWithUsername(supabase, values),
    // Navigasi ditangani guard di root layout setelah sesi & profil termuat.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myContext }),
  });

  const submit = () => void handleSubmit((values) => login.mutate(values))();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.band} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.markRing}>
              <BrandMark size={64} />
            </View>
            <Text style={styles.appName}>Sasana Warehouse</Text>
            <Text style={styles.tagline}>Stok kemasan, produksi & distribusi jamu</Text>
          </View>

          <View style={styles.card}>
            <View style={{ gap: 2 }}>
              <Text style={styles.cardTitle}>Masuk</Text>
              <Text style={styles.cardSub}>Gunakan username dan password dari Super Owner.</Text>
            </View>

            {login.error ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{login.error.message}</Text>
              </View>
            ) : null}

            <Controller
              control={control}
              name="username"
              render={({ field }) => (
                <TextField
                  label="Username"
                  icon="account-outline"
                  placeholder="contoh: admin.gudang"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  returnKeyType="next"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  error={formState.errors.username?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <TextField
                  ref={passwordRef}
                  label="Password"
                  icon="lock-outline"
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  returnKeyType="go"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  onSubmitEditing={submit}
                  error={formState.errors.password?.message}
                  right={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      hitSlop={10}
                      onPress={() => setShowPassword((s) => !s)}
                    >
                      <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
                    </Pressable>
                  }
                />
              )}
            />
            <Button title={online ? 'Masuk' : 'Menunggu koneksi…'} onPress={submit} loading={login.isPending} disabled={!online} />
            <View style={styles.helpRow}>
              <MaterialCommunityIcons name="help-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.help}>Lupa password? Minta Super Owner untuk mengatur ulang.</Text>
            </View>
          </View>

          <Text style={styles.version}>Versi {Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // Pita hijau di atas sebagai latar brand
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%', backgroundColor: colors.primary },
  center: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl, maxWidth: 520, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', gap: spacing.sm },
  markRing: { padding: 6, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.25)' },
  appName: { fontSize: 20, fontWeight: '800', color: colors.onPrimary, letterSpacing: 0.2 },
  tagline: { fontSize: font.small, color: 'rgba(255,255,255,0.9)' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    padding: spacing.xl,
    gap: spacing.lg,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  cardTitle: { fontSize: font.title, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: font.small, color: colors.textMuted },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: font.small },
  helpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  help: { fontSize: font.small, color: colors.textMuted, textAlign: 'center' },
  version: { textAlign: 'center', fontSize: 11, color: colors.textMuted },
});
