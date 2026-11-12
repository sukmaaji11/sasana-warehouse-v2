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
import { productionPermissions, useProduction, useVoidProduction } from './queries';

export function ProductionDetailScreen({ id, created }: { id: string; created?: boolean }) {
  const { data: me } = useMyContext();
  const { data, error, isPending, refetch } = useProduction(id);
  const online = useOnline();
  const voidMut = useVoidProduction(id);
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
  const can = productionPermissions(me);
  const pkgUnit = data.packaging?.base_unit ?? '';

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
      <Text style={styles.title}>{data.product?.name}</Text>
      <Text style={styles.muted}>
        {data.location?.name} · {formatDate(data.production_date)}
      </Text>

      {created && !data.voided_at ? (
        <View style={styles.success}>
          <Text style={styles.successText}>✓ Produksi tersimpan. Stok pabrik sudah diperbarui.</Text>
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
        <Row label="Good" value={`${formatQty(data.qty_good ?? 0)} ${data.product?.base_unit ?? ''}`} big />
        {data.factor > 1 ? <Row label="" value={`${formatQty(data.input_qty_good)} ${data.unit_name}`} /> : null}
        <Row label="Reject" value={`${formatQty(data.qty_reject)} ${pkgUnit}`} big />
        <Row label="Kemasan terpakai" value={`${formatQty(data.packaging_consumed ?? 0)} ${pkgUnit}`} />
        <Row label="Kemasan" value={data.packaging?.name ?? '–'} />
      </Card>
      <Card>
        <Row label="Dicatat" value={`${formatDateTime(data.created_at)}${data.creator?.full_name ? `\n${data.creator.full_name}` : ''}`} />
        {data.notes ? <Row label="Catatan" value={data.notes} /> : null}
      </Card>

      {can.void && !data.voided_at ? (
        <Button title="Void produksi" variant="danger" disabled={!online} onPress={() => setVoiding(true)} />
      ) : null}

      <ConfirmSheet
        visible={voiding}
        title="Void produksi?"
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
        <Text style={styles.para}>
          Kemasan kembali +{formatQty(data.packaging_consumed ?? 0)} {pkgUnit}, produk jadi −{formatQty(data.qty_good ?? 0)}. Ditolak jika produknya sudah terpakai.
        </Text>
        <TextField label="Alasan" value={reason} onChangeText={setReason} error={reasonError} placeholder="Contoh: salah input jumlah" />
      </ConfirmSheet>
    </Screen>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.value, big && styles.big]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doc: { fontSize: font.body, fontWeight: '600', color: colors.textMuted, fontFamily: 'monospace' },
  badge: { fontSize: font.small, fontWeight: '700', color: colors.success },
  badgeVoid: { color: colors.danger },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  value: { flex: 1, textAlign: 'right', fontSize: font.body, color: colors.text },
  big: { fontSize: font.heading, fontWeight: '700' },
  muted: { fontSize: font.small, color: colors.textMuted },
  para: { fontSize: font.body, color: colors.text },
  error: { fontSize: font.small, color: colors.danger },
  success: { backgroundColor: '#E8F5E9', borderRadius: radius.md, padding: spacing.md },
  successText: { color: colors.success, fontSize: font.body, fontWeight: '600' },
  voided: { backgroundColor: colors.dangerSurface, borderRadius: radius.md, padding: spacing.md },
  voidedText: { color: colors.danger, fontSize: font.body },
});
