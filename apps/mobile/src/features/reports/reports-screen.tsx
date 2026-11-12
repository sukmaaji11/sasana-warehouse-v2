import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  a4Size,
  periodLabel,
  reportsForRole,
  reportToCsv,
  reportToHtml,
  type ReportDoc,
  type ReportParams,
} from '@sasana/shared-api';
import { addDays, formatDate, formatDateTime, formatQty, todayWib } from '@sasana/shared-constants';
import { useMutation } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chips } from '@/components/ui/chips';
import { PickerField } from '@/components/ui/picker-field';
import { useMyContext } from '@/features/auth/use-my-context';
import { useItems } from '@/features/stock/queries';
import { useOnline } from '@/hooks/use-online';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/theme';

type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';

/** Tanggal ISO (YYYY-MM-DD) ↔ Date lokal tanpa geser zona. */
const toDate = (iso: string) => new Date(`${iso}T12:00:00`);
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeFor(key: PeriodKey, custom: { from: string; to: string }) {
  const today = todayWib();
  const monthStart = `${today.slice(0, 8)}01`;
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case 'week':
      return { from: addDays(today, -6), to: today };
    case 'month':
      return { from: monthStart, to: today };
    case 'lastMonth': {
      const lastDay = addDays(monthStart, -1);
      return { from: `${lastDay.slice(0, 8)}01`, to: lastDay };
    }
    case 'custom':
      return custom;
  }
}

