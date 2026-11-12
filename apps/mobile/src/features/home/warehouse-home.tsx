import { formatDate, formatQty } from '@sasana/shared-constants';
import type { MyContext } from '@sasana/shared-types';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { useDistributions } from '@/features/distribution/queries';
import { useInbounds, useStockLevels } from '@/features/stock/queries';
import { spacing } from '@/theme';
import { AllGood, BigAction, Empty, go, Hero, HomeScroll, homeStyles, ListRow, Section, StatTile, TileGrid } from './kit';
import { useDashboard, useIncoming } from './queries';

const BASE = '/warehouse';

/**
 * Admin Gudang. Isi menyesuaikan lokasi tugas:
 *  - Gudang kemasan  → penerimaan dari vendor & kirim kemasan ke pabrik
 *  - Gudang penjualan → data penjualan (Admin Penjualan)
 */
export function WarehouseHome({ me }: { me: MyContext }) {
  const dash = useDashboard();
  const atHub = me.locations.some((l) => l.type === 'WAREHOUSE');
  const atSales = me.locations.some((l) => l.type === 'SALES_WAREHOUSE');
  const d = dash.data;
  const sales = (d?.locations ?? []).filter((l) => l.type === 'SALES_WAREHOUSE');
  const soldToday = sales.reduce((s, l) => s + l.distribution_today, 0);
  const place = me.locations.map((l) => l.name).join(', ');

  const summary = !d
    ? 'Memuat…'
    : atSales && !atHub
      ? soldToday
        ? `Hari ini terjual ${formatQty(soldToday)} sachet.`
        : 'Belum ada penjualan hari ini.'
      : d.flow.today.inbound
        ? `Hari ini ${formatQty(d.flow.today.inbound)} sachet kemasan diterima dari vendor.`
        : 'Belum ada kemasan masuk hari ini.';

  return (
    <HomeScroll refreshing={dash.isRefetching} onRefresh={() => void dash.refetch()}>
      <Hero name={me.full_name} place={place} summary={summary} />
      {dash.error && !d ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={homeStyles.error}>{dash.error.message}</Text>
          <Button title="Coba lagi" variant="outline" onPress={() => dash.refetch()} />
        </View>
      ) : null}
      {atSales ? <SalesPart me={me} /> : null}
      {atHub ? <HubPart /> : null}
      {!atHub && !atSales ? <Empty text="Anda belum ditugaskan ke gudang. Hubungi Super Owner." /> : null}
    </HomeScroll>
  );
}

