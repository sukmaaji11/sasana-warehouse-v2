import { getDashboard, type DashboardLocation } from '@sasana/shared-api';
import { formatDate, formatQty, LOCATION_TYPE_LABELS, ROLE_LABELS } from '@sasana/shared-constants';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/theme';
import { useMyContext } from './use-my-context';

/** Beranda dengan ringkasan (Phase 7). Angka dibatasi RLS sesuai lokasi user. */
export function HomeScreen({ hint }: { hint: string }) {
  const { data: user } = useMyContext();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard(supabase), refetchInterval: 60_000 });
  if (!user) return null;
  const d = dash.data;
  const seesDistribution = user.role !== 'ADMIN_PABRIK';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={() => void dash.refetch()} />}
      >
        <View>
          <Text style={styles.title}>Halo, {user.full_name}</Text>
          <Text style={styles.muted}>
            {ROLE_LABELS[user.role]}
            {d ? ` · ${formatDate(d.today)}` : ''}
          </Text>
        </View>

        {dash.error && !d ? (
          <>
            <Text style={styles.error}>{dash.error.message}</Text>
            <Button title="Coba lagi" variant="outline" onPress={() => dash.refetch()} />
          </>
        ) : !d ? (
          <Text style={styles.muted}>Memuat ringkasan…</Text>
        ) : (
          <>
            {d.locations.map((l) => (
              <LocationCard key={l.id} l={l} seesDistribution={seesDistribution} />
            ))}
            {d.locations.length === 0 && user.role !== 'DRIVER' ? (
              <Text style={styles.muted}>Belum ada lokasi yang ditugaskan. Hubungi Super Owner.</Text>
            ) : null}

            {user.role !== 'DRIVER' ? (
              <View style={styles.stats}>
                <Stat label="Menunggu driver" value={d.shipments.created} />
                <Stat label="Siap pickup" value={d.shipments.assigned} />
                <Stat label="Di perjalanan" value={d.shipments.picked_up} />
              </View>
            ) : null}

            {d.low_stock.length > 0 ? (
              <Card>
                <Text style={styles.section}>Stok menipis</Text>
                {d.low_stock.slice(0, 8).map((r) => (
                  <View key={`${r.location_name}-${r.sku}`} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.body}>{r.item_name}</Text>
                      <Text style={styles.muted}>{r.location_name}</Text>
                    </View>
                    <Text style={styles.low}>
                      {formatQty(r.quantity)} / {formatQty(r.min_stock)}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        )}
        <Text style={styles.muted}>{hint}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function LocationCard({ l, seesDistribution }: { l: DashboardLocation; seesDistribution: boolean }) {
  const rows: [string, string][] = [];
  if (l.type === 'FACTORY') {
    rows.push(['Produksi hari ini', `${formatQty(l.production_today.good)} · reject ${formatQty(l.production_today.reject)}`]);
    rows.push(['Produksi bulan ini', `${formatQty(l.production_month.good)} · reject ${formatQty(l.production_month.reject)}`]);
  }
  if (l.type !== 'WAREHOUSE' && seesDistribution) {
    rows.push(['Distribusi hari ini', formatQty(l.distribution_today)]);
    rows.push(['Distribusi bulan ini', formatQty(l.distribution_month)]);
  }
  if (l.type !== 'SALES_WAREHOUSE') rows.push(['Stok packaging', formatQty(l.packaging_qty)]);
  if (l.type !== 'WAREHOUSE') rows.push(['Stok produk jadi', formatQty(l.finished_qty)]);
  rows.push(['Shipment masuk', String(l.incoming)]);

  return (
    <Card>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{l.name}</Text>
          <Text style={styles.muted}>
            {l.code} · {LOCATION_TYPE_LABELS[l.type]}
          </Text>
        </View>
        {l.low_count > 0 ? <Text style={styles.badge}>{l.low_count} menipis</Text> : null}
      </View>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.row}>
          <Text style={styles.muted}>{k}</Text>
          <Text style={styles.value}>{v}</Text>
        </View>
      ))}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  name: { fontSize: font.heading, fontWeight: '600', color: colors.text },
  section: { fontSize: font.body, fontWeight: '700', color: colors.text },
  body: { fontSize: font.body, color: colors.text },
  muted: { fontSize: font.small, color: colors.textMuted },
  error: { fontSize: font.body, color: colors.danger },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badge: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.danger,
    backgroundColor: colors.dangerSurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  value: { fontSize: font.body, fontWeight: '600', color: colors.text },
  low: { fontSize: font.body, fontWeight: '700', color: colors.danger },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statValue: { fontSize: font.title, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: font.small, color: colors.textMuted },
});
