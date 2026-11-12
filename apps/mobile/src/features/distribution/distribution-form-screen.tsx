import { zodResolver } from '@hookform/resolvers/zod';
import { createDistribution, distributionOrigins } from '@sasana/shared-api';
import { formatQty, todayWib } from '@sasana/shared-constants';
import { distributionSchema, type DistributionInput, type DistributionValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chips } from '@/components/ui/chips';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { DateChips } from '@/components/ui/date-chips';
import { PickerField } from '@/components/ui/picker-field';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useMyContext } from '@/features/auth/use-my-context';
import { newIdempotencyKey, useItems, useStockLevels } from '@/features/stock/queries';
import { useOnline } from '@/hooks/use-online';
import { supabase } from '@/lib/supabase';
import { colors, font, spacing } from '@/theme';
import { DISTRIBUTION_INVALIDATE, useBuyers } from './queries';

export function DistributionFormScreen({ basePath }: { basePath: string }) {
  const { data: me } = useMyContext();
  const qc = useQueryClient();
  const online = useOnline();
  const items = useItems();
  const buyers = useBuyers();
  const stock = useStockLevels();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState<DistributionValues | null>(null);
  const origins = me ? distributionOrigins(me) : [];

  const { control, handleSubmit, setValue, formState } = useForm<DistributionInput, unknown, DistributionValues>({
    resolver: zodResolver(distributionSchema),
    defaultValues: {
      location_id: origins.length === 1 ? origins[0]!.id : '',
      buyer_id: '',
      transaction_date: todayWib(),
      notes: '',
      items: [{ item_id: '', unit_id: '', qty: '' }],
    },
  });
  const lines = useFieldArray({ control, name: 'items' });
  const watched = useWatch({ control });
  const fromId = watched.location_id ?? '';

  const products = useMemo(() => (items.data ?? []).filter((i) => i.type === 'FINISHED_GOOD' && i.is_active), [items.data]);
  const byId = useMemo(() => new Map(products.map((i) => [i.id, i])), [products]);
  const available = (itemId: string) =>
    (stock.data ?? []).find((s) => s.location_id === fromId && s.item_id === itemId)?.quantity ?? 0;
  // Produk yang ada stoknya di lokasi asal tampil lebih dulu.
  const sorted = [...products].sort((a, b) => Number(available(b.id) > 0) - Number(available(a.id) > 0));
  const activeBuyers = (buyers.data ?? []).filter((b) => b.is_active);
  const locName = (id: string) => origins.find((l) => l.id === id)?.name ?? '';

  const submit = useMutation({
    mutationFn: (v: DistributionValues) => createDistribution(supabase, idempotencyKey, v),
    onSuccess: async (res) => {
      await Promise.all(DISTRIBUTION_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey })));
      setConfirming(null);
      router.replace(`${basePath}/${res.id}?created=1` as never);
    },
  });
  const errors = formState.errors;

  if (origins.length === 0) {
    return (
      <Screen>
        <Text style={styles.error}>Anda tidak ditugaskan di pabrik atau Gudang Penjualan.</Text>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen subtitle="Stok asal langsung berkurang saat disimpan">
        <Card>
          {origins.length > 1 ? (
            <Controller
              control={control}
              name="location_id"
              render={({ field }) => (
                <PickerField
                  label="Dari"
                  placeholder="Lokasi asal"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.location_id?.message}
                  options={origins.map((l) => ({ value: l.id, label: l.name }))}
                />
              )}
            />
          ) : (
            <Text style={styles.origin}>Dari: {origins[0]!.name}</Text>
          )}
          <Controller
            control={control}
            name="buyer_id"
            render={({ field }) => (
              <PickerField
                label="Buyer"
                placeholder="Pilih buyer"
                value={field.value}
                onChange={field.onChange}
                error={errors.buyer_id?.message}
                options={activeBuyers.map((b) => ({ value: b.id, label: b.name, hint: b.address ?? undefined }))}
              />
            )}
          />
          <Text style={styles.hint}>Pemakaian sendiri (rawatan ayam): pilih “Konsumsi internal”.</Text>
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
                <Text style={styles.lineTitle}>Produk {idx + 1}</Text>
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
                    label="Produk"
                    placeholder="Pilih produk"
                    value={field.value}
                    error={errors.items?.[idx]?.item_id?.message}
                    options={sorted.map((i) => ({ value: i.id, label: i.name, hint: `${i.sku} · stok ${formatQty(available(i.id))}` }))}
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
                  = {formatQty(need)} {item.base_unit} · stok {formatQty(avail)}
                  {need > avail ? ' — kurang' : ''}
                </Text>
              ) : null}
            </Card>
          );
        })}
        {errors.items?.root?.message || errors.items?.message ? (
          <Text style={styles.error}>{errors.items?.root?.message ?? errors.items?.message}</Text>
        ) : null}
        <Button title="+ Tambah produk" variant="outline" onPress={() => lines.append({ item_id: '', unit_id: '', qty: '' })} />
        <Controller
          control={control}
          name="transaction_date"
          render={({ field }) => <DateChips label="Tanggal" value={field.value} onChange={field.onChange} />}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => <TextField label="Catatan (opsional)" value={field.value} onChangeText={field.onChange} />}
        />
        <Button title={online ? 'Lanjut konfirmasi' : 'Menunggu koneksi…'} disabled={!online} onPress={() => void handleSubmit(setConfirming)()} />
      </Screen>

      <ConfirmSheet
        visible={confirming !== null}
        title="Simpan distribusi?"
        confirmLabel="Ya, simpan"
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
            {locName(confirming.location_id)} → {activeBuyers.find((b) => b.id === confirming.buyer_id)?.name}
          </Text>
        ) : null}
        {confirming?.items.map((l) => {
          const it = byId.get(l.item_id);
          const u = it?.item_units.find((x) => x.id === l.unit_id);
          return (
            <View key={l.item_id} style={styles.confirmRow}>
              <Text style={styles.body}>{it?.name}</Text>
              <Text style={styles.confirmQty}>
                −{formatQty(l.qty)} {u?.unit_name}
                {u && !u.is_base ? ` (${formatQty(l.qty * u.factor)} ${it?.base_unit})` : ''}
              </Text>
            </View>
          );
        })}
      </ConfirmSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  origin: { fontSize: font.body, fontWeight: '700', color: colors.text },
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
