import { RoleTabs } from '@/components/role-tabs';

export default function Layout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Beranda', icon: 'view-dashboard' },
        { name: 'production', title: 'Produksi', icon: 'cogs' },
        { name: 'shipments', title: 'Shipment', icon: 'truck-fast' },
        { name: 'stock', title: 'Stok', icon: 'package-variant-closed' },
        { name: 'profile', title: 'Profil', icon: 'account-circle' },
      ]}
    />
  );
}
