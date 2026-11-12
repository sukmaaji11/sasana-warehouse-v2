import { formatQty, ITEM_TYPE_LABELS, type ItemType } from '@sasana/shared-constants';
import type { StockLevel } from '@sasana/shared-api';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { EmptyState, InfoTip } from '@/components/ui/info-tip';
import { Chips } from '@/components/ui/chips';
import { useMyContext } from '@/features/auth/use-my-context';
import { colors, font, radius, spacing, touchTarget } from '@/theme';
import { useStockLevels } from './queries';

type TypeFilter = ItemType | 'ALL' | 'LOW';

/** Stok per lokasi: angka besar, filter lokasi & tipe, tanda stok menipis. */
export function StockScreen() {
  const { data: me } = useMyContext();
  const { data, error, isPending, isRefetching, refetch } = useStockLevels();
  const [locationId, setLocationId] = useState('ALL');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (locationId === 'ALL' || r.location_id === locationId) &&
        (type === 'ALL' || (type === 'LOW' ? r.is_low : r.item_type === type)) &&
        (!s || r.item_name?.toLowerCase().includes(s) || r.sku?.toLowerCase().includes(s)),
    );
  }, [data, locationId, type, q]);
  const lowCount = (data ?? []).filter((r) => r.is_low).length;

  const locations = me?.locations ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Stok</Text>
        <InfoTip
          title="Cara membaca stok"
          summary="Jumlah barang di lokasi Anda dalam satuan sachet. Merah berarti di bawah batas minimum dan perlu segera diisi."
        />
        {locations.length > 1 ? (
          <Chips
            accessibilityLabel="Filter lokasi"
            value={locationId}
            onChange={setLocationId}
            options={[{ value: 'ALL', label: 'Semua lokasi' }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
          />
        ) : null}
        <Chips
          accessibilityLabel="Filter tipe"
          value={type}
          onChange={setType}
          options={[
            { value: 'ALL', label: 'Semua' },
            { value: 'PACKAGING', label: ITEM_TYPE_LABELS.PACKAGING },
            { value: 'FINISHED_GOOD', label: ITEM_TYPE_LABELS.FINISHED_GOOD },
            { value: 'LOW', label: `Menipis (${lowCount})` },
          ]}
        />
        <TextInput
          placeholder="Cari barang…"
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={setQ}
          style={styles.search}
          autoCorrect={false}
        />
      </View>

      {error && !data ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error.message}</Text>
          <Button title="Coba lagi" variant="outline" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.item_id}:${r.location_id}`}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
          ListEmptyComponent={
            isPending ? (
              <Text style={styles.empty}>Memuat stok…</Text>
            ) : data?.length ? (
              <EmptyState icon="magnify" title="Tidak ada yang cocok" text="Ubah kata kunci atau filter." />
            ) : (
              <EmptyState icon="package-variant" title="Belum ada stok" text="Stok muncul setelah ada inbound, shipment diterima, atau produksi." />
            )
          }
          renderItem={({ item }) => <StockRow row={item} showLocation={locationId === 'ALL' && locations.length > 1} />}
        />
      )}
    </SafeAreaView>
  );
}

function StockRow({ row, showLocation }: { row: StockLevel; showLocation: boolean }) {
  return (
    <View style={[styles.card, row.is_low && styles.cardLow]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name}>{row.item_name}</Text>
        <Text style={styles.meta}>
          {row.sku}
          {showLocation ? ` · ${row.location_name}` : ''}
        </Text>
        {row.is_low ? <Text style={styles.low}>Menipis · min. {formatQty(row.min_stock ?? 0)}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.qty, row.is_low && { color: colors.danger }]}>{formatQty(row.quantity ?? 0)}</Text>
        <Text style={styles.meta}>{row.base_unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  search: {
    minHeight: touchTarget - 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardLow: { borderColor: colors.danger, backgroundColor: colors.dangerSurface },
  name: { fontSize: font.body, fontWeight: '600', color: colors.text },
  meta: { fontSize: font.small, color: colors.textMuted },
  low: { fontSize: font.small, color: colors.danger, fontWeight: '600' },
  qty: { fontSize: font.number, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  error: { fontSize: font.body, color: colors.danger, textAlign: 'center' },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: font.body, paddingVertical: spacing.xl },
});
