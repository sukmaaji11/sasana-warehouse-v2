import { RoleTabs } from '@/components/role-tabs';
import { useMyContext } from '@/features/auth/use-my-context';

export default function Layout() {
  const { data: me } = useMyContext();
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Beranda', icon: 'factory' },
        { name: 'production', title: 'Produksi', icon: 'cogs' },
        // Admin Pabrik tidak input/lihat distribusi.
        { name: 'distribution', title: 'Distribusi', icon: 'send', hidden: me?.role !== 'OWNER_PABRIK' },
        { name: 'shipments', title: 'Shipment', icon: 'truck-fast' },
        { name: 'stock', title: 'Stok', icon: 'package-variant-closed' },
        { name: 'profile', title: 'Profil', icon: 'account-circle' },
      ]}
    />
  );
}
