import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Penjelasan singkat fungsi layar. Ringkasan selalu tampil; ketuk untuk
 * melihat langkah-langkah lengkap.
 */
export function InfoTip({ title, summary, steps }: { title: string; summary: string; steps?: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => steps?.length && setOpen((o) => !o)}
      style={styles.box}
    >
      <View style={styles.head}>
        <MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
        {steps?.length ? (
          <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
        ) : null}
      </View>
      <Text style={styles.text}>{summary}</Text>
      {open
        ? steps?.map((s, i) => (
            <View key={s} style={styles.step}>
              <Text style={styles.num}>{i + 1}</Text>
              <Text style={[styles.text, { flex: 1 }]}>{s}</Text>
            </View>
          ))
        : null}
    </Pressable>
  );
}

/** Keadaan kosong dengan ikon, penjelasan, dan (opsional) aksi. */
export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primarySurface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: font.body, fontWeight: '700', color: colors.primary },
  text: { fontSize: font.small, color: colors.text, lineHeight: 20 },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.xs },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 22,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyText: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
