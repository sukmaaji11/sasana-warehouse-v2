import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useSegments } from 'expo-router';
import type { ComponentProps } from 'react';
import { colors } from '@/theme';
import { AppHeader } from './app-header';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface TabDef {
  name: string;
  title: string;
  icon: IconName;
  /** Sembunyikan tab untuk user ini (route tetap ada, tapi tidak tampil di bar). */
  hidden?: boolean;
}

/**
 * Bottom tabs standar untuk tiap role + header aplikasi.
 * Header aplikasi hanya di halaman utama tab; halaman detail/form memakai
 * header Stack-nya sendiri (dengan tombol kembali).
 */
export function RoleTabs({ tabs }: { tabs: readonly TabDef[] }) {
  const segments = useSegments() as string[];
  // ['factory', 'production'] = halaman utama tab; ['factory', 'production', 'new'] = halaman dalam.
  const deep = segments.length > 2 && segments[2] !== 'index';

  return (
    <Tabs
      screenOptions={{
        headerShown: !deep,
        header: () => <AppHeader />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { height: 64, paddingTop: 6 },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            href: t.hidden ? null : undefined,
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={t.icon} color={color as string} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
