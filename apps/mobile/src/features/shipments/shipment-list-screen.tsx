import { SHIPMENT_ACTIVE, type ShipmentStatus } from '@sasana/shared-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Chips } from '@/components/ui/chips';
import { useMyContext } from '@/features/auth/use-my-context';
import { colors, font, spacing } from '@/theme';
import { useShipments } from './queries';
import { ShipmentCard } from './shipment-card';

const FILTERS: Record<string, readonly ShipmentStatus[] | undefined> = {
  active: SHIPMENT_ACTIVE,
  transit: ['PICKED_UP'],
  done: ['RECEIVED'],
  all: undefined,
};

/**
 * Daftar shipment.
 * - Pengelola: filter + tombol buat.
 * - Driver ("tasks"): hanya tugas berjalan / riwayat, tanpa tombol buat.
 */
export function ShipmentListScreen({
  basePath,
  mode,
}: {
  basePath: string;
  mode: 'manage' | 'driver-tasks' | 'driver-history';
}) {
  const { data: me } = useMyContext();
  // Admin Pabrik hanya menerima shipment; pembuat = SO/AG/OP (sama dengan RPC).
  const canCreate = me?.role === 'SUPER_OWNER' || me?.role === 'ADMIN_GUDANG' || me?.role === 'OWNER_PABRIK';
  const [filter, setFilter] = useState('active');
  const statuses =
    mode === 'driver-tasks' ? (['ASSIGNED', 'PICKED_UP'] as const) : mode === 'driver-history' ? (['RECEIVED', 'CANCELLED'] as const) : FILTERS[filter];
  const { data, error, isPending, isRefetching, refetch } = useShipments(statuses);
  const title = mode === 'driver-tasks' ? 'Tugas saya' : mode === 'driver-history' ? 'Riwayat tugas' : 'Shipment';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {mode === 'manage' ? (
          <>
            {canCreate ? <Button title="+ Shipment baru" onPress={() => router.push(`${basePath}/new` as never)} /> : null}
            <Chips
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'active', label: 'Berjalan' },
                { value: 'transit', label: 'Dalam perjalanan' },
                { value: 'done', label: 'Diterima' },
                { value: 'all', label: 'Semua' },
              ]}
            />
          </>
        ) : null}
      </View>
      {error && !data ? (
        <View style={styles.header}>
          <Text style={styles.error}>{error.message}</Text>
          <Button title="Coba lagi" variant="outline" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isPending ? 'Memuat…' : mode === 'driver-tasks' ? 'Tidak ada tugas saat ini.' : 'Tidak ada shipment.'}
            </Text>
          }
          renderItem={({ item }) => <ShipmentCard s={item} onPress={() => router.push(`${basePath}/${item.id}` as never)} />}
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
  error: { color: colors.danger, fontSize: font.body },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: font.body, paddingVertical: spacing.xl },
});
