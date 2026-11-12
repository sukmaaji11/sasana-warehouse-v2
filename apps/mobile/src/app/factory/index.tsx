import { HomeScreen } from '@/features/auth/home-screen';
import { useMyContext } from '@/features/auth/use-my-context';

export default function Home() {
  const { data: me } = useMyContext();
  return (
    <HomeScreen
      hint={
        me?.role === 'OWNER_PABRIK'
          ? 'Produksi, distribusi, shipment, dan stok pabrik tersedia di tab bawah.'
          : 'Produksi, shipment masuk, dan stok pabrik tersedia di tab bawah.'
      }
    />
  );
}
