import { formatQty } from '@sasana/shared-constants';
import type { Cell, ReportDoc } from './report-builders';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (c: Cell) => (typeof c === 'number' ? formatQty(c) : esc(c));

/** Ukuran halaman A4 dalam point (72 PPI) untuk expo-print. */
export function a4Size(landscape?: boolean) {
  return landscape ? { width: 842, height: 595 } : { width: 595, height: 842 };
}

/**
 * Laporan sebagai HTML A4 (untuk dicetak ke PDF di Android lewat expo-print).
 * Isi sama dengan PDF web: kop, keterangan, tabel per bagian, total.
 */
export function reportToHtml(doc: ReportDoc, printedBy: string, printedAt: string): string {
  const sections = doc.sections
    .map((s) => {
      const head = s.columns.map((c) => `<th class="${c.numeric ? 'n' : ''}">${esc(c.header)}</th>`).join('');
      const body = s.rows.length
        ? s.rows
            .map((r) => `<tr>${r.map((c, i) => `<td class="${s.columns[i]?.numeric ? 'n' : ''}">${fmt(c)}</td>`).join('')}</tr>`)
            .join('')
        : `<tr><td colspan="${s.columns.length}" class="empty">Tidak ada data</td></tr>`;
      const foot = s.footer
        ? `<tfoot><tr>${s.footer.map((c, i) => `<td class="${s.columns[i]?.numeric ? 'n' : ''}">${fmt(c)}</td>`).join('')}</tr></tfoot>`
        : '';
      return `${s.heading ? `<h2>${esc(s.heading)}</h2>` : ''}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
    })
    .join('');

  return `<!doctype html><html lang="id"><head><meta charset="utf-8" />
<style>
  @page { size: A4 ${doc.landscape ? 'landscape' : 'portrait'}; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, 'Segoe UI', Arial, sans-serif; color: #16201B; font-size: 10px; margin: 0; }
  .brand { display: flex; align-items: center; gap: 8px; color: #5D6B63; font-size: 10px; }
  .dot { width: 14px; height: 14px; border-radius: 4px; background: #1F7A4D; display: inline-block; }
  h1 { font-size: 18px; margin: 6px 0 4px; }
  .meta { color: #46524B; margin: 0; line-height: 1.5; }
  .rule { border: 0; border-top: 2px solid #1F7A4D; margin: 8px 0 10px; }
  h2 { font-size: 12px; margin: 14px 0 4px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { background: #1F7A4D; color: #fff; text-align: left; padding: 4px 6px; font-weight: 600; }
  td { padding: 3px 6px; border-bottom: 1px solid #E2E5E3; }
  tbody tr:nth-child(even) td { background: #F6F7F6; }
  tfoot td { font-weight: 700; background: #E8F0EB; }
  .n { text-align: right; white-space: nowrap; }
  .empty { color: #5D6B63; text-align: center; }
  .foot { margin-top: 16px; color: #8A958F; font-size: 9px; }
</style></head><body>
<div class="brand"><span class="dot"></span> Sasana Warehouse — Gudang Jamu</div>
<h1>${esc(doc.title)}</h1>
${doc.meta.map((m) => `<p class="meta">${esc(m)}</p>`).join('')}
<hr class="rule" />
${sections}
<p class="foot">Dicetak ${esc(printedAt)} oleh ${esc(printedBy)}</p>
</body></html>`;
}
