import { zodResolver } from '@hookform/resolvers/zod';
import { queryKeys, signInWithUsername } from '@sasana/shared-api';
import { loginSchema, type LoginInput, type LoginValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, type ComponentRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View, type TextInput } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useOnline } from '@/hooks/use-online';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/theme';

export function LoginScreen() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="Sasana Warehouse" subtitle="Masuk dengan username dan password Anda.">
        <Card>
          {login.error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{login.error.message}</Text>
            </View>
          ) : null}
          <Controller
            control={control}
            name="username"
            render={({ field }) => (
              <TextField
                label="Username"
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
                secureTextEntry
                autoComplete="current-password"
                returnKeyType="go"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                onSubmitEditing={submit}
                error={formState.errors.password?.message}
              />
            )}
          />
          <Button
            title={online ? 'Masuk' : 'Menunggu koneksi…'}
            onPress={submit}
            loading={login.isPending}
            disabled={!online}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  errorBox: { backgroundColor: colors.dangerSurface, borderRadius: radius.sm, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: font.small },
});
