import type { ShipmentRow } from '@sasana/shared-api';
import { formatDateTime, formatQty, SHIPMENT_STATUS_COLORS, SHIPMENT_STATUS_LABELS, type ShipmentStatus } from '@sasana/shared-constants';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '@/theme';

export function StatusPill({ status }: { status: ShipmentStatus }) {
  const c = SHIPMENT_STATUS_COLORS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{SHIPMENT_STATUS_LABELS[status]}</Text>
    </View>
  );
}

export function ShipmentCard({ s, onPress }: { s: ShipmentRow; onPress: () => void }) {
  const total = s.shipment_items.reduce((t, l) => t + (l.base_qty ?? 0), 0);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
      <View style={styles.row}>
        <Text style={styles.doc}>{s.doc_no}</Text>
        <StatusPill status={s.status} />
      </View>
      <Text style={styles.route}>
        {s.from_location?.name} → {s.to_location?.name}
      </Text>
      <Text style={styles.meta}>
        {s.shipment_items.length} barang · {formatQty(total)} · {s.driver?.full_name ?? 'Belum ada driver'}
      </Text>
      <Text style={styles.meta}>{formatDateTime(s.created_at)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  pillText: { fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  doc: { fontSize: font.small, fontWeight: '600', color: colors.textMuted, fontFamily: 'monospace' },
  route: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  meta: { fontSize: font.small, color: colors.textMuted },
});
