import { zodResolver } from '@hookform/resolvers/zod';
import { createShipment } from '@sasana/shared-api';
import { formatQty, ITEM_TYPE_LABELS, SHIPPABLE_ITEM_TYPES } from '@sasana/shared-constants';
import { shipmentSchema, type ShipmentInput, type ShipmentValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chips } from '@/components/ui/chips';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { PickerField } from '@/components/ui/picker-field';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useMyContext } from '@/features/auth/use-my-context';
import { newIdempotencyKey, useItems, useStockLevels } from '@/features/stock/queries';
import { useOnline } from '@/hooks/use-online';
import { supabase } from '@/lib/supabase';
import { colors, font, spacing } from '@/theme';
import { SHIPMENT_INVALIDATE, useDrivers, useLocations } from './queries';

export function ShipmentFormScreen({ basePath }: { basePath: string }) {
  const { data: me } = useMyContext();
  const qc = useQueryClient();
  const online = useOnline();
  const items = useItems();
  const locations = useLocations();
  const drivers = useDrivers();
  const stock = useStockLevels();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState<ShipmentValues | null>(null);
  const origins = me?.locations ?? [];

  const { control, handleSubmit, setValue, formState } = useForm<ShipmentInput, unknown, ShipmentValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      from_location_id: origins.length === 1 ? origins[0]!.id : '',
      to_location_id: '',
      driver_id: '',
      notes: '',
      items: [{ item_id: '', unit_id: '', qty: '' }],
    },
  });
  const lines = useFieldArray({ control, name: 'items' });
  const watched = useWatch({ control });
  const fromId = watched.from_location_id ?? '';

  // Jenis barang mengikuti lokasi asal: gudang kemasan → kemasan saja, gudang penjualan → produk jadi saja.
  const fromType = origins.find((l) => l.id === fromId)?.type;
  const active = useMemo(() => {
    const allowed: readonly string[] = fromType ? SHIPPABLE_ITEM_TYPES[fromType] : ['PACKAGING', 'FINISHED_GOOD'];
    return (items.data ?? []).filter((i) => i.is_active && allowed.includes(i.type));
  }, [items.data, fromType]);
  const byId = useMemo(() => new Map(active.map((i) => [i.id, i])), [active]);
  const available = (itemId: string) =>
    (stock.data ?? []).find((s) => s.location_id === fromId && s.item_id === itemId)?.quantity ?? 0;
  const locName = (id: string) => (locations.data ?? []).find((l) => l.id === id)?.name ?? '';

  const submit = useMutation({
    mutationFn: (v: ShipmentValues) => createShipment(supabase, idempotencyKey, v),
    onSuccess: async (res) => {
      await Promise.all(SHIPMENT_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey })));
      setConfirming(null);
      router.replace(`${basePath}/${res.id}?created=1` as never);
    },
  });
  const errors = formState.errors;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen subtitle="Stok asal baru berkurang saat pickup">
        <Card>
          <Controller
            control={control}
            name="from_location_id"
            render={({ field }) => (
              <PickerField
                label="Dari"
                placeholder="Lokasi asal"
                value={field.value}
                onChange={field.onChange}
                error={errors.from_location_id?.message}
                options={origins.map((l) => ({ value: l.id, label: l.name }))}
              />
            )}
          />
          <Controller
            control={control}
            name="to_location_id"
            render={({ field }) => (
              <PickerField
                label="Ke"
                placeholder="Lokasi tujuan"
                value={field.value}
                onChange={field.onChange}
                error={errors.to_location_id?.message}
                options={(locations.data ?? []).filter((l) => l.is_active && l.id !== fromId).map((l) => ({ value: l.id, label: l.name }))}
              />
            )}
          />
          {fromType && fromType !== 'FACTORY' ? (
            <Text style={styles.hint}>
              {fromType === 'WAREHOUSE' ? 'Dari gudang kemasan hanya bisa mengirim kemasan.' : 'Dari gudang penjualan hanya bisa mengirim produk jadi.'}
            </Text>
          ) : null}
          <Controller
            control={control}
            name="driver_id"
            render={({ field }) => (
              <PickerField
                label="Driver (opsional)"
                placeholder="Tugaskan nanti"
                value={field.value ?? ''}
                onChange={field.onChange}
                options={[{ value: '', label: '— Tugaskan nanti —' }, ...(drivers.data ?? []).map((d) => ({ value: d.id, label: d.full_name }))]}
              />
            )}
          />
        </Card>

        {lines.fields.map((f, idx) => {
          const line = watched.items?.[idx];
          const item = byId.get(line?.item_id ?? '');
          const unit = item?.item_units.find((u) => u.id === line?.unit_id);
          const need = unit && line?.qty ? Number(line.qty) * unit.factor : 0;
          const avail = item && fromId ? available(item.id) : null;
          return (
            <Card key={f.id}>
              <View style={styles.lineHeader}>
                <Text style={styles.lineTitle}>Barang {idx + 1}</Text>
                {lines.fields.length > 1 ? (
                  <Pressable accessibilityRole="button" onPress={() => lines.remove(idx)} hitSlop={10}>
                    <Text style={styles.remove}>Hapus</Text>
                  </Pressable>
                ) : null}
              </View>
              <Controller
                control={control}
                name={`items.${idx}.item_id`}
                render={({ field }) => (
                  <PickerField
                    label="Barang"
                    placeholder="Pilih barang"
                    value={field.value}
                    error={errors.items?.[idx]?.item_id?.message}
                    options={active.map((i) => ({ value: i.id, label: i.name, hint: `${i.sku} · ${ITEM_TYPE_LABELS[i.type]}` }))}
                    onChange={(v) => {
                      field.onChange(v);
                      setValue(`items.${idx}.unit_id`, byId.get(v)?.item_units.find((u) => u.is_base)?.id ?? '');
                    }}
                  />
                )}
              />
              {item ? (
                <Controller
                  control={control}
                  name={`items.${idx}.unit_id`}
                  render={({ field }) => (
                    <Chips
                      value={field.value}
                      onChange={field.onChange}
                      options={item.item_units.filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.unit_name }))}
                    />
                  )}
                />
              ) : null}
              <Controller
                control={control}
                name={`items.${idx}.qty`}
                render={({ field }) => (
                  <TextField
                    label={`Jumlah (${unit?.unit_name ?? 'satuan'})`}
                    keyboardType="number-pad"
                    value={String(field.value ?? '')}
                    onChangeText={(t) => field.onChange(t.replace(/[^0-9]/g, ''))}
                    error={errors.items?.[idx]?.qty?.message}
                  />
                )}
              />
              {item && avail !== null ? (
                <Text style={[styles.hint, need > avail && { color: colors.danger }]}>
                  = {formatQty(need)} {item.base_unit} · stok asal {formatQty(avail)}
                  {need > avail ? ' — kurang' : ''}
                </Text>
              ) : null}
            </Card>
          );
        })}
        {errors.items?.root?.message || errors.items?.message ? (
          <Text style={styles.error}>{errors.items?.root?.message ?? errors.items?.message}</Text>
        ) : null}
        <Button title="+ Tambah barang" variant="outline" onPress={() => lines.append({ item_id: '', unit_id: '', qty: '' })} />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => <TextField label="Catatan (opsional)" value={field.value} onChangeText={field.onChange} />}
        />
        <Button title={online ? 'Lanjut konfirmasi' : 'Menunggu koneksi…'} disabled={!online} onPress={() => void handleSubmit(setConfirming)()} />
      </Screen>

      <ConfirmSheet
        visible={confirming !== null}
        title="Buat pengiriman?"
        confirmLabel="Ya, buat"
        pending={submit.isPending}
        error={submit.error}
        onCancel={() => {
          setConfirming(null);
          submit.reset();
        }}
        onConfirm={() => confirming && submit.mutate(confirming)}
      >
        {confirming ? (
          <Text style={styles.para}>
            {locName(confirming.from_location_id)} → {locName(confirming.to_location_id)}
          </Text>
        ) : null}
        {confirming?.items.map((l) => {
          const it = byId.get(l.item_id);
          const u = it?.item_units.find((x) => x.id === l.unit_id);
          return (
            <View key={l.item_id} style={styles.confirmRow}>
              <Text style={styles.body}>{it?.name}</Text>
              <Text style={styles.confirmQty}>
                {formatQty(l.qty)} {u?.unit_name}
              </Text>
            </View>
          );
        })}
      </ConfirmSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  lineTitle: { fontSize: font.small, fontWeight: '700', color: colors.textMuted },
  remove: { fontSize: font.small, color: colors.danger, fontWeight: '600' },
  hint: { fontSize: font.small, color: colors.textMuted },
  error: { fontSize: font.small, color: colors.danger },
  body: { fontSize: font.body, color: colors.text, flex: 1 },
  para: { fontSize: font.body, color: colors.text, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  confirmQty: { fontSize: font.body, fontWeight: '700', color: colors.text },
});
