import { canVoidDistribution } from '@sasana/shared-api';
import { formatDate, formatDateTime, formatQty } from '@sasana/shared-constants';
import { voidSchema } from '@sasana/shared-validation';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useMyContext } from '@/features/auth/use-my-context';
import { useOnline } from '@/hooks/use-online';
import { colors, font, radius, spacing } from '@/theme';
import { useDistribution, useVoidDistribution } from './queries';

export function DistributionDetailScreen({ id, created }: { id: string; created?: boolean }) {
  const { data: me } = useMyContext();
  const { data, error, isPending, refetch } = useDistribution(id);
  const online = useOnline();
  const voidMut = useVoidDistribution(id);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();

  if (isPending || !me) return <Screen><Text style={styles.muted}>Memuat…</Text></Screen>;
  if (error) {
    return (
      <Screen>
        <Text style={styles.error}>{error.message}</Text>
        <Button title="Coba lagi" variant="outline" onPress={() => refetch()} />
      </Screen>
    );
  }

  function confirmVoid() {
    const parsed = voidSchema.safeParse({ reason });
    if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message);
    voidMut.mutate(parsed.data, { onSuccess: () => setVoiding(false) });
  }

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={styles.doc}>{data.doc_no}</Text>
        <Text style={[styles.badge, data.voided_at ? styles.badgeVoid : null]}>{data.voided_at ? 'VOID' : 'Tercatat'}</Text>
      </View>
      <Text style={styles.title}>{data.buyer_name}</Text>
      <Text style={styles.muted}>
        dari {data.location?.name} · {formatDate(data.transaction_date)}
      </Text>

      {created && !data.voided_at ? (
        <View style={styles.success}>
          <Text style={styles.successText}>✓ Penjualan tersimpan. Stok {data.location?.name} sudah berkurang.</Text>
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
        {data.distribution_items.map((l) => (
          <View key={l.id} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{l.item?.name}</Text>
              <Text style={styles.muted}>
                {formatQty(l.input_qty)} {l.unit_name}
                {l.factor > 1 ? ` (× ${formatQty(l.factor)})` : ''}
              </Text>
            </View>
            <Text style={styles.qty}>
              {formatQty(l.base_qty ?? 0)} <Text style={styles.muted}>{l.item?.base_unit}</Text>
            </Text>
          </View>
        ))}
      </Card>
      <Card>
        <Row label="Dicatat" value={`${formatDateTime(data.created_at)}${data.creator?.full_name ? `\n${data.creator.full_name}` : ''}`} />
        {data.notes ? <Row label="Catatan" value={data.notes} /> : null}
      </Card>

      {canVoidDistribution(me, data.location_id) && !data.voided_at ? (
        <Button title="Batalkan penjualan (void)" variant="danger" disabled={!online} onPress={() => setVoiding(true)} />
      ) : null}

      <ConfirmSheet
        visible={voiding}
        title="Batalkan penjualan ini?"
        confirmLabel="Ya, void"
        pending={voidMut.isPending}
        error={voidMut.error}
        onCancel={() => {
          setVoiding(false);
          voidMut.reset();
          setReasonError(undefined);
        }}
        onConfirm={confirmVoid}
      >
        <Text style={styles.para}>Semua produk di dokumen ini dikembalikan ke stok {data.location?.name}.</Text>
        <TextField label="Alasan" value={reason} onChangeText={setReason} error={reasonError} placeholder="Contoh: salah buyer" />
      </ConfirmSheet>
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
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doc: { fontSize: font.body, fontWeight: '600', color: colors.textMuted, fontFamily: 'monospace' },
  badge: { fontSize: font.small, fontWeight: '700', color: colors.success },
  badgeVoid: { color: colors.danger },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  value: { flex: 1, textAlign: 'right', fontSize: font.body, color: colors.text },
  muted: { fontSize: font.small, color: colors.textMuted },
  para: { fontSize: font.body, color: colors.text },
  error: { fontSize: font.small, color: colors.danger },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  name: { fontSize: font.body, fontWeight: '600', color: colors.text },
  qty: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  success: { backgroundColor: '#E8F5E9', borderRadius: radius.md, padding: spacing.md },
  successText: { color: colors.success, fontSize: font.body, fontWeight: '600' },
  voided: { backgroundColor: colors.dangerSurface, borderRadius: radius.md, padding: spacing.md },
  voidedText: { color: colors.danger, fontSize: font.body },
});
