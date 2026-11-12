import type { Dashboard, DashboardLocation, ShipmentRow } from '@sasana/shared-api';
import { formatDate, formatQty } from '@sasana/shared-constants';
import type { MyContext } from '@sasana/shared-types';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { useProductions } from '@/features/production/queries';
import { useStockLevels } from '@/features/stock/queries';
import { spacing } from '@/theme';
import { AllGood, BigAction, Empty, go, Hero, HomeScroll, homeStyles, ListRow, Section, StatTile, TileGrid, type IconName } from './kit';
import { useDashboard, useIncoming } from './queries';

const BASE = '/factory';

function sumFactories(locs: DashboardLocation[]) {
  return locs.reduce(
    (a, l) => ({
      goodToday: a.goodToday + l.production_today.good,
      rejectToday: a.rejectToday + l.production_today.reject,
      goodMonth: a.goodMonth + l.production_month.good,
      rejectMonth: a.rejectMonth + l.production_month.reject,
      soldToday: a.soldToday + l.distribution_today,
      soldMonth: a.soldMonth + l.distribution_month,
      finished: a.finished + l.finished_qty,
      packaging: a.packaging + l.packaging_qty,
      outgoing: a.outgoing + l.outgoing,
    }),
    { goodToday: 0, rejectToday: 0, goodMonth: 0, rejectMonth: 0, soldToday: 0, soldMonth: 0, finished: 0, packaging: 0, outgoing: 0 },
  );
}

function IncomingRows({ rows }: { rows: ShipmentRow[] }) {
  if (rows.length === 0) return <AllGood text="Tidak ada kiriman yang sedang menuju pabrik." />;
  return (
    <>
      {rows.map((s) => {
        const total = s.shipment_items.reduce((t, l) => t + (l.base_qty ?? 0), 0);
        const names = s.shipment_items.map((l) => l.item?.name).filter(Boolean).slice(0, 2).join(', ');
        return (
          <ListRow
            key={s.id}
            icon="truck-fast"
            tone="blue"
            title={`Dari ${s.from_location?.name ?? '-'}`}
            subtitle={`${names}${s.shipment_items.length > 2 ? ', …' : ''} · driver ${s.driver?.full_name ?? '-'}\nKetuk untuk cek & terima`}
            right={formatQty(total)}
            rightNote="sachet"
            onPress={() => go(`${BASE}/shipments/${s.id}`)}
          />
        );
      })}
    </>
  );
}

function ErrorBox({ message, retry }: { message: string; retry: () => void }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={homeStyles.error}>{message}</Text>
      <Button title="Coba lagi" variant="outline" onPress={retry} />
    </View>
  );
}

// ---------------------------------------------------------------------
// Owner Pabrik: pantau produksi, stok, penjualan, pengiriman
// ---------------------------------------------------------------------
export function FactoryOwnerHome({ me }: { me: MyContext }) {
  const dash = useDashboard();
  const incoming = useIncoming(me);
  const productions = useProductions({ limit: 5 });
  const d = dash.data;
  const factories = (d?.locations ?? []).filter((l) => l.type === 'FACTORY');
  const t = sumFactories(factories);
  const place = me.locations.filter((l) => l.type === 'FACTORY').map((l) => l.name).join(', ');
  const refresh = () => void Promise.all([dash.refetch(), incoming.refetch(), productions.refetch()]);

  return (
    <HomeScroll refreshing={dash.isRefetching} onRefresh={refresh}>
      <Hero
        name={me.full_name}
        place={place}
        summary={!d ? 'Memuat…' : t.goodToday || t.soldToday ? `Hari ini: ${formatQty(t.goodToday)} sachet diproduksi, ${formatQty(t.soldToday)} terjual.` : 'Belum ada produksi atau penjualan hari ini.'}
      />
      <BigAction icon="factory" title="Catat Produksi" subtitle="Hasil produksi hari ini (good & reject)" onPress={() => go(`${BASE}/production/new`)} />
      <BigAction icon="cart-plus" title="Catat Penjualan" subtitle="Produk keluar ke pembeli / pemakaian sendiri" onPress={() => go(`${BASE}/distribution/new`)} variant="light" />

      {dash.error && !d ? (
        <ErrorBox message={dash.error.message} retry={refresh} />
      ) : !d ? null : (
        <>
          <TileGrid>
            <StatTile icon="factory" label="Produksi hari ini" value={t.goodToday} note={t.rejectToday ? `reject ${formatQty(t.rejectToday)}` : undefined} onPress={() => go(`${BASE}/production`)} />
            <StatTile icon="calendar-month" label="Produksi bulan ini" value={t.goodMonth} note={t.rejectMonth ? `reject ${formatQty(t.rejectMonth)}` : undefined} onPress={() => go(`${BASE}/production`)} />
            <StatTile icon="cart-outline" label="Terjual bulan ini" value={t.soldMonth} tone="blue" onPress={() => go(`${BASE}/distribution`)} />
            <StatTile icon="store-outline" label="Stok produk jadi" value={t.finished} tone="orange" onPress={() => go(`${BASE}/stock`)} />
          </TileGrid>

          <Attention d={d} factories={factories} incoming={incoming.rows.length} outgoing={t.outgoing} />

          <Section title="Kiriman sedang datang" action="Semua pengiriman" onAction={() => go(`${BASE}/shipments`)}>
            <IncomingRows rows={incoming.rows} />
          </Section>

          <Section title="Produksi terakhir" action="Lihat semua" onAction={() => go(`${BASE}/production`)}>
            {(productions.data ?? []).length === 0 ? (
              <Empty text="Belum ada produksi." />
            ) : (
              productions.data!.map((p) => (
                <ListRow
                  key={p.id}
                  icon="factory"
                  tone={p.voided_at ? 'red' : 'green'}
                  title={`${p.product?.name ?? '-'}${p.voided_at ? ' (dibatalkan)' : ''}`}
                  subtitle={`${formatDate(p.production_date)} · reject ${formatQty(p.qty_reject)}`}
                  right={formatQty(p.qty_good ?? 0)}
                  rightNote="sachet"
                  onPress={() => go(`${BASE}/production/${p.id}`)}
                />
              ))
            )}
          </Section>
        </>
      )}
    </HomeScroll>
  );
}

