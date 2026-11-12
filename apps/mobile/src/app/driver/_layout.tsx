import { RoleTabs } from '@/components/role-tabs';

export default function Layout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'tasks', title: 'Tugas', icon: 'truck-delivery' },
        { name: 'history', title: 'Riwayat', icon: 'history' },
        { name: 'profile', title: 'Profil', icon: 'account-circle' },
      ]}
    />
  );
}
