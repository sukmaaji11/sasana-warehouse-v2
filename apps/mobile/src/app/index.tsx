import { Redirect } from 'expo-router';
import { ROLE_HOME } from '@/features/auth/routes';
import { useMyContext } from '@/features/auth/use-my-context';

/** Titik masuk setelah login: arahkan ke beranda sesuai role. */
export default function Index() {
  const { data } = useMyContext();
  if (!data) return null;
  return <Redirect href={ROLE_HOME[data.role]} />;
}
