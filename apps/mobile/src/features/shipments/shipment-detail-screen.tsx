import type { ShipmentRow } from '@sasana/shared-api';
import { formatDateTime, formatQty } from '@sasana/shared-constants';
import { cancelShipmentSchema } from '@sasana/shared-validation';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { PickerField } from '@/components/ui/picker-field';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useMyContext } from '@/features/auth/use-my-context';
import { useOnline } from '@/hooks/use-online';
import { colors, font, radius, spacing } from '@/theme';
import { shipmentPermissions, useAssignDriver, useCancelShipment, useDrivers, usePickup, useReceive, useShipment } from './queries';
import { StatusPill } from './shipment-card';

type Sheet = 'pickup' | 'receive' | 'cancel' | null;

export function ShipmentDetailScreen({ id, created }: { id: string; created?: boolean }) {
  const { data: me } = useMyContext();
  const { data: s, error, isPending, refetch } = useShipment(id);
  const online = useOnline();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [done, setDone] = useState<string | null>(created ? 'Shipment dibuat. Stok belum berubah sampai pickup.' : null);

  const pickup = usePickup(id);
  const receive = useReceive(id);
  const cancel = useCancelShipment(id);

  if (isPending || !me) return <Screen><Text style={styles.muted}>Memuat…</Text></Screen>;
  if (error) {
    return (
      <Screen>
        <Text style={styles.error}>{error.message}</Text>
        <Button title="Coba lagi" variant="outline" onPress={() => refetch()} />
      </Screen>
    );
  }
  const can = shipmentPermissions(me, s);
  const active = sheet === 'pickup' ? pickup : sheet === 'receive' ? receive : cancel;

  function closeSheet() {
    setSheet(null);
    pickup.reset();
    receive.reset();
    cancel.reset();
    setReasonError(undefined);
  }

  function confirm() {
    if (sheet === 'pickup') {
      pickup.mutate(undefined, { onSuccess: () => (setDone(`Pickup tercatat. Stok ${s!.from_location?.name} berkurang.`), setSheet(null)) });
    } else if (sheet === 'receive') {
      receive.mutate(undefined, { onSuccess: () => (setDone(`Barang diterima. Stok ${s!.to_location?.name} bertambah.`), setSheet(null)) });
    } else if (sheet === 'cancel') {
      const parsed = cancelShipmentSchema.safeParse({ reason });
      if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message);
      cancel.mutate(parsed.data, { onSuccess: () => (setDone('Shipment dibatalkan.'), setSheet(null)) });
    }
  }

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={styles.doc}>{s.doc_no}</Text>
        <StatusPill status={s.status} />
      </View>
      <Text style={styles.route}>
        {s.from_location?.name}
        {'\n'}→ {s.to_location?.name}
      </Text>

      {done ? (
        <View style={styles.success}>
          <Text style={styles.successText}>✓ {done}</Text>
        </View>
      ) : null}
      {s.status === 'CANCELLED' ? (
        <View style={styles.cancelled}>
          <Text style={styles.cancelledText}>Dibatalkan: {s.cancel_reason}</Text>
        </View>
      ) : null}

      {/* Aksi utama di atas agar driver cukup satu ketuk */}
      {can.driverPickup ? (
        <Button title="PICKUP — barang sudah saya bawa" onPress={() => setSheet('pickup')} disabled={!online} />
      ) : null}
      {can.receive ? <Button title="Terima barang" onPress={() => setSheet('receive')} disabled={!online} /> : null}

      <Card>
        {s.shipment_items.map((l) => (
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
        <Row label="Driver" value={s.driver?.full_name ?? 'Belum ada'} />
        <Row label="Dibuat" value={formatDateTime(s.created_at)} />
        {s.picked_up_at ? (
          <Row label={s.picked_up_on_behalf ? 'Pickup (atas nama)' : 'Pickup'} value={formatDateTime(s.picked_up_at)} />
        ) : null}
        {s.received_at ? <Row label="Diterima" value={formatDateTime(s.received_at)} /> : null}
        {s.notes ? <Row label="Catatan" value={s.notes} /> : null}
      </Card>

      {can.assign ? <DriverPicker s={s} /> : null}
      {can.pickupOnBehalf ? (
        <Button title="Pickup atas nama driver" variant="outline" onPress={() => setSheet('pickup')} disabled={!online} />
      ) : null}
      {can.cancel ? (
        <Button
          title={s.status === 'PICKED_UP' ? 'Batal kirim (stok kembali)' : 'Batalkan shipment'}
          variant="danger"
          onPress={() => setSheet('cancel')}
          disabled={!online}
        />
      ) : null}

      <ConfirmSheet
        visible={sheet !== null}
        title={sheet === 'pickup' ? 'Konfirmasi pickup' : sheet === 'receive' ? 'Terima semua barang?' : 'Batalkan shipment?'}
        confirmLabel={sheet === 'pickup' ? 'Ya, pickup' : sheet === 'receive' ? 'Ya, terima' : 'Ya, batalkan'}
        pending={active.isPending}
        error={active.error}
        onCancel={closeSheet}
        onConfirm={confirm}
      >
        {sheet === 'pickup' ? (
          <Text style={styles.para}>
            Stok {s.from_location?.name} akan berkurang sesuai daftar barang.
            {can.pickupOnBehalf && !can.driverPickup ? ` Dicatat atas nama Anda untuk driver ${s.driver?.full_name ?? ''}.` : ''}
          </Text>
        ) : null}
        {sheet === 'receive' ? (
          <Text style={styles.para}>
            Stok {s.to_location?.name} akan bertambah. Pastikan jumlah fisik sudah dicek. Selisih/rusak dicatat lewat Penyesuaian.
          </Text>
        ) : null}
        {sheet === 'cancel' ? (
          <TextField label="Alasan" value={reason} onChangeText={setReason} error={reasonError} placeholder="Contoh: jadwal kirim diundur" />
        ) : null}
        {sheet === 'pickup' || sheet === 'receive'
          ? s.shipment_items.map((l) => (
              <View key={l.id} style={styles.confirmRow}>
                <Text style={styles.body}>{l.item?.name}</Text>
                <Text style={styles.confirmQty}>
                  {sheet === 'pickup' ? '−' : '+'}
                  {formatQty(l.base_qty ?? 0)} {l.item?.base_unit}
                </Text>
              </View>
            ))
          : null}
      </ConfirmSheet>
    </Screen>
  );
}

function DriverPicker({ s }: { s: ShipmentRow }) {
  const drivers = useDrivers();
  const assign = useAssignDriver(s.id);
  return (
    <Card>
      <PickerField
        label="Driver (bisa diganti sebelum pickup)"
        placeholder="Pilih driver"
        value={s.driver_id ?? ''}
        options={[{ value: '', label: '— Lepas driver —' }, ...(drivers.data ?? []).map((d) => ({ value: d.id, label: d.full_name }))]}
        onChange={(v) => {
          if (v !== (s.driver_id ?? '')) assign.mutate(v || null);
        }}
      />
      {assign.isPending ? <Text style={styles.muted}>Menyimpan…</Text> : null}
      {assign.error ? <Text style={styles.error}>{assign.error.message}</Text> : null}
    </Card>
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
  route: { fontSize: font.title, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  value: { flex: 1, textAlign: 'right', fontSize: font.body, color: colors.text },
  muted: { fontSize: font.small, color: colors.textMuted },
  body: { fontSize: font.body, color: colors.text, flex: 1 },
  para: { fontSize: font.body, color: colors.text },
  error: { fontSize: font.small, color: colors.danger },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  name: { fontSize: font.body, fontWeight: '600', color: colors.text },
  qty: { fontSize: font.number, fontWeight: '700', color: colors.text },
  success: { backgroundColor: '#E8F5E9', borderRadius: radius.md, padding: spacing.md },
  successText: { color: colors.success, fontSize: font.body, fontWeight: '600' },
  cancelled: { backgroundColor: colors.dangerSurface, borderRadius: radius.md, padding: spacing.md },
  cancelledText: { color: colors.danger, fontSize: font.body },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  confirmQty: { fontSize: font.body, fontWeight: '700', color: colors.text },
});
