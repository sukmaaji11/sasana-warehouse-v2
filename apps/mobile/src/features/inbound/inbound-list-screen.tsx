import { formatDate, formatQty } from '@sasana/shared-constants';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { EmptyState, InfoTip } from '@/components/ui/info-tip';
import { useInbounds } from '@/features/stock/queries';
import { colors, font, radius, spacing } from '@/theme';

export function InboundListScreen({ basePath }: { basePath: string }) {
  const { data, error, isPending, isRefetching, refetch } = useInbounds();

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Terima dari Vendor</Text>
        <InfoTip
          title="Apa yang dicatat di sini?"
          summary="Catat kemasan yang datang dari vendor. Stok gudang kemasan langsung bertambah setelah disimpan."
          steps={['Pilih vendor dan tanggal terima.', 'Tambah kemasan dan jumlahnya (sachet).', 'Cek ulang, lalu konfirmasi.', 'Salah input? Minta Super Owner melakukan void.']}
        />
        <Button title="+ Terima kemasan" onPress={() => router.push(`${basePath}/new` as never)} />
      </View>
      {error && !data ? (
        <View style={styles.header}>
          <Text style={styles.error}>{error.message}</Text>
          <Button title="Coba lagi" variant="outline" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
          ListEmptyComponent={
            isPending ? (
              <Text style={styles.empty}>Memuat…</Text>
            ) : (
              <EmptyState icon="package-down" title="Belum ada penerimaan" text="Tekan + Terima kemasan saat kemasan dari vendor datang." />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`${basePath}/${item.id}` as never)}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.doc}>{item.doc_no}</Text>
                <Text style={styles.meta}>
                  {formatDate(item.transaction_date)} · {item.vendor?.name ?? '–'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.qty}>{formatQty(item.inbound_items.reduce((s, l) => s + (l.base_qty ?? 0), 0))}</Text>
                <Text style={[styles.meta, item.voided_at ? { color: colors.danger, fontWeight: '600' } : null]}>
                  {item.voided_at ? 'VOID' : `${item.inbound_items.length} barang`}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  doc: { fontSize: font.body, fontWeight: '600', color: colors.text, fontFamily: 'monospace' },
  meta: { fontSize: font.small, color: colors.textMuted },
  qty: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  error: { color: colors.danger, fontSize: font.body },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: font.body, paddingVertical: spacing.xl },
});
