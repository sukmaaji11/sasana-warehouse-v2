import type { Metadata } from 'next';
import { RequireRole } from '@/features/auth/require-role';
import { UsersPage } from '@/features/users/users-page';

export const metadata: Metadata = { title: 'User' };

export default function Page() {
  return (
    <RequireRole permission="manageUsers">
      <UsersPage />
    </RequireRole>
  );
}
