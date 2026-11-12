import { formatDate, formatQty } from '@sasana/shared-constants';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { useMyContext } from '@/features/auth/use-my-context';
import { colors, font, radius, spacing } from '@/theme';
import { productionPermissions, useProductions } from './queries';

export function ProductionListScreen({ basePath }: { basePath: string }) {
  const { data: me } = useMyContext();
  const { data, error, isPending, isRefetching, refetch } = useProductions();
  const can = me ? productionPermissions(me) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Produksi</Text>
        {can?.create ? <Button title="+ Input produksi" onPress={() => router.push(`${basePath}/new` as never)} /> : null}
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
          ListEmptyComponent={<Text style={styles.empty}>{isPending ? 'Memuat…' : 'Belum ada produksi.'}</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`${basePath}/${item.id}` as never)}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{item.product?.name ?? '–'}</Text>
                <Text style={styles.meta}>
                  {formatDate(item.production_date)} · {item.location?.name ?? '–'}
                </Text>
                <Text style={styles.doc}>{item.doc_no}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.qty}>{formatQty(item.qty_good ?? 0)}</Text>
                <Text style={[styles.meta, item.voided_at ? { color: colors.danger, fontWeight: '600' } : null]}>
                  {item.voided_at ? 'VOID' : `reject ${formatQty(item.qty_reject)}`}
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
  name: { fontSize: font.body, fontWeight: '600', color: colors.text },
  doc: { fontSize: font.small, color: colors.textMuted, fontFamily: 'monospace' },
  meta: { fontSize: font.small, color: colors.textMuted },
  qty: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  error: { color: colors.danger, fontSize: font.body },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: font.body, paddingVertical: spacing.xl },
});
