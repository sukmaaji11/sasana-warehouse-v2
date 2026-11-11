import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/login-form';
import { ConnectionBanner } from '@/components/app/connection-status';

export const metadata: Metadata = { title: 'Masuk' };

export default function LoginPage() {
  return (
    <>
      <ConnectionBanner />
      <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
        <LoginForm />
      </main>
    </>
  );
}
