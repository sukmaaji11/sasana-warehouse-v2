'use client';

import { type ReportDoc } from '@sasana/shared-api';
import { formatQty, todayWib } from '@sasana/shared-constants';
import { useQuery } from '@tanstack/react-query';
import { FileDownIcon, FileSpreadsheetIcon, PlayIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingRows } from '@/components/app/data-state';
import { FormField } from '@/components/app/form-field';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser } from '@/features/auth/current-user';
import { useItems } from '@/features/master/queries';
import { getSupabase } from '@/lib/supabase/client';
import { downloadCsv, downloadPdf, reportFilename } from '@/lib/report-export';
import { reportsForRole, type ReportParams } from './definitions';

const PREVIEW_LIMIT = 300;

export function ReportsPage() {
  const user = useCurrentUser();
  const items = useItems();
  const available = reportsForRole(user.role);
  const today = todayWib();

  const [key, setKey] = useState(available[0]?.key ?? '');
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [locationId, setLocationId] = useState('');
  const [itemId, setItemId] = useState('');
  const [submitted, setSubmitted] = useState<(ReportParams & { key: string }) | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const def = available.find((r) => r.key === key);
  const allowedTypes = def?.locationTypes ?? [];
  const locationOptions = user.locations.filter((l) => allowedTypes.includes(l.type));
  const products = (items.data ?? []).filter((i) => i.type === 'FINISHED_GOOD');

  const report = useQuery({
    queryKey: ['report', submitted],
    enabled: submitted !== null,
    staleTime: 0,
    queryFn: () => {
      const d = available.find((r) => r.key === submitted!.key)!;
      return d.build(getSupabase(), submitted!);
    },
  });

  if (!def) return <EmptyState message="Tidak ada laporan untuk role Anda." />;
  const periodError = def.usesPeriod && (!from || !to || from > to) ? 'Periode tidak valid' : undefined;
  const itemMissing = def.needsItem && !itemId;

  function run() {
    if (periodError || itemMissing) return;
    const loc = locationOptions.find((l) => l.id === locationId);
    const item = products.find((i) => i.id === itemId);
    setSubmitted({
      key,
      period: def!.usesPeriod ? { from, to } : { from: today, to: today },
      locationId: loc ? loc.id : '',
      locationLabel: loc ? loc.name : user.role === 'SUPER_OWNER' ? 'Semua lokasi' : 'Semua lokasi saya',
      itemId,
      itemLabel: item ? `${item.sku} · ${item.name}` : '',
    });
  }

  const fileSuffix = submitted ? (def.usesPeriod ? `${submitted.period.from}_${submitted.period.to}` : today) : '';

  async function pdf(doc: ReportDoc) {
    setPdfBusy(true);
    try {
      await downloadPdf(doc, reportFilename(doc.title, fileSuffix), user.full_name);
    } catch (e) {
      toast.error(`Gagal membuat PDF: ${(e as Error).message}`);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Laporan" description="Pilih laporan dan periode, lalu unduh sebagai PDF atau CSV (Excel)." />
      <Card>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[14rem_10rem_10rem_1fr_auto] md:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <FormField id="report" label="Laporan" hint={def.description}>
              <NativeSelect
                id="report"
                className="w-full"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setLocationId('');
                  setSubmitted(null);
                }}
              >
                {available.map((r) => (
                  <NativeSelectOption key={r.key} value={r.key}>
                    {r.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            {def.usesPeriod ? (
              <>
                <FormField id="from" label="Dari tanggal" error={periodError}>
                  <Input id="from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
                </FormField>
                <FormField id="to" label="Sampai tanggal">
                  <Input id="to" type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
                </FormField>
              </>
            ) : (
              <div className="md:col-span-2" />
            )}
            {def.needsItem ? (
              <FormField id="item" label="Produk">
                <NativeSelect id="item" className="w-full" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  <NativeSelectOption value="">— Pilih produk —</NativeSelectOption>
                  {products.map((i) => (
                    <NativeSelectOption key={i.id} value={i.id}>
                      {i.sku} · {i.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
            ) : def.locationTypes ? (
              <FormField id="location" label="Lokasi">
                <NativeSelect id="location" className="w-full" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <NativeSelectOption value="">{user.role === 'SUPER_OWNER' ? 'Semua lokasi' : 'Semua lokasi saya'}</NativeSelectOption>
                  {locationOptions.map((l) => (
                    <NativeSelectOption key={l.id} value={l.id}>
                      {l.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormField>
            ) : (
              <div />
            )}
            <Button type="submit" disabled={Boolean(periodError) || itemMissing}>
              <PlayIcon /> Tampilkan
            </Button>
          </form>
        </CardContent>
      </Card>

      {submitted === null ? null : report.isPending ? (
        <LoadingRows />
      ) : report.error ? (
        <ErrorState message={report.error.message} onRetry={() => report.refetch()} />
      ) : (
        <ReportPreview
          doc={report.data}
          actions={
            <>
              <Button variant="outline" onClick={() => downloadCsv(report.data, reportFilename(report.data.title, fileSuffix))}>
                <FileSpreadsheetIcon /> Unduh CSV
              </Button>
              <Button onClick={() => void pdf(report.data)} disabled={pdfBusy}>
                <FileDownIcon /> {pdfBusy ? 'Membuat PDF…' : 'Unduh PDF'}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}

function ReportPreview({ doc, actions }: { doc: ReportDoc; actions: React.ReactNode }) {
  const fmt = (c: string | number) => (typeof c === 'number' ? formatQty(c) : c);
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{doc.title}</h2>
            {doc.meta.map((m) => (
              <p key={m} className="text-sm text-muted-foreground">
                {m}
              </p>
            ))}
          </div>
          <div className="flex gap-2">{actions}</div>
        </div>
        {doc.sections.map((s, si) => (
          <section key={si} className="flex flex-col gap-2">
            {s.heading ? <h3 className="text-sm font-semibold">{s.heading}</h3> : null}
            {s.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada data.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {s.columns.map((c) => (
                        <TableHead key={c.header} className={c.numeric ? 'text-right' : undefined}>
                          {c.header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.rows.slice(0, PREVIEW_LIMIT).map((r, ri) => (
                      <TableRow key={ri}>
                        {r.map((c, ci) => (
                          <TableCell key={ci} className={s.columns[ci]?.numeric ? 'text-right tabular-nums' : undefined}>
                            {fmt(c)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                  {s.footer ? (
                    <TableFooter>
                      <TableRow>
                        {s.footer.map((c, ci) => (
                          <TableCell key={ci} className={`font-semibold ${s.columns[ci]?.numeric ? 'text-right tabular-nums' : ''}`}>
                            {fmt(c)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableFooter>
                  ) : null}
                </Table>
                {s.rows.length > PREVIEW_LIMIT ? (
                  <p className="text-xs text-muted-foreground">
                    Menampilkan {PREVIEW_LIMIT} dari {formatQty(s.rows.length)} baris. Unduh PDF/CSV untuk data lengkap.
                  </p>
                ) : null}
              </>
            )}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
