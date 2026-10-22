import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { compliance, hhmm, punctuality, type ReportLine, type Totals } from "../../domain/services/attendance-report.service.ts";

type RGB = [number, number, number];
const NAVY: RGB = [25, 33, 58];
const COPPER: RGB = [201, 100, 58];
const INK2: RGB = [96, 104, 122];
const SOFT: RGB = [247, 247, 246];

export interface AttendanceReportPdfMeta {
  title: string;
  /** Período e âmbito («01/10/2026 – 22/10/2026 · Loja Porto»). */
  subtitle: string;
  issuedAt: Date;
  logo: string | null;
}

const pctLabel = (v: number | null) => (v === null ? "—" : `${v}%`);

/** PDF do relatório de assiduidade: A4 horizontal, resumo no topo e uma linha por pessoa (e período). */
export function renderAttendanceReportPdf(lines: ReportLine[], total: Totals, meta: AttendanceReportPdfMeta): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 12;
  if (meta.logo) {
    try {
      doc.addImage(meta.logo, "PNG", M, 9, 30, 8);
    } catch {
      // Sem logótipo: fica só o texto.
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(meta.title, meta.logo ? M + 34 : M, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK2);
  doc.text(meta.subtitle, meta.logo ? M + 34 : M, 20.5);
  doc.text(`Emitido em ${meta.issuedAt.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}`, W - M, 15, { align: "right" });

  // Resumo em cartões.
  const kpis: [string, string][] = [
    ["Trabalhado / planeado", `${hhmm(total.worked)} / ${hhmm(total.planned)}`],
    ["Cumprimento", pctLabel(compliance(total))],
    ["Atrasos", `${total.late} (${total.lateMinutes} min)`],
    ["Faltas", String(total.missing)],
    ["Saídas esquecidas", String(total.forgotten)],
    ["Pontualidade", pctLabel(punctuality(total))],
  ];
  const cw = (W - M * 2 - 5 * 3) / kpis.length;
  kpis.forEach(([label, value], i) => {
    const x = M + i * (cw + 3);
    doc.setFillColor(...SOFT);
    doc.roundedRect(x, 25, cw, 15, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK2);
    doc.text(label, x + 3, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(value, x + 3, 36.5);
    doc.setFont("helvetica", "normal");
  });

  const showPeriod = lines.some((l) => l.periodKey !== "total");
  const head = ["Colaborador", ...(showPeriod ? ["Período"] : []), "Planeado", "Trabalhado", "Diferença", "Cumprimento", "Dias", "Atrasos", "Faltas", "Esquecidas", "Ausências", "Pontualidade"];
  const body = lines.map((l) => {
    const t = l.totals;
    return [
      l.person.name,
      ...(showPeriod ? [l.periodLabel] : []),
      hhmm(t.planned),
      hhmm(t.worked),
      hhmm(t.worked - t.planned),
      pctLabel(compliance(t)),
      `${t.workedDays}/${t.plannedDays}`,
      t.late ? `${t.late} (${t.lateMinutes} min)` : "0",
      String(t.missing),
      String(t.forgotten),
      String(t.excused),
      pctLabel(punctuality(t)),
    ];
  });
  autoTable(doc, {
    startY: 45,
    head: [head],
    body,
    margin: { left: M, right: M },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, textColor: NAVY, lineColor: [226, 228, 232], lineWidth: 0.1 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [251, 251, 250] },
    columnStyles: Object.fromEntries(head.map((_, i) => [i, { halign: i < (showPeriod ? 2 : 1) ? "left" : "right" }])),
    didParseCell: (h) => {
      // Diferença negativa e faltas em cobre (o texto diz o valor; a cor só realça).
      if (h.section === "body" && h.column.index === (showPeriod ? 4 : 3) && String(h.cell.raw).startsWith("-")) h.cell.styles.textColor = COPPER;
    },
    didDrawPage: () => {
      const H = doc.internal.pageSize.getHeight();
      doc.setFontSize(7.5);
      doc.setTextColor(...INK2);
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, W - M, H - 6, { align: "right" });
      doc.text("Mezza ERP · Novo RH · Relatório de assiduidade", M, H - 6);
    },
  });
  return doc;
}