/** Nama file aman: "laporan-produksi-reject-2026-11-01_2026-11-12" */
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export function ReportsScreen() {
  const { data: me } = useMyContext();
  const items = useItems();
  const online = useOnline();
  const available = me ? reportsForRole(me.role) : [];
  const [key, setKey] = useState(available[0]?.key ?? 'stock');
  const [periodKey, setPeriodKey] = useState<PeriodKey>('month');
  const [custom, setCustom] = useState({ from: `${todayWib().slice(0, 8)}01`, to: todayWib() });
  const [locationId, setLocationId] = useState('');
  const [itemId, setItemId] = useState('');
  const [sharing, setSharing] = useState<'pdf' | 'csv' | null>(null);
  const [shareError, setShareError] = useState<string>();

  const def = available.find((r) => r.key === key);
  const period = rangeFor(periodKey, custom);
  const locations = (me?.locations ?? []).filter((l) => def?.locationTypes?.includes(l.type));
  const products = (items.data ?? []).filter((i) => i.type === 'FINISHED_GOOD' && i.is_active);
  const periodError = def?.usesPeriod && period.from > period.to ? 'Tanggal awal harus sebelum tanggal akhir' : undefined;

  const run = useMutation({
    mutationFn: async (): Promise<{ doc: ReportDoc; suffix: string }> => {
      const loc = locations.find((l) => l.id === locationId);
      const item = products.find((i) => i.id === itemId);
      const params: ReportParams = {
        period: def!.usesPeriod ? period : { from: todayWib(), to: todayWib() },
        locationId: loc?.id ?? '',
        locationLabel: loc?.name ?? (me?.role === 'SUPER_OWNER' ? 'Semua lokasi' : 'Semua lokasi saya'),
        itemId,
        itemLabel: item ? `${item.sku} · ${item.name}` : '',
      };
      const doc = await def!.build(supabase, params);
      return { doc, suffix: def!.usesPeriod ? `${period.from}_${period.to}` : todayWib() };
    },
  });

  async function share(kind: 'pdf' | 'csv') {
    if (!run.data) return;
    const { doc, suffix } = run.data;
    const name = `${slug(doc.title)}-${suffix}.${kind}`;
    setSharing(kind);
    setShareError(undefined);
    try {
      const dest = new File(Paths.cache, name);
      if (dest.exists) dest.delete();
      if (kind === 'pdf') {
        const html = reportToHtml(doc, me?.full_name ?? '-', formatDateTime(new Date().toISOString()));
        // base64 → tulis sendiri: file hasil expo-print ada di folder yang tidak bisa dipindah.
        const { base64 } = await Print.printToFileAsync({ html, base64: true, ...a4Size(doc.landscape) });
        if (!base64) throw new Error('PDF kosong');
        dest.create();
        await dest.write(base64, { encoding: 'base64' });
      } else {
        dest.create();
        await dest.write(reportToCsv(doc));
      }
      await Sharing.shareAsync(dest.uri, {
        mimeType: kind === 'pdf' ? 'application/pdf' : 'text/csv',
        dialogTitle: `Bagikan ${doc.title}`,
      });
    } catch (e) {
      setShareError((e as Error).message);
    } finally {
      setSharing(null);
    }
  }

  if (!def) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>Tidak ada laporan untuk role Anda.</Text>
      </View>
    );
  }

  const doc = run.data?.doc;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={styles.title}>Laporan</Text>
        <Text style={styles.muted}>Pilih laporan & periode, lalu bagikan sebagai PDF atau Excel.</Text>
      </View>

      <Card>
        <PickerField
          label="Jenis laporan"
          value={key}
          placeholder="Pilih laporan"
          options={available.map((r) => ({ value: r.key, label: r.label, hint: r.description }))}
          onChange={(v) => {
            setKey(v);
            setLocationId('');
            run.reset();
          }}
        />

        {def.usesPeriod ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.label}>Periode</Text>
            <Chips
              value={periodKey}
              onChange={(v) => (setPeriodKey(v), run.reset())}
              options={[
                { value: 'today', label: 'Hari ini' },
                { value: 'yesterday', label: 'Kemarin' },
                { value: 'week', label: '7 hari' },
                { value: 'month', label: 'Bulan ini' },
                { value: 'lastMonth', label: 'Bulan lalu' },
                { value: 'custom', label: 'Pilih tanggal' },
              ]}
            />
            {periodKey === 'custom' ? (
              <View style={styles.dates}>
                <DateButton label="Dari" value={custom.from} onChange={(from) => (setCustom((c) => ({ ...c, from })), run.reset())} />
                <MaterialCommunityIcons name="arrow-right" size={18} color={colors.textMuted} />
                <DateButton label="Sampai" value={custom.to} onChange={(to) => (setCustom((c) => ({ ...c, to })), run.reset())} />
              </View>
            ) : (
              <Text style={styles.muted}>{periodLabel(period)}</Text>
            )}
            {periodError ? <Text style={styles.error}>{periodError}</Text> : null}
          </View>
        ) : null}

        {def.needsItem ? (
          <PickerField
            label="Produk"
            value={itemId}
            placeholder="Pilih produk"
            options={products.map((i) => ({ value: i.id, label: i.name, hint: i.sku }))}
            onChange={(v) => (setItemId(v), run.reset())}
          />
        ) : locations.length > 1 ? (
          <PickerField
            label="Lokasi"
            value={locationId}
            placeholder="Semua lokasi"
            options={[{ value: '', label: 'Semua lokasi' }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
            onChange={(v) => (setLocationId(v), run.reset())}
          />
        ) : null}

        <Button
          title={online ? 'Tampilkan laporan' : 'Menunggu koneksi…'}
          loading={run.isPending}
          disabled={!online || Boolean(periodError) || (def.needsItem && !itemId)}
          onPress={() => run.mutate()}
        />
        {run.error ? <Text style={styles.error}>{run.error.message}</Text> : null}
      </Card>

      {doc ? (
        <>
          <View style={styles.shareRow}>
            <ShareButton icon="file-pdf-box" label="Bagikan PDF" busy={sharing === 'pdf'} onPress={() => void share('pdf')} />
            <ShareButton icon="microsoft-excel" label="Bagikan Excel" busy={sharing === 'csv'} onPress={() => void share('csv')} />
          </View>
          {shareError ? <Text style={styles.error}>Gagal membuat file: {shareError}</Text> : null}
          <Preview doc={doc} />
        </>
      ) : null}
    </ScrollView>
  );
}

