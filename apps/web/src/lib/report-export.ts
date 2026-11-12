import { formatDateTime, formatQty } from '@sasana/shared-constants';
import { reportToCsv, type Cell, type ReportDoc } from '@sasana/shared-api';

const APP_NAME = 'Sasana Warehouse — Gudang Jamu';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nama file aman: "laporan-produksi-2026-11-01_2026-11-12" */
export function reportFilename(title: string, suffix: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug}-${suffix}`;
}

export function downloadCsv(doc: ReportDoc, filename: string) {
  triggerDownload(new Blob([reportToCsv(doc)], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

const fmt = (c: Cell) => (typeof c === 'number' ? formatQty(c) : c);

/** PDF A4 dengan kop, keterangan, tabel per bagian, dan nomor halaman. */
export async function downloadPdf(doc: ReportDoc, filename: string, printedBy: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: doc.landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const margin = 12;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const green: [number, number, number] = [31, 122, 77];

  // Kop
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100);
  pdf.text(APP_NAME, margin, margin);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(20);
  pdf.text(doc.title, margin, margin + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(70);
  let y = margin + 14;
  for (const m of doc.meta) {
    const lines = pdf.splitTextToSize(m, pageW - margin * 2) as string[];
    pdf.text(lines, margin, y);
    y += lines.length * 4.2;
  }
  pdf.setDrawColor(...green);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageW - margin, y);
  y += 5;

  for (const s of doc.sections) {
    if (s.heading) {
      if (y > pageH - 30) {
        pdf.addPage();
        y = margin;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(20);
      pdf.text(s.heading, margin, y);
      y += 2.5;
    }
    const columnStyles = Object.fromEntries(s.columns.map((c, i) => [i, c.numeric ? { halign: 'right' as const } : {}]));
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 16 },
      head: [s.columns.map((c) => c.header)],
      body: s.rows.length ? s.rows.map((r) => r.map(fmt)) : [[{ content: 'Tidak ada data', colSpan: s.columns.length }]],
      foot: s.footer ? [s.footer.map(fmt)] : undefined,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, overflow: 'linebreak' },
      headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [232, 240, 235], textColor: 20, fontStyle: 'bold' },
      columnStyles,
      didParseCell: (data) => {
        if ((data.section === 'head' || data.section === 'foot') && s.columns[data.column.index]?.numeric) {
          data.cell.styles.halign = 'right';
        }
      },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Footer setiap halaman
  const pages = pdf.getNumberOfPages();
  const printed = `Dicetak ${formatDateTime(new Date().toISOString())} oleh ${printedBy}`;
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(printed, margin, pageH - 7);
    pdf.text(`Halaman ${i} dari ${pages}`, pageW - margin, pageH - 7, { align: 'right' });
  }

  triggerDownload(pdf.output('blob'), `${filename}.pdf`);
}