// ---------------------------------------------------------------------
function HubPart() {
  const dash = useDashboard();
  const inbounds = useInbounds();
  const stock = useStockLevels();
  const d = dash.data;
  const hub = (d?.locations ?? []).filter((l) => l.type === 'WAREHOUSE');
  const hubIds = new Set(hub.map((l) => l.id));
  const low = (stock.data ?? []).filter((s) => hubIds.has(s.location_id ?? '') && s.is_low && s.item_type === 'PACKAGING');

  return (
    <>
      <BigAction icon="package-down" title="Terima dari Vendor" subtitle="Catat kemasan yang baru datang dari vendor" onPress={() => go(`${BASE}/inbound/new`)} />
      <BigAction icon="truck-delivery-outline" title="Kirim Kemasan ke Pabrik" subtitle="Buat pengiriman dan tugaskan driver" onPress={() => go(`${BASE}/shipments/new`)} variant="light" />
      {d ? (
        <TileGrid>
          <StatTile icon="package-down" label="Kemasan masuk bulan ini" value={d.flow.month.inbound} onPress={() => go(`${BASE}/inbound`)} />
          <StatTile icon="package-variant" label="Stok kemasan di gudang" value={hub.reduce((s, l) => s + l.packaging_qty, 0)} tone="orange" onPress={() => go(`${BASE}/stock`)} />
          <StatTile icon="truck-outline" label="Kiriman belum diambil" value={hub.reduce((s, l) => s + l.outgoing, 0)} unit="kiriman" tone="blue" onPress={() => go(`${BASE}/shipments`)} />
          <StatTile icon="alert-circle-outline" label="Kemasan hampir habis" value={low.length} unit="jenis" tone={low.length ? 'red' : 'gray'} onPress={() => go(`${BASE}/stock`)} />
        </TileGrid>
      ) : null}

      <Section title="Kemasan hampir habis">
        {low.length === 0 ? (
          <AllGood text="Semua stok kemasan di atas batas minimum." />
        ) : (
          low.slice(0, 6).map((s) => (
            <ListRow
              key={`${s.item_id}-${s.location_id}`}
              icon="alert-circle-outline"
              tone="red"
              title={s.item_name ?? '-'}
              subtitle={`Minimum ${formatQty(s.min_stock ?? 0)} sachet`}
              right={formatQty(s.quantity ?? 0)}
              rightNote="sachet"
            />
          ))
        )}
      </Section>

      <Section title="Penerimaan terakhir" action="Lihat semua" onAction={() => go(`${BASE}/inbound`)}>
        {(inbounds.data ?? []).length === 0 ? (
          <Empty text="Belum ada kemasan yang diterima." />
        ) : (
          inbounds.data!.slice(0, 5).map((r) => (
            <ListRow
              key={r.id}
              icon="package-down"
              tone={r.voided_at ? 'red' : 'green'}
              title={`${r.vendor?.name ?? '-'}${r.voided_at ? ' (dibatalkan)' : ''}`}
              subtitle={`${formatDate(r.transaction_date)} · ${r.inbound_items.length} jenis kemasan`}
              right={formatQty(r.inbound_items.reduce((s, l) => s + (l.base_qty ?? 0), 0))}
              rightNote="sachet"
              onPress={() => go(`${BASE}/inbound/${r.id}`)}
            />
          ))
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------
function SalesPart({ me }: { me: MyContext }) {
  const dash = useDashboard();
  const sales = useDistributions({ limit: 5 });
  const incoming = useIncoming(me);
  const stock = useStockLevels();
  const d = dash.data;
  const locs = (d?.locations ?? []).filter((l) => l.type === 'SALES_WAREHOUSE');
  const ids = new Set(locs.map((l) => l.id));
  const products = (stock.data ?? [])
    .filter((s) => ids.has(s.location_id ?? '') && s.item_type === 'FINISHED_GOOD' && ((s.quantity ?? 0) > 0 || s.is_low))
    .sort((a, b) => Number(b.is_low) - Number(a.is_low) || (b.quantity ?? 0) - (a.quantity ?? 0));

  return (
    <>
      <BigAction icon="cart-plus" title="Catat Penjualan" subtitle="Produk keluar ke pembeli atau dipakai sendiri" onPress={() => go(`${BASE}/distribution/new`)} />
      {d ? (
        <TileGrid>
          <StatTile icon="cart-outline" label="Terjual hari ini" value={locs.reduce((s, l) => s + l.distribution_today, 0)} onPress={() => go(`${BASE}/distribution`)} />
          <StatTile icon="calendar-month" label="Terjual bulan ini" value={locs.reduce((s, l) => s + l.distribution_month, 0)} onPress={() => go(`${BASE}/distribution`)} />
          <StatTile icon="store-outline" label="Stok siap jual" value={locs.reduce((s, l) => s + l.finished_qty, 0)} tone="blue" onPress={() => go(`${BASE}/stock`)} />
          <StatTile icon="truck-fast" label="Kiriman sedang datang" value={incoming.rows.length} unit="kiriman" tone="orange" onPress={() => go(`${BASE}/shipments`)} />
        </TileGrid>
      ) : null}

      {incoming.rows.length ? (
        <Section title="Kiriman produk sedang datang">
          {incoming.rows.map((s) => (
            <ListRow
              key={s.id}
              icon="truck-fast"
              tone="blue"
              title={`Dari ${s.from_location?.name ?? '-'}`}
              subtitle="Ketuk untuk cek & terima"
              right={formatQty(s.shipment_items.reduce((t, l) => t + (l.base_qty ?? 0), 0))}
              rightNote="sachet"
              onPress={() => go(`${BASE}/shipments/${s.id}`)}
            />
          ))}
        </Section>
      ) : null}

      {d?.top_products.length ? (
        <Section title="Paling laku bulan ini">
          {d.top_products.slice(0, 5).map((p, i) => (
            <ListRow key={p.sku} icon={i === 0 ? 'trophy' : 'medal-outline'} tone={i === 0 ? 'orange' : 'gray'} title={p.name} right={formatQty(p.qty)} rightNote="sachet" />
          ))}
        </Section>
      ) : null}

      <Section title="Penjualan terakhir" action="Lihat semua" onAction={() => go(`${BASE}/distribution`)}>
        {(sales.data ?? []).length === 0 ? (
          <Empty text="Belum ada penjualan." />
        ) : (
          sales.data!.map((r) => (
            <ListRow
              key={r.id}
              icon="cart-outline"
              tone={r.voided_at ? 'red' : 'green'}
              title={`${r.buyer_name}${r.voided_at ? ' (dibatalkan)' : ''}`}
              subtitle={`${formatDate(r.transaction_date)} · ${r.distribution_items.map((l) => l.item?.name).filter(Boolean).slice(0, 2).join(', ')}`}
              right={formatQty(r.distribution_items.reduce((s, l) => s + (l.base_qty ?? 0), 0))}
              rightNote="sachet"
              onPress={() => go(`${BASE}/distribution/${r.id}`)}
            />
          ))
        )}
      </Section>

      <Section title="Stok produk" action="Lihat semua" onAction={() => go(`${BASE}/stock`)}>
        {products.length === 0 ? (
          <Empty text="Belum ada produk di gudang penjualan." />
        ) : (
          products.slice(0, 8).map((s) => (
            <ListRow
              key={`${s.item_id}-${s.location_id}`}
              icon={s.is_low ? 'alert-circle-outline' : 'package-variant-closed'}
              tone={s.is_low ? 'red' : 'green'}
              title={s.item_name ?? '-'}
              subtitle={s.is_low ? 'Hampir habis' : undefined}
              right={formatQty(s.quantity ?? 0)}
              rightNote="sachet"
            />
          ))
        )}
      </Section>
    </>
  );
}
