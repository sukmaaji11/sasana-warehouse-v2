import { ROLE_LABELS } from '@sasana/shared-constants';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMyContext } from '@/features/auth/use-my-context';
import { BrandMark } from './brand-logo';
import { colors, font, radius, spacing } from '@/theme';

export { BrandMark } from './brand-logo';

const initials = (name: string) =>
  name
    .replace(/\(.*\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Admin Gudang yang hanya bertugas di gudang penjualan disebut "Admin Penjualan". */
function roleLabel(me: { role: keyof typeof ROLE_LABELS; locations: { type: string }[] }) {
  if (me.role === 'ADMIN_GUDANG' && me.locations.length > 0 && me.locations.every((l) => l.type === 'SALES_WAREHOUSE')) {
    return 'Admin Penjualan';
  }
  return ROLE_LABELS[me.role];
}

/**
 * Header aplikasi di halaman utama tiap tab: logo, nama aplikasi, role & lokasi,
 * dan avatar (ketuk → profil).
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { data: me } = useMyContext();
  const place =
    me?.role === 'SUPER_OWNER' ? 'Semua lokasi' : me?.locations.length ? me.locations.map((l) => l.name).join(', ') : 'Belum ada lokasi';

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <BrandMark />
      <View style={{ flex: 1 }}>
        <Text style={styles.app}>Sasana Warehouse</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {me ? `${roleLabel(me)} · ${place}` : 'Gudang Jamu'}
        </Text>
      </View>
      {me ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka profil"
          hitSlop={8}
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.avatarText}>{initials(me.full_name) || '?'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  app: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  sub: { fontSize: font.small, color: colors.textMuted },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.lg * 2,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: font.body },
});
