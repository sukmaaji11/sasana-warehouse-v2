import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ShipmentRow } from '@sasana/shared-api';
import { formatDateTime, formatQty, type ShipmentStatus } from '@sasana/shared-constants';
import { router } from 'expo-router';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { useMyContext } from '@/features/auth/use-my-context';
import { useShipments } from '@/features/shipments/queries';
import { colors, font, radius, spacing } from '@/theme';
import { greeting, type IconName } from './kit';

const GROUPS: { status: ShipmentStatus; title: string; hint: string; icon: IconName; color: string; bg: string }[] = [
  { status: 'ASSIGNED', title: 'Tugas saat ini', hint: 'Ambil barang, lalu tekan PICKUP', icon: 'clipboard-text-outline', color: colors.warning, bg: colors.warningSurface },
  { status: 'PICKED_UP', title: 'Sedang dalam perjalanan', hint: 'Antar ke tujuan. Petugas di sana yang menekan Terima', icon: 'truck-fast', color: colors.info, bg: colors.infoSurface },
  { status: 'RECEIVED', title: 'Tugas selesai', hint: 'Barang sudah diterima di tujuan', icon: 'check-circle-outline', color: colors.success, bg: colors.primarySurface },
];

/** Daftar tugas driver dikelompokkan per tahap. */
export function DriverTasks() {
  const { data: me } = useMyContext();
  const q = useShipments(['ASSIGNED', 'PICKED_UP', 'RECEIVED']);
  const rows = q.data ?? [];
  const sections = GROUPS.map((g) => ({
    ...g,
    data: rows.filter((s) => s.status === g.status).slice(0, g.status === 'RECEIVED' ? 10 : undefined),
  }));
  const todo = sections[0]!.data.length;
  const onRoad = sections[1]!.data.length;

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(s) => s.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      ListHeaderComponent={
        <View style={styles.hero}>
          <Text style={styles.heroGreet}>{greeting()},</Text>
          <Text style={styles.heroName}>{me?.full_name ?? ''}</Text>
          <View style={styles.heroStats}>
            <HeroStat value={todo} label="perlu diambil" />
            <HeroStat value={onRoad} label="sedang diantar" />
          </View>
          {q.error && !q.data ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Text style={styles.heroErr}>{q.error.message}</Text>
              <Button title="Coba lagi" variant="outline" onPress={() => q.refetch()} />
            </View>
          ) : null}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.groupHead}>
          <View style={[styles.groupIcon, { backgroundColor: section.bg }]}>
            <MaterialCommunityIcons name={section.icon} size={20} color={section.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupTitle}>
              {section.title} <Text style={{ color: section.color }}>({section.data.length})</Text>
            </Text>
            <Text style={styles.groupHint}>{section.hint}</Text>
          </View>
        </View>
      )}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? (
          <Text style={styles.none}>{q.isPending ? 'Memuat…' : section.status === 'ASSIGNED' ? 'Belum ada tugas baru.' : 'Tidak ada.'}</Text>
        ) : null
      }
      renderItem={({ item, section }) => <TaskCard s={item} color={section.color} />}
    />
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function TaskCard({ s, color }: { s: ShipmentRow; color: string }) {
  const total = s.shipment_items.reduce((t, l) => t + (l.base_qty ?? 0), 0);
  const items = s.shipment_items.slice(0, 3);
  const more = s.shipment_items.length - items.length;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/driver/tasks/${s.id}` as never)}
      style={({ pressed }) => [styles.card, { borderLeftColor: color }, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.place}>
        <MaterialCommunityIcons name="arrow-up-circle" size={20} color={colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={styles.placeLabel}>Ambil di</Text>
          <Text style={styles.placeName}>{s.from_location?.name}</Text>
        </View>
      </View>
      <View style={styles.connector} />
      <View style={styles.place}>
        <MaterialCommunityIcons name="map-marker" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.placeLabel}>Antar ke</Text>
          <Text style={styles.placeName}>{s.to_location?.name}</Text>
        </View>
      </View>

      <View style={styles.items}>
        {items.map((l) => (
          <View key={l.id} style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {l.item?.name}
            </Text>
            <Text style={styles.itemQty}>
              {formatQty(l.input_qty)} {l.unit_name}
            </Text>
          </View>
        ))}
        {more > 0 ? <Text style={styles.more}>+{more} barang lain</Text> : null}
        <Text style={styles.total}>Total {formatQty(total)} sachet</Text>
      </View>

      {s.status === 'ASSIGNED' ? (
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Buka & PICKUP</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onPrimary} />
        </View>
      ) : (
        <Text style={styles.foot}>
          {s.status === 'PICKED_UP'
            ? `Diambil ${s.picked_up_at ? formatDateTime(s.picked_up_at) : ''}`
            : `Diterima ${s.received_at ? formatDateTime(s.received_at) : ''}`}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { backgroundColor: colors.primary, borderRadius: radius.lg + 4, padding: spacing.xl, gap: 2, marginBottom: spacing.sm },
  heroGreet: { color: 'rgba(255,255,255,0.85)', fontSize: font.body },
  heroName: { color: colors.onPrimary, fontSize: font.title, fontWeight: '800' },
  heroErr: { color: colors.onPrimary },
  heroStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  heroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.md, padding: spacing.md },
  heroStatValue: { color: colors.onPrimary, fontSize: 22, fontWeight: '800' },
  heroStatLabel: { color: 'rgba(255,255,255,0.9)', fontSize: font.small },

  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  groupIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { fontSize: font.heading, fontWeight: '800', color: colors.text },
  groupHint: { fontSize: font.small, color: colors.textMuted },
  none: { fontSize: font.small, color: colors.textMuted, paddingVertical: spacing.sm, paddingLeft: 52 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  placeLabel: { fontSize: 11, color: colors.textMuted },
  placeName: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  connector: { width: 2, height: 10, backgroundColor: colors.border, marginLeft: 9 },
  items: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, gap: 4, marginTop: spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  itemName: { flex: 1, fontSize: font.body, color: colors.text },
  itemQty: { fontSize: font.body, fontWeight: '700', color: colors.text },
  more: { fontSize: font.small, color: colors.textMuted },
  total: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  cta: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  ctaText: { color: colors.onPrimary, fontSize: font.body, fontWeight: '800' },
  foot: { fontSize: font.small, color: colors.textMuted, marginTop: spacing.sm },
});
