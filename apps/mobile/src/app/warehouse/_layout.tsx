import { RoleTabs } from '@/components/role-tabs';

export default function Layout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Beranda', icon: 'home-variant' },
        { name: 'profile', title: 'Profil', icon: 'account-circle' },
      ]}
    />
  );
}
