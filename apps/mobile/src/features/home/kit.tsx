import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatQty } from '@sasana/shared-constants';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Navigasi ke halaman dalam tab; halaman daftar tetap di bawahnya (tombol kembali → daftar). */
export const go = (path: string) => router.navigate(path as never, { withAnchor: true });

export function greeting() {
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta' }));
  return hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
}

/** Kerangka beranda: scroll + tarik untuk memuat ulang. */
export function HomeScroll({ refreshing, onRefresh, children }: { refreshing: boolean; onRefresh: () => void; children: ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {children}
    </ScrollView>
  );
}

/** Sapaan + satu kalimat ringkasan dalam bahasa sehari-hari. */
export function Hero({ name, place, summary }: { name: string; place?: string; summary: string }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.heroGreet}>{greeting()},</Text>
      <Text style={styles.heroName}>{name}</Text>
      {place ? (
        <View style={styles.heroPlace}>
          <MaterialCommunityIcons name="map-marker" size={14} color="rgba(255,255,255,0.9)" />
          <Text style={styles.heroPlaceText}>{place}</Text>
        </View>
      ) : null}
      <Text style={styles.heroSummary}>{summary}</Text>
    </View>
  );
}

type Tone = 'green' | 'blue' | 'orange' | 'red' | 'gray';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: colors.primarySurface, fg: colors.primary },
  blue: { bg: colors.infoSurface, fg: colors.info },
  orange: { bg: colors.warningSurface, fg: colors.warning },
  red: { bg: colors.dangerSurface, fg: colors.danger },
  gray: { bg: '#EEF0EF', fg: colors.textMuted },
};

/** Angka besar dengan label sederhana. */
export function StatTile({
  icon,
  label,
  value,
  unit = 'sachet',
  note,
  tone = 'green',
  onPress,
}: {
  icon: IconName;
  label: string;
  value: number;
  unit?: string;
  note?: string;
  tone?: Tone;
  onPress?: () => void;
}) {
  const t = TONES[tone];
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: t.bg }]}>
        <MaterialCommunityIcons name={icon} size={20} color={t.fg} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>
        {formatQty(value)}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
      {note ? <Text style={styles.tileNote}>{note}</Text> : null}
    </Pressable>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** Tombol tugas utama yang besar. */
export function BigAction({
  icon,
  title,
  subtitle,
  onPress,
  badge,
  variant = 'primary',
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: number;
  variant?: 'primary' | 'light';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.big, primary ? styles.bigPrimary : styles.bigLight, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.bigIcon, { backgroundColor: primary ? 'rgba(255,255,255,0.2)' : colors.primarySurface }]}>
        <MaterialCommunityIcons name={icon} size={28} color={primary ? colors.onPrimary : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bigTitle, { color: primary ? colors.onPrimary : colors.text }]}>{title}</Text>
        <Text style={[styles.bigSub, { color: primary ? 'rgba(255,255,255,0.9)' : colors.textMuted }]}>{subtitle}</Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={26} color={primary ? colors.onPrimary : colors.textMuted} />
      )}
    </Pressable>
  );
}

/** Judul bagian + tautan "Lihat semua". */
export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
            <Text style={styles.sectionAction}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Baris daftar sederhana: ikon, judul, keterangan, angka di kanan. */
export function ListRow({
  icon,
  tone = 'green',
  title,
  subtitle,
  right,
  rightNote,
  onPress,
}: {
  icon: IconName;
  tone?: Tone;
  title: string;
  subtitle?: string;
  right?: string;
  rightNote?: string;
  onPress?: () => void;
}) {
  const t = TONES[tone];
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.background }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
        <MaterialCommunityIcons name={icon} size={18} color={t.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.rowRight, tone === 'red' && { color: colors.danger }]}>{right}</Text>
          {rightNote ? <Text style={styles.rowSub}>{rightNote}</Text> : null}
        </View>
      ) : null}
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function AllGood({ text }: { text: string }) {
  return (
    <View style={styles.allGood}>
      <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
      <Text style={styles.allGoodText}>{text}</Text>
    </View>
  );
}

export const homeStyles = StyleSheet.create({
  muted: { fontSize: font.small, color: colors.textMuted },
  error: { fontSize: font.body, color: colors.danger },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  hero: { backgroundColor: colors.primary, borderRadius: radius.lg + 4, padding: spacing.xl, gap: 2 },
  heroGreet: { color: 'rgba(255,255,255,0.85)', fontSize: font.body },
  heroName: { color: colors.onPrimary, fontSize: font.title, fontWeight: '800' },
  heroPlace: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroPlaceText: { color: 'rgba(255,255,255,0.9)', fontSize: font.small },
  heroSummary: { color: colors.onPrimary, fontSize: font.body, fontWeight: '600', marginTop: spacing.md, lineHeight: 22 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  tileLabel: { fontSize: font.small, color: colors.textMuted },
  tileValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  tileUnit: { fontSize: font.small, fontWeight: '500', color: colors.textMuted },
  tileNote: { fontSize: 11, color: colors.textMuted },

  big: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg + 2, padding: spacing.lg },
  bigPrimary: { backgroundColor: colors.primary },
  bigLight: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bigIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bigTitle: { fontSize: font.heading, fontWeight: '800' },
  bigSub: { fontSize: font.small, marginTop: 2 },
  badge: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  badgeText: { color: colors.onPrimary, fontWeight: '800', fontSize: font.body },

  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionTitle: { fontSize: font.heading, fontWeight: '800', color: colors.text },
  sectionAction: { fontSize: font.small, fontWeight: '700', color: colors.primary },
  sectionBody: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: font.body, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 11, color: colors.textMuted },
  rowRight: { fontSize: font.body, fontWeight: '800', color: colors.text },
  empty: { fontSize: font.small, color: colors.textMuted, padding: spacing.lg, textAlign: 'center' },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  allGoodText: { fontSize: font.body, color: colors.success, fontWeight: '600', flex: 1 },
});
