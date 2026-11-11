import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '@/theme';
import { Button } from './button';

/**
 * Bottom sheet konfirmasi untuk tindakan yang mengubah stok.
 * Saat error jaringan, tombol menjadi "Kirim ulang" (idempotency key sama → aman).
 */
export function ConfirmSheet({
  visible,
  title,
  children,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  pending: boolean;
  error: Error | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isNetwork = (error as { code?: string } | null)?.code === 'NETWORK';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {
      if (!pending) onCancel();
    }}>
      <Pressable style={styles.backdrop} onPress={() => !pending && onCancel()} accessibilityLabel="Tutup" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.title}>{title}</Text>
        {children}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error.message}
              {isNetwork ? ' Status belum pasti — tekan "Kirim ulang"; transaksi tidak akan tercatat dua kali.' : ''}
            </Text>
          </View>
        ) : null}
        <Button title={isNetwork ? 'Kirim ulang' : confirmLabel} onPress={onConfirm} loading={pending} />
        <Button title="Batal" variant="outline" onPress={onCancel} disabled={pending} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  errorBox: { backgroundColor: colors.dangerSurface, borderRadius: radius.sm, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: font.small },
});
