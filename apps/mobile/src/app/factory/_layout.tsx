import { RoleTabs } from '@/components/role-tabs';
import { useMyContext } from '@/features/auth/use-my-context';

export default function Layout() {
  const { data: me } = useMyContext();
  const isOwner = me?.role === 'OWNER_PABRIK';
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Beranda', icon: 'factory' },
        { name: 'production', title: 'Produksi', icon: 'cogs' },
        // Admin Pabrik tidak input/lihat distribusi.
        { name: 'distribution', title: 'Penjualan', icon: 'cart-outline', hidden: !isOwner },
        { name: 'shipments', title: 'Pengiriman', icon: 'truck-fast' },
        { name: 'stock', title: 'Stok', icon: 'package-variant-closed' },
        // Owner Pabrik: tab Laporan; Profil lewat avatar header. Admin Pabrik: tetap tab Profil.
        { name: 'reports', title: 'Laporan', icon: 'file-chart-outline', hidden: !isOwner },
        { name: 'profile', title: 'Profil', icon: 'account-circle', hidden: isOwner },
      ]}
    />
  );
}
