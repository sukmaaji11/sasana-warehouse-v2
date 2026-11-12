import { RoleTabs } from '@/components/role-tabs';
import { useMyContext } from '@/features/auth/use-my-context';

export default function Layout() {
  const { data: me } = useMyContext();
  const atSalesWarehouse = (me?.locations ?? []).some((l) => l.type === 'SALES_WAREHOUSE');
  const atHub = (me?.locations ?? []).some((l) => l.type === 'WAREHOUSE');
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Beranda', icon: 'home-variant' },
        { name: 'inbound', title: 'Terima Vendor', icon: 'package-down', hidden: !atHub && atSalesWarehouse },
        // Q21: distribusi hanya untuk Admin Gudang di Gudang Penjualan.
        { name: 'distribution', title: 'Penjualan', icon: 'cart-outline', hidden: !atSalesWarehouse },
        { name: 'shipments', title: 'Pengiriman', icon: 'truck-fast' },
        { name: 'stock', title: 'Stok', icon: 'package-variant-closed' },
        { name: 'profile', title: 'Profil', icon: 'account-circle' },
      ]}
    />
  );
}
