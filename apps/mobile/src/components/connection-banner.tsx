import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnline } from '@/hooks/use-online';
import { colors, font, spacing } from '@/theme';

/** Banner merah saat tidak ada internet. Transaksi tidak bisa dikirim saat offline. */
export function ConnectionBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View style={[styles.banner, { paddingTop: insets.top + spacing.sm }]} accessibilityRole="alert">
      <Text style={styles.text}>Tidak ada koneksi internet. Transaksi tidak dapat dikirim.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  text: { color: colors.onPrimary, fontSize: font.small, fontWeight: '600', textAlign: 'center' },
});
