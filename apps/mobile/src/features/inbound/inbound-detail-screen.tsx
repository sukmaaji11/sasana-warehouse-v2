import { formatDate, formatDateTime, formatQty } from '@sasana/shared-constants';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { useInbound } from '@/features/stock/queries';
import { colors, font, radius, spacing } from '@/theme';

export function InboundDetailScreen({ id, created }: { id: string; created?: boolean }) {
  const { data, error, isPending, refetch } = useInbound(id);

  if (isPending) return <Screen title="Inbound"><Text style={styles.muted}>Memuat…</Text></Screen>;
  if (error) {
    return (
      <Screen title="Inbound">
        <Text style={styles.error}>{error.message}</Text>
        <Button title="Coba lagi" variant="outline" onPress={() => refetch()} />
      </Screen>
    );
  }

  return (
    <Screen title={data.doc_no} subtitle={data.voided_at ? 'VOID' : 'Tercatat'}>
      {created ? (
        <View style={styles.success}>
          <Text style={styles.successText}>✓ Inbound tersimpan. Stok gudang pusat sudah bertambah.</Text>
        </View>
      ) : null}
      {data.voided_at ? (
        <View style={styles.voided}>
          <Text style={styles.voidedText}>
            Di-void {formatDateTime(data.voided_at)} — {data.void_reason}
          </Text>
        </View>
      ) : null}
      <Card>
        <Row label="Vendor" value={data.vendor?.name ?? '–'} />
        <Row label="Tanggal terima" value={formatDate(data.transaction_date)} />
        <Row label="Dicatat" value={`${formatDateTime(data.created_at)}\n${data.creator?.full_name ?? ''}`} />
        {data.notes ? <Row label="Catatan" value={data.notes} /> : null}
      </Card>
      <Card>
        {data.inbound_items.map((l) => (
          <View key={l.id} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{l.item?.name}</Text>
              <Text style={styles.muted}>{l.item?.sku}</Text>
            </View>
            <Text style={styles.qty}>
              {formatQty(l.base_qty ?? 0)} <Text style={styles.muted}>{l.item?.base_unit}</Text>
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  value: { flex: 1, textAlign: 'right', fontSize: font.body, color: colors.text },
  muted: { fontSize: font.small, color: colors.textMuted },
  error: { fontSize: font.body, color: colors.danger },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  name: { fontSize: font.body, fontWeight: '600', color: colors.text },
  qty: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  success: { backgroundColor: '#E8F5E9', borderRadius: radius.md, padding: spacing.md },
  successText: { color: colors.success, fontSize: font.body, fontWeight: '600' },
  voided: { backgroundColor: colors.dangerSurface, borderRadius: radius.md, padding: spacing.md },
  voidedText: { color: colors.danger, fontSize: font.body },
});
