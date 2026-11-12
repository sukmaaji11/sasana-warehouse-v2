import { FactoryAdminHome, FactoryOwnerHome } from '@/features/home/factory-home';
import { OwnerHome } from '@/features/home/owner-home';
import { WarehouseHome } from '@/features/home/warehouse-home';
import { useMyContext } from './use-my-context';

/** Beranda berbeda untuk setiap role — hanya menampilkan yang dikerjakan role tsb. */
export function HomeScreen() {
  const { data: me } = useMyContext();
  if (!me) return null;
  switch (me.role) {
    case 'SUPER_OWNER':
      return <OwnerHome me={me} />;
    case 'OWNER_PABRIK':
      return <FactoryOwnerHome me={me} />;
    case 'ADMIN_PABRIK':
      return <FactoryAdminHome me={me} />;
    case 'ADMIN_GUDANG':
      return <WarehouseHome me={me} />;
    default:
      return null;
  }
}
