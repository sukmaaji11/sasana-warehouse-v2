'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { queryKeys, signInWithUsername } from '@sasana/shared-api';
import { loginSchema, type LoginInput, type LoginValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnline } from '@/hooks/use-online';
import { getSupabase } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const online = useOnline();

  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const login = useMutation({
    mutationFn: (values: LoginValues) => signInWithUsername(getSupabase(), values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.myContext });
      router.replace('/');
      router.refresh();
    },
  });

  const { errors } = form.formState;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sasana Warehouse</CardTitle>
        <CardDescription>Masuk dengan username dan password Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit((values) => login.mutate(values))}
        >
          {login.error && (
            <Alert variant="destructive">
              <AlertDescription>{login.error.message}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              aria-invalid={Boolean(errors.username)}
              {...form.register('username')}
            />
            {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...form.register('password')}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" size="lg" disabled={login.isPending || !online}>
            {login.isPending && <Loader2Icon className="animate-spin" />}
            {online ? 'Masuk' : 'Menunggu koneksi…'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
