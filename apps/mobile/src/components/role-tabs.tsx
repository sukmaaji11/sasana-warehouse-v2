import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { colors } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface TabDef {
  name: string;
  title: string;
  icon: IconName;
}

/** Bottom tabs standar untuk tiap role. Tab ditambah per phase. */
export function RoleTabs({ tabs }: { tabs: readonly TabDef[] }) {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name={t.icon} color={color as string} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