function Attention({ d, factories, incoming, outgoing }: { d: Dashboard; factories: DashboardLocation[]; incoming: number; outgoing: number }) {
  const names = new Set(factories.map((f) => f.name));
  const low = d.low_stock.filter((r) => names.has(r.location_name));
  const items: { icon: IconName; tone: 'red' | 'blue' | 'orange'; title: string; subtitle?: string; path: string }[] = [];
  if (low.length)
    items.push({
      icon: 'alert-circle-outline',
      tone: 'red',
      title: `${low.length} barang hampir habis`,
      subtitle: low.slice(0, 3).map((r) => `${r.item_name} (sisa ${formatQty(r.quantity)})`).join(', '),
      path: `${BASE}/stock`,
    });
  if (incoming) items.push({ icon: 'truck-fast', tone: 'blue', title: `${incoming} kiriman sedang menuju pabrik`, subtitle: 'Terima setelah barang dicek', path: `${BASE}/shipments` });
  if (outgoing) items.push({ icon: 'truck-outline', tone: 'orange', title: `${outgoing} kiriman keluar belum diambil driver`, path: `${BASE}/shipments` });
  return (
    <Section title="Perlu perhatian">
      {items.length === 0 ? <AllGood text="Semua aman di pabrik." /> : items.map((i) => <ListRow key={i.title} icon={i.icon} tone={i.tone} title={i.title} subtitle={i.subtitle} onPress={() => go(i.path)} />)}
    </Section>
  );
}

// ---------------------------------------------------------------------
// Admin Pabrik: catat produksi & terima kiriman kemasan dari driver
// ---------------------------------------------------------------------
export function FactoryAdminHome({ me }: { me: MyContext }) {
  const dash = useDashboard();
  const incoming = useIncoming(me);
  const stock = useStockLevels();
  const d = dash.data;
  const factoryIds = new Set(me.locations.filter((l) => l.type === 'FACTORY').map((l) => l.id));
  const t = sumFactories((d?.locations ?? []).filter((l) => l.type === 'FACTORY'));
  const packaging = (stock.data ?? [])
    .filter((s) => factoryIds.has(s.location_id ?? '') && s.item_type === 'PACKAGING' && (s.quantity ?? 0) > 0)
    .sort((a, b) => Number(b.is_low) - Number(a.is_low) || (a.quantity ?? 0) - (b.quantity ?? 0));
  const place = me.locations.filter((l) => l.type === 'FACTORY').map((l) => l.name).join(', ');
  const refresh = () => void Promise.all([dash.refetch(), incoming.refetch(), stock.refetch()]);
  const n = incoming.rows.length;

  return (
    <HomeScroll refreshing={dash.isRefetching} onRefresh={refresh}>
      <Hero
        name={me.full_name}
        place={place}
        summary={
          n
            ? `Ada ${n} kiriman kemasan yang perlu diterima.`
            : t.goodToday
              ? `Hari ini sudah diproduksi ${formatQty(t.goodToday)} sachet.`
              : 'Belum ada produksi hari ini.'
        }
      />
      <BigAction icon="factory" title="Catat Produksi" subtitle="Isi hasil produksi: good & reject" onPress={() => go(`${BASE}/production/new`)} />
      <BigAction
        icon="truck-check"
        title="Terima Kiriman"
        subtitle={n ? 'Kemasan dari driver sudah sampai? Cek lalu terima.' : 'Belum ada kiriman yang datang'}
        badge={n || undefined}
        onPress={() => go(`${BASE}/shipments`)}
        variant="light"
      />

      <Section title="Kiriman sedang datang">
        <IncomingRows rows={incoming.rows} />
      </Section>

      <TileGrid>
        <StatTile icon="factory" label="Produksi hari ini" value={t.goodToday} onPress={() => go(`${BASE}/production`)} />
        <StatTile icon="close-circle-outline" label="Reject hari ini" value={t.rejectToday} tone={t.rejectToday ? 'orange' : 'gray'} />
      </TileGrid>

      <Section title="Stok kemasan di pabrik" action="Lihat semua" onAction={() => go(`${BASE}/stock`)}>
        {packaging.length === 0 ? (
          <Empty text="Belum ada kemasan di pabrik. Tunggu kiriman dari gudang." />
        ) : (
          packaging.slice(0, 8).map((s) => (
            <ListRow
              key={`${s.item_id}-${s.location_id}`}
              icon={s.is_low ? 'alert-circle-outline' : 'package-variant'}
              tone={s.is_low ? 'red' : 'green'}
              title={s.item_name ?? '-'}
              subtitle={s.is_low ? `Hampir habis (minimum ${formatQty(s.min_stock ?? 0)})` : undefined}
              right={formatQty(s.quantity ?? 0)}
              rightNote="sachet"
            />
          ))
        )}
      </Section>
    </HomeScroll>
  );
}
