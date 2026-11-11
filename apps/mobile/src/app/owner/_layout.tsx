import { RoleTabs } from '@/components/role-tabs';

export default function Layout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Beranda', icon: 'view-dashboard' },
        { name: 'profile', title: 'Profil', icon: 'account-circle' },
      ]}
    />
  );
}
