import { RoleTabs } from '@/components/role-tabs';

export default function Layout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Beranda', icon: 'view-dashboard' },
        { name: 'production', title: 'Produksi', icon: 'cogs' },
        { name: 'distribution', title: 'Penjualan', icon: 'cart-outline' },
        { name: 'shipments', title: 'Pengiriman', icon: 'truck-fast' },
        { name: 'stock', title: 'Stok', icon: 'package-variant-closed' },
        { name: 'reports', title: 'Laporan', icon: 'file-chart-outline' },
        // Profil dibuka dari avatar di header (tab dipakai untuk Laporan).
        { name: 'profile', title: 'Profil', icon: 'account-circle', hidden: true },
      ]}
    />
  );
}
