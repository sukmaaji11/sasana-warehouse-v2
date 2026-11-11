import { zodResolver } from '@hookform/resolvers/zod';
import { createInbound } from '@sasana/shared-api';
import { formatQty, todayWib } from '@sasana/shared-constants';
import { inboundSchema, type InboundInput, type InboundValues } from '@sasana/shared-validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { DateChips } from '@/components/ui/date-chips';
import { PickerField } from '@/components/ui/picker-field';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useOnline } from '@/hooks/use-online';
import { newIdempotencyKey, STOCK_INVALIDATE, useItems, useVendors } from '@/features/stock/queries';
import { supabase } from '@/lib/supabase';
import { colors, font, spacing } from '@/theme';

export function InboundFormScreen({ basePath }: { basePath: string }) {
  const qc = useQueryClient();
  const online = useOnline();
  const items = useItems();
  const vendors = useVendors();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState<InboundValues | null>(null);

  const { control, handleSubmit, setValue, formState } = useForm<InboundInput, unknown, InboundValues>({
    resolver: zodResolver(inboundSchema),
    defaultValues: { vendor_id: '', transaction_date: todayWib(), notes: '', items: [{ item_id: '', unit_id: '', qty: '' }] },
  });
  const lines = useFieldArray({ control, name: 'items' });
  const watched = useWatch({ control, name: 'items' });

  const packaging = useMemo(() => (items.data ?? []).filter((i) => i.type === 'PACKAGING' && i.is_active), [items.data]);
  const byId = useMemo(() => new Map(packaging.map((i) => [i.id, i])), [packaging]);

  const submit = useMutation({
    mutationFn: (v: InboundValues) => createInbound(supabase, idempotencyKey, v),
    onSuccess: async (res) => {
      await Promise.all(STOCK_INVALIDATE.map((queryKey) => qc.invalidateQueries({ queryKey })));
      setConfirming(null);
      router.replace(`${basePath}/${res.id}?created=1` as never);
    },
  });

  const errors = formState.errors;
  const loading = items.isPending || vendors.isPending;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen subtitle="Packaging dari vendor → gudang pusat (input per satuan dasar)">
        {loading ? <Text style={styles.muted}>Memuat data…</Text> : null}
        <Card>
          <Controller
            control={control}
            name="vendor_id"
            render={({ field }) => (
              <PickerField
                label="Vendor"
                placeholder="Pilih vendor"
                value={field.value}
                onChange={field.onChange}
                error={errors.vendor_id?.message}
                options={(vendors.data ?? []).filter((v) => v.is_active).map((v) => ({ value: v.id, label: v.name }))}
              />
            )}
          />
          <Controller
            control={control}
            name="transaction_date"
            render={({ field }) => <DateChips label="Tanggal terima" value={field.value} onChange={field.onChange} />}
          />
          {errors.transaction_date ? <Text style={styles.error}>{errors.transaction_date.message}</Text> : null}
        </Card>

        {lines.fields.map((f, idx) => {
          const item = byId.get(watched?.[idx]?.item_id ?? '');
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
                    label="Packaging"
                    placeholder="Pilih packaging"
                    value={field.value}
                    error={errors.items?.[idx]?.item_id?.message}
                    options={packaging.map((p) => ({ value: p.id, label: p.name, hint: p.sku }))}
                    onChange={(v) => {
                      field.onChange(v);
                      // Q6: packaging hanya satuan dasar → otomatis.
                      setValue(`items.${idx}.unit_id`, byId.get(v)?.item_units.find((u) => u.is_base)?.id ?? '');
                    }}
                  />
                )}
              />
              <Controller
                control={control}
                name={`items.${idx}.qty`}
                render={({ field }) => (
                  <TextField
                    label={`Jumlah (${item?.base_unit ?? 'satuan dasar'})`}
                    keyboardType="number-pad"
                    value={String(field.value ?? '')}
                    onChangeText={(t) => field.onChange(t.replace(/[^0-9]/g, ''))}
                    error={errors.items?.[idx]?.qty?.message}
                    style={styles.qtyInput}
                  />
                )}
              />
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
          render={({ field }) => (
            <TextField label="Catatan (opsional)" value={field.value} onChangeText={field.onChange} placeholder="No. surat jalan vendor" />
          )}
        />

        <Button
          title={online ? 'Lanjut konfirmasi' : 'Menunggu koneksi…'}
          disabled={!online || loading}
          onPress={() => void handleSubmit(setConfirming)()}
        />
      </Screen>

      <ConfirmSheet
        visible={confirming !== null}
        title="Simpan inbound?"
        confirmLabel="Ya, simpan"
        pending={submit.isPending}
        error={submit.error}
        onCancel={() => {
          setConfirming(null);
          submit.reset();
        }}
        onConfirm={() => confirming && submit.mutate(confirming)}
      >
        <Text style={styles.muted}>Stok gudang pusat akan bertambah:</Text>
        {confirming?.items.map((l) => {
          const it = byId.get(l.item_id);
          return (
            <View key={l.item_id} style={styles.confirmRow}>
              <Text style={styles.confirmName}>{it?.name}</Text>
              <Text style={styles.confirmQty}>
                +{formatQty(l.qty)} {it?.base_unit}
              </Text>
            </View>
          );
        })}
      </ConfirmSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: font.body, color: colors.textMuted },
  error: { fontSize: font.small, color: colors.danger },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  lineTitle: { fontSize: font.small, fontWeight: '700', color: colors.textMuted },
  remove: { fontSize: font.small, color: colors.danger, fontWeight: '600' },
  qtyInput: { fontSize: font.heading, fontWeight: '700' },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  confirmName: { flex: 1, fontSize: font.body, color: colors.text },
  confirmQty: { fontSize: font.body, fontWeight: '700', color: colors.success },
});
