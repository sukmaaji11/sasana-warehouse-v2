import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Dashboard } from '@sasana/shared-api';
import { formatQty } from '@sasana/shared-constants';
import type { MyContext } from '@sasana/shared-types';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Chips } from '@/components/ui/chips';
import { colors, font, spacing } from '@/theme';
import { describeActivity, timeAgo } from './activity';
import { AllGood, Empty, go, Hero, HomeScroll, homeStyles, ListRow, Section, StatTile, TileGrid, type IconName } from './kit';
import { useDashboard } from './queries';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** Super Owner: kondisi usaha dalam satu layar — angka & ikon, sedikit teks. */
export function OwnerHome({ me }: { me: MyContext }) {
  const dash = useDashboard();
  const [period, setPeriod] = useState<'today' | 'month'>('month');
  const d = dash.data;
  const f = d?.flow[period];

  return (
    <HomeScroll refreshing={dash.isRefetching} onRefresh={() => void dash.refetch()}>
      <Hero
        name={me.full_name}
        summary={d ? `Hari ini · terjual ${formatQty(d.flow.today.distributed)} · produksi ${formatQty(d.flow.today.produced)}` : 'Memuat…'}
      />

      {dash.error && !d ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={homeStyles.error}>{dash.error.message}</Text>
          <Button title="Coba lagi" variant="outline" onPress={() => dash.refetch()} />
        </View>
      ) : !d || !f ? null : (
        <>
          <Chips
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'today', label: 'Hari ini' },
              { value: 'month', label: 'Bulan ini' },
            ]}
          />
          <TileGrid>
            <StatTile icon="cart-outline" label="Terjual" value={f.distributed} onPress={() => go('/owner/distribution')} />
            <StatTile
              icon="factory"
              label="Produksi"
              value={f.produced}
              note={f.rejected ? `reject ${pct(f.rejected, f.produced + f.rejected)}%` : undefined}
              onPress={() => go('/owner/production')}
            />
            <StatTile icon="store-outline" label="Stok produk" value={d.locations.reduce((s, l) => s + l.finished_qty, 0)} tone="blue" onPress={() => go('/owner/stock')} />
            <StatTile icon="package-variant" label="Stok kemasan" value={d.locations.reduce((s, l) => s + l.packaging_qty, 0)} tone="orange" onPress={() => go('/owner/stock')} />
          </TileGrid>

          <Attention d={d} />
          <Journey d={d} period={period} />

          <Section title="Lokasi">
            {d.locations.map((l) => {
              const [icon, value, label]: [IconName, number, string] =
                l.type === 'FACTORY'
                  ? ['factory', l.production_month.good, 'produksi']
                  : l.type === 'SALES_WAREHOUSE'
                    ? ['store-outline', l.distribution_month, 'terjual']
                    : ['package-variant', l.packaging_qty, 'stok kemasan'];
              return (
                <ListRow
                  key={l.id}
                  icon={icon}
                  tone={l.low_count ? 'red' : 'green'}
                  title={l.name}
                  subtitle={l.low_count ? `${l.low_count} hampir habis` : undefined}
                  right={formatQty(value)}
                  rightNote={label}
                />
              );
            })}
          </Section>

          {d.top_products.length ? (
            <Section title="Paling laku">
              {d.top_products.slice(0, 3).map((p, i) => (
                <ListRow key={p.sku} icon={i === 0 ? 'trophy' : 'medal-outline'} tone={i === 0 ? 'orange' : 'gray'} title={p.name} right={formatQty(p.qty)} />
              ))}
            </Section>
          ) : null}

          <Section title="Terbaru">
            {d.activity.length === 0 ? (
              <Empty text="Belum ada kegiatan." />
            ) : (
              d.activity.slice(0, 4).map((a) => {
                const x = describeActivity(a);
                return (
                  <ListRow
                    key={`${a.kind}-${a.id}`}
                    icon={x.icon}
                    tone={a.voided ? 'red' : x.tone}
                    title={a.voided ? `${x.text} · batal` : x.text}
                    subtitle={timeAgo(a.at)}
                  />
                );
              })
            )}
          </Section>
        </>
      )}
    </HomeScroll>
  );
}

/** Hal yang perlu ditindaklanjuti — judul singkat saja. */
function Attention({ d }: { d: Dashboard }) {
  const items: { icon: IconName; tone: 'red' | 'orange' | 'blue'; title: string; path: string }[] = [];
  if (d.low_stock.length) items.push({ icon: 'alert-circle-outline', tone: 'red', title: `${d.low_stock.length} stok hampir habis`, path: '/owner/stock' });
  const waiting = d.shipments.created + d.shipments.assigned;
  if (waiting) items.push({ icon: 'truck-outline', tone: 'orange', title: `${waiting} kiriman menunggu driver`, path: '/owner/shipments' });
  if (d.shipments.picked_up) items.push({ icon: 'truck-fast', tone: 'blue', title: `${d.shipments.picked_up} kiriman di jalan`, path: '/owner/shipments' });
  const m = d.flow.month;
  const rejectPct = pct(m.rejected, m.produced + m.rejected);
  if (rejectPct >= 5) items.push({ icon: 'alert-outline', tone: 'orange', title: `Reject ${rejectPct}% bulan ini`, path: '/owner/production' });

  return (
    <Section title="Perlu perhatian">
      {items.length === 0 ? (
        <AllGood text="Semua aman" />
      ) : (
        items.map((i) => <ListRow key={i.title} icon={i.icon} tone={i.tone} title={i.title} onPress={() => go(i.path)} />)
      )}
    </Section>
  );
}

/** Perjalanan barang: ikon + angka, label satu-dua kata. */
function Journey({ d, period }: { d: Dashboard; period: 'today' | 'month' }) {
  const f = d.flow[period];
  const steps: { icon: IconName; label: string; value: number }[] = [
    { icon: 'package-down', label: 'Beli', value: f.inbound },
    { icon: 'factory', label: 'Produksi', value: f.produced },
    { icon: 'truck-check', label: 'Ke gudang', value: f.goods_to_sales },
    { icon: 'cart-outline', label: 'Terjual', value: f.distributed },
  ];
  return (
    <Section title="Alur barang">
      <View style={styles.journey}>
        {steps.map((s, i) => (
          <View key={s.label} style={styles.jStep}>
            <View style={styles.jTop}>
              {i > 0 ? <View style={styles.jLine} /> : <View style={styles.jSpacer} />}
              <View style={[styles.jDot, s.value > 0 && styles.jDotOn]}>
                <MaterialCommunityIcons name={s.icon} size={18} color={s.value > 0 ? colors.onPrimary : colors.primary} />
              </View>
              {i < steps.length - 1 ? <View style={styles.jLine} /> : <View style={styles.jSpacer} />}
            </View>
            <Text style={styles.jValue}>{formatQty(s.value)}</Text>
            <Text style={styles.jLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  journey: { flexDirection: 'row', paddingVertical: spacing.lg, paddingHorizontal: spacing.xs },
  jStep: { flex: 1, alignItems: 'center', gap: 2 },
  jTop: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  jLine: { flex: 1, height: 2, backgroundColor: colors.primaryBorder },
  jSpacer: { flex: 1 },
  jDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jDotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  jValue: { fontSize: font.heading, fontWeight: '800', color: colors.text, marginTop: spacing.xs },
  jLabel: { fontSize: font.small, color: colors.textMuted },
});