function DateButton({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.dateBtn, pressed && { opacity: 0.7 }]}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: toDate(value),
          mode: 'date',
          maximumDate: toDate(todayWib()),
          onChange: (e, d) => {
            if (e.type === 'set' && d) onChange(toIso(d));
          },
        })
      }
    >
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateValueRow}>
        <MaterialCommunityIcons name="calendar" size={16} color={colors.primary} />
        <Text style={styles.dateValue}>{formatDate(value)}</Text>
      </View>
    </Pressable>
  );
}

function ShareButton({ icon, label, busy, onPress }: { icon: 'file-pdf-box' | 'microsoft-excel'; label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.share, pressed && { opacity: 0.8 }, busy && { opacity: 0.6 }]}
    >
      <MaterialCommunityIcons name={icon} size={24} color={icon === 'file-pdf-box' ? colors.danger : colors.primary} />
      <Text style={styles.shareText}>{busy ? 'Menyiapkan…' : label}</Text>
    </Pressable>
  );
}

/** Pratinjau ringkas: judul, keterangan, dan tiap tabel (maks. 30 baris). */
function Preview({ doc }: { doc: ReportDoc }) {
  return (
    <Card>
      <Text style={styles.docTitle}>{doc.title}</Text>
      {doc.meta.slice(0, 2).map((m) => (
        <Text key={m} style={styles.muted}>
          {m}
        </Text>
      ))}
      {doc.sections.map((s, si) => (
        <View key={si} style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          {s.heading ? <Text style={styles.label}>{s.heading}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={[styles.tr, styles.th]}>
                {s.columns.map((c) => (
                  <Text key={c.header} style={[styles.cell, styles.thText, c.numeric && styles.num]}>
                    {c.header}
                  </Text>
                ))}
              </View>
              {s.rows.length === 0 ? (
                <Text style={[styles.muted, { padding: spacing.sm }]}>Tidak ada data</Text>
              ) : (
                s.rows.slice(0, 30).map((r, ri) => (
                  <View key={ri} style={[styles.tr, ri % 2 === 1 && styles.zebra]}>
                    {r.map((c, ci) => (
                      <Text key={ci} style={[styles.cell, s.columns[ci]?.numeric && styles.num]} numberOfLines={2}>
                        {typeof c === 'number' ? formatQty(c) : c}
                      </Text>
                    ))}
                  </View>
                ))
              )}
              {s.footer ? (
                <View style={[styles.tr, styles.tfoot]}>
                  {s.footer.map((c, ci) => (
                    <Text key={ci} style={[styles.cell, styles.bold, s.columns[ci]?.numeric && styles.num]}>
                      {typeof c === 'number' ? formatQty(c) : c}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
          {s.rows.length > 30 ? <Text style={styles.muted}>+{s.rows.length - 30} baris lagi di file PDF/Excel</Text> : null}
        </View>
      ))}
    </Card>
  );
}

const CELL_W = 110;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  label: { fontSize: font.small, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.textMuted },
  error: { fontSize: font.small, color: colors.danger },
  dates: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surface },
  dateLabel: { fontSize: 11, color: colors.textMuted },
  dateValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  dateValue: { fontSize: font.body, fontWeight: '600', color: colors.text },
  shareRow: { flexDirection: 'row', gap: spacing.sm },
  share: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareText: { fontSize: font.body, fontWeight: '700', color: colors.text },
  docTitle: { fontSize: font.heading, fontWeight: '800', color: colors.text },
  tr: { flexDirection: 'row' },
  th: { backgroundColor: colors.primary, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  thText: { color: colors.onPrimary, fontWeight: '700' },
  zebra: { backgroundColor: colors.background },
  tfoot: { backgroundColor: colors.primarySurface },
  cell: { width: CELL_W, paddingHorizontal: spacing.sm, paddingVertical: 6, fontSize: font.small, color: colors.text },
  num: { textAlign: 'right' },
  bold: { fontWeight: '700' },
});
