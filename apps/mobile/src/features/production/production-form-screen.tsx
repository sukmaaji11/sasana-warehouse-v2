import { zodResolver } from '@hookform/resolvers/zod';
import { createProduction } from '@sasana/shared-api';
import { formatQty, todayWib } from '@sasana/shared-constants';
import { productionSchema, type ProductionInput, type ProductionValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chips } from '@/components/ui/chips';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { DateChips } from '@/components/ui/date-chips';
import { PickerField } from '@/components/ui/picker-field';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useMyContext } from '@/features/auth/use-my-context';
import { newIdempotencyKey, useItems, useProductLocations, useStockLevels } from '@/features/stock/queries';
import { useOnline } from '@/hooks/use-online';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/theme';
import { PRODUCTION_INVALIDATE } from './queries';

const digits = (t: string) => t.replace(/[^0-9]/g, '');

export function ProductionFormScreen({ basePath }: { basePath: string }) {
  const { data: me } = useMyContext();
  const qc = useQueryClient();
  const online = useOnline();
  const items = useItems();
  const productLocations = useProductLocations();
  const stock = useStockLevels();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState<ProductionValues | null>(null);
  const factories = (me?.locations ?? []).filter((l) => l.type === 'FACTORY');

  const { control, handleSubmit, setValue, formState } = useForm<ProductionInput, unknown, ProductionValues>({
    resolver: zodResolver(productionSchema),
    defaultValues: {
      location_id: factories.length === 1 ? factories[0]!.id : '',
      finished_item_id: '',
      unit_id: '',
      qty_good: '',
      qty_reject: '0',
      production_date: todayWib(),
      notes: '',
    },
  });
  const v = useWatch({ control });

  const byId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  // Q8: hanya produk yang terdaftar di pabrik terpilih.
  const products = useMemo(() => {
    const allowed = new Set((productLocations.data ?? []).filter((p) => p.location_id === v.location_id).map((p) => p.finished_item_id));
    return (items.data ?? []).filter((i) => i.type === 'FINISHED_GOOD' && i.is_active && allowed.has(i.id));
  }, [items.data, productLocations.data, v.location_id]);

  const product = byId.get(v.finished_item_id ?? '');
  const packaging = product?.packaging ? byId.get(product.packaging.packaging_item_id) : undefined;
  const unit = product?.item_units.find((u) => u.id === v.unit_id);
  const available = (stock.data ?? []).find((s) => s.item_id === packaging?.id && s.location_id === v.location_id)?.quantity ?? 0;
  const good = (Number(v.qty_good) || 0) * (unit?.factor ?? 1);
  const reject = Number(v.qty_reject) || 0;
  const need = good + reject;
  const factoryName = factories.find((f) => f.id === v.location_id)?.name ?? 'pabrik';

  const submit = useMutation({
    mutationFn: (values: ProductionValues) => createProduction(supabase, idempotencyKey, values),
    onSuccess: async (res) => {
      await Promise.all(PRODUCTION_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey })));
      setConfirming(null);
      router.replace(`${basePath}/${res.id}?created=1` as never);
    },
  });
  const errors = formState.errors;

  if (factories.length === 0) {
    return (
      <Screen>
        <Text style={styles.error}>Anda belum ditugaskan ke pabrik. Hubungi Super Owner.</Text>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen subtitle="Kemasan terpakai = good + reject">
        <Card>
          {factories.length > 1 ? (
            <Controller
              control={control}
              name="location_id"
              render={({ field }) => (
                <PickerField
                  label="Pabrik"
                  placeholder="Pilih pabrik"
                  value={field.value}
                  error={errors.location_id?.message}
                  options={factories.map((l) => ({ value: l.id, label: l.name }))}
                  onChange={(id) => {
                    field.onChange(id);
                    setValue('finished_item_id', '');
                    setValue('unit_id', '');
                  }}
                />
              )}
            />
          ) : (
            <Text style={styles.factory}>{factoryName}</Text>
          )}
          <Controller
            control={control}
            name="finished_item_id"
            render={({ field }) => (
              <PickerField
                label="Produk"
                placeholder={v.location_id && products.length === 0 ? 'Belum ada produk terdaftar' : 'Pilih produk'}
                value={field.value}
                error={errors.finished_item_id?.message}
                options={products.map((p) => ({ value: p.id, label: p.name, hint: p.sku }))}
                onChange={(id) => {
                  field.onChange(id);
                  setValue('unit_id', byId.get(id)?.item_units.find((u) => u.is_base)?.id ?? '');
                }}
              />
            )}
          />
        </Card>

        {product ? (
          <Card>
            <Controller
              control={control}
              name="unit_id"
              render={({ field }) => (
                <Chips
                  value={field.value}
                  onChange={field.onChange}
                  accessibilityLabel="Satuan good"
                  options={product.item_units.filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.unit_name }))}
                />
              )}
            />
            <Controller
              control={control}
              name="qty_good"
              render={({ field }) => (
                <TextField
                  label={`Good (${unit?.unit_name ?? 'satuan'})`}
                  keyboardType="number-pad"
                  value={String(field.value ?? '')}
                  onChangeText={(t) => field.onChange(digits(t))}
                  error={errors.qty_good?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="qty_reject"
              render={({ field }) => (
                <TextField
                  label={`Reject (${packaging?.base_unit ?? 'sachet'})`}
                  keyboardType="number-pad"
                  value={String(field.value ?? '')}
                  onChangeText={(t) => field.onChange(digits(t))}
                  error={errors.qty_reject?.message}
                />
              )}
            />
            {packaging ? (
              <View style={[styles.info, need > available && styles.infoDanger]}>
                <Text style={[styles.infoText, need > available && { color: colors.danger }]}>
                  {packaging.name}: terpakai {formatQty(need)} {packaging.base_unit} · stok {formatQty(available)}
                  {need > available ? ' — kurang' : ''}
                </Text>
              </View>
            ) : (
              <Text style={styles.error}>Kemasan produk ini belum diatur. Hubungi Super Owner.</Text>
            )}
          </Card>
        ) : null}

        <Controller
          control={control}
          name="production_date"
          render={({ field }) => <DateChips label="Tanggal produksi" value={field.value} onChange={field.onChange} />}
        />
        {errors.production_date ? <Text style={styles.error}>{errors.production_date.message}</Text> : null}
        <Controller
          control={control}
          name="notes"
          render={({ field }) => <TextField label="Catatan (opsional)" value={field.value} onChangeText={field.onChange} />}
        />
        <Button
          title={online ? 'Lanjut konfirmasi' : 'Menunggu koneksi…'}
          disabled={!online || !packaging}
          onPress={() => void handleSubmit(setConfirming)()}
        />
      </Screen>

      <ConfirmSheet
        visible={confirming !== null}
        title="Simpan produksi?"
        confirmLabel="Ya, simpan"
        pending={submit.isPending}
        error={submit.error}
        onCancel={() => {
          setConfirming(null);
          submit.reset();
        }}
        onConfirm={() => confirming && submit.mutate(confirming)}
      >
        <Text style={styles.para}>Stok {factoryName} akan berubah:</Text>
        <View style={styles.confirmRow}>
          <Text style={styles.body}>{packaging?.name}</Text>
          <Text style={styles.confirmQty}>
            −{formatQty(need)} {packaging?.base_unit}
          </Text>
        </View>
        {good > 0 ? (
          <View style={styles.confirmRow}>
            <Text style={styles.body}>{product?.name}</Text>
            <Text style={styles.confirmQty}>
              +{formatQty(good)} {product?.base_unit}
            </Text>
          </View>
        ) : null}
      </ConfirmSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  factory: { fontSize: font.body, fontWeight: '700', color: colors.text },
  info: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  infoDanger: { borderColor: colors.danger, backgroundColor: colors.dangerSurface },
  infoText: { fontSize: font.small, color: colors.textMuted },
  error: { fontSize: font.small, color: colors.danger },
  para: { fontSize: font.body, color: colors.text },
  body: { fontSize: font.body, color: colors.text, flex: 1 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  confirmQty: { fontSize: font.body, fontWeight: '700', color: colors.text },
});
