import { RoleTabs } from '@/components/role-tabs';

export default function Layout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Tugas', icon: 'truck-delivery' },
        { name: 'profile', title: 'Profil', icon: 'account-circle' },
      ]}
    />
  );
}
