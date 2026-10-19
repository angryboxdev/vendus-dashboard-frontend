import jsPDF from "jspdf";
import autoTable, { type CellHookData, type RowInput } from "jspdf-autotable";
import type { ExportCell, ExportLegendItem, ExportPresentation, ScheduleExport } from "../../domain/services/schedule-export.service.ts";

/**
 * PDF premium da escala (motor jsPDF + autotable, o mesmo do resto da app).
 * Vários colaboradores: A4 horizontal, secções por grupo, cabeçalhos
 * repetidos, linhas nunca cortadas. Um colaborador: A4 vertical, dia a dia.
 * Sem fotografias, sem horas nem totais, sem dados pessoais.
 */
export interface SchedulePdfMeta {
  /** Unidade (centro) da escala. */
  unit: string;
  /** «19/10/2026 – 25/10/2026». */
  weekLabel: string;
  organizedBy: string;
  presentation: ExportPresentation;
  /** Resumo dos filtros aplicados (vazio = todos). */
  filtersLabel: string;
  version: number;
  issuedAt: Date;
  /** Logótipo original (data URL PNG); sem ele, só o texto. */
  logo: string | null;
}

type RGB = [number, number, number];
const NAVY: RGB = [25, 33, 58];
const ORANGE: RGB = [214, 117, 73];
const INK2: RGB = [96, 104, 122];
const LINE: RGB = [226, 228, 232];
const SOFT: RGB = [247, 247, 246];
const WEEKDAY = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** Pastel do tipo de turno (cor clareada; o texto continua a identificar o turno). */
const pastel = (h: string): RGB => hex(h).map((c) => Math.round(c + (255 - c) * 0.65)) as RGB;
/** Tinta da etiqueta: a cor do tipo, escurecida (lê-se bem sobre o pastel e em cinzento). */
const deep = (h: string): RGB => hex(h).map((c) => Math.round(c * 0.5)) as RGB;

// Célula de um dia (coletivo): etiqueta do turno na cor do tipo, horário por baixo, área menor no fim.
const PILL_H = 5.2;
const TIME_H = 3.7;
const AREA_H = 3.4;
const GAP = 2.4;
const PAD = 2;
function assignmentHeight(c: ExportCell, presentation: ExportPresentation, withArea: boolean): number {
  const times = presentation === "full" && c.time ? c.time.split(" · ").length : 0;
  return PILL_H + 1 + times * TIME_H + (withArea && c.area ? AREA_H : 0);
}
function cellHeight(list: ExportCell[], presentation: ExportPresentation, withArea: boolean): number {
  return PAD * 2 + list.reduce((t, c, i) => t + assignmentHeight(c, presentation, withArea) + (i ? GAP : 0), 0);
}
function drawAssignments(doc: jsPDF, list: ExportCell[], presentation: ExportPresentation, withArea: boolean, x: number, y: number, w: number, h: number) {
  const total = cellHeight(list, presentation, withArea) - PAD * 2;
  let top = y + (h - total) / 2;
  const cx = x + w / 2;
  for (const c of list) {
    const label = `${presentation === "codes" ? c.code : c.name}${c.draft ? " *" : ""}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const pw = Math.min(w - 3, doc.getTextWidth(label) + 6);
    const [fr, fg, fb] = c.color ? pastel(c.color) : SOFT;
    doc.setFillColor(fr, fg, fb);
    doc.roundedRect(cx - pw / 2, top, pw, PILL_H, 1.4, 1.4, "F");
    const [ir, ig, ib] = c.color ? deep(c.color) : NAVY;
    doc.setTextColor(ir, ig, ib);
    doc.text(label, cx, top + PILL_H / 2 + 1.1, { align: "center", maxWidth: w - 4 });
    top += PILL_H + 1;
    if (presentation === "full" && c.time) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...NAVY);
      for (const line of c.time.split(" · ")) {
        top += TIME_H;
        doc.text(line, cx, top - 0.9, { align: "center" });
      }
    }
    if (withArea && c.area) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...INK2);
      top += AREA_H;
      doc.text(c.area, cx, top - 0.8, { align: "center", maxWidth: w - 2 });
    }
    top += GAP;
  }
}
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const weekday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const stamp = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Texto de uma atribuição numa célula. */
function cellText(c: ExportCell, presentation: ExportPresentation, withArea = true): string {
  if (c.kind === "day_off") return "Folga";
  const area = withArea && c.area ? `\n${c.area}` : "";
  const draft = c.draft ? " *" : "";
  return presentation === "codes" ? `${c.code}${draft}${area}` : `${c.name}${draft}\n${c.time}${area}`;
}

function header(doc: jsPDF, meta: SchedulePdfMeta, title: string, subtitle: string, right: string[], draft: boolean) {
  const W = doc.internal.pageSize.getWidth();
  let x = 12;
  if (meta.logo) {
    // A mesma imagem em todas as páginas (alias): o ficheiro não cresce por página.
    doc.addImage(meta.logo, "PNG", 12, 7, 24, 13.5, "brand-logo", "FAST");
    x = 42;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(title, x, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK2);
  doc.text(subtitle, x, 19);
  doc.setFontSize(8.5);
  right.forEach((line, i) => doc.text(line, W - 12, 11 + i * 4.6, { align: "right" }));
  if (draft) {
    doc.setFillColor(254, 236, 228);
    doc.setDrawColor(...ORANGE);
    const label = "RASCUNHO — NÃO PUBLICAR";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const w = doc.getTextWidth(label) + 6;
    doc.roundedRect(W - 12 - w, 11 + right.length * 4.6 - 1, w, 6, 1.5, 1.5, "FD");
    doc.setTextColor(...ORANGE);
    doc.text(label, W - 12 - w / 2, 11 + right.length * 4.6 + 3, { align: "center" });
  }
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.7);
  doc.line(12, 25, W - 12, 25);
}

/** Legenda das siglas usadas (em cada página, por baixo do conteúdo). Devolve a altura ocupada. */
function legendHeight(doc: jsPDF, items: ExportLegendItem[], width: number): number {
  if (!items.length) return 0;
  doc.setFontSize(7.5);
  let lines = 1;
  let x = 0;
  for (const it of items) {
    const w = doc.getTextWidth(`${it.code}  ${it.name}${it.time ? ` ${it.time}` : ""}`) + 10;
    if (x + w > width) {
      lines++;
      x = 0;
    }
    x += w;
  }
  return 6 + lines * 4.6;
}
function drawLegend(doc: jsPDF, items: ExportLegendItem[], y: number) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text("Legenda", 12, y);
  let x = 12;
  let row = y + 4.6;
  for (const it of items) {
    const label = `${it.name}${it.time ? ` ${it.time}` : ""}`;
    doc.setFont("helvetica", "bold");
    const cw = Math.max(7, doc.getTextWidth(it.code) + 3);
    doc.setFont("helvetica", "normal");
    const w = cw + doc.getTextWidth(label) + 7;
    if (x + w > W - 12) {
      x = 12;
      row += 4.6;
    }
    const [r, g, b] = it.color ? pastel(it.color) : SOFT;
    doc.setFillColor(r, g, b);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, row - 3.2, cw, 4.2, 0.8, 0.8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(it.code, x + cw / 2, row - 0.2, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK2);
    doc.text(label, x + cw + 1.5, row - 0.2);
    x += w;
  }
}

function footer(doc: jsPDF, meta: SchedulePdfMeta, draft: boolean, legend: ExportLegendItem[], legendH: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (legendH) drawLegend(doc, legend, H - 14 - legendH + 3);
    // Notas de leitura: o que é «—» e o que é «*» (este só quando há turnos por publicar).
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK2);
    doc.text("—   Sem turno atribuído", 12, H - 11.5);
    if (draft) doc.text("*   Turno por publicar", 60, H - 11.5);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(12, H - 9, W - 12, H - 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...INK2);
    const state = draft ? "Rascunho — não publicar" : `Publicado · versão ${meta.version}`;
    doc.text(`Emitido em ${stamp(meta.issuedAt)} · ${state}`, 12, H - 5);
    doc.text(`Página ${i} de ${total}`, W - 12, H - 5, { align: "right" });
  }
}

/** Vários colaboradores: A4 horizontal, uma secção por grupo. */
function collective(data: ScheduleExport, meta: SchedulePdfMeta): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const legend = meta.presentation === "codes" ? data.legend : [];
  const legendH = legendHeight(doc, legend, W - 24);
  const bottom = 16 + legendH;
  const right = [`Organizado por: ${meta.organizedBy}`, meta.presentation === "codes" ? "Apresentação: siglas + legenda" : "Apresentação: horários completos"];
  const drawHeader = () => header(doc, meta, "Escala semanal", `${meta.unit} · ${meta.weekLabel}${meta.filtersLabel ? ` · ${meta.filtersLabel}` : ""}`, right, data.hasDraft);
  const head = [["Colaborador", ...data.days.map((d) => `${SHORT[weekday(d)]} ${dm(d)}`)]];
  const dayW = (W - 24 - 46) / data.days.length;
  let y = 31;
  drawHeader();
  for (const g of data.groups) {
    if (g.title !== null) {
      // Título do grupo nunca fica sozinho no fim da página.
      if (y > H - bottom - 30) {
        doc.addPage();
        drawHeader();
        y = 31;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      doc.text(g.title, 12, y + 3);
      doc.setFillColor(...ORANGE);
      doc.rect(12, y + 4.6, 10, 0.7, "F");
      y += 8;
    }
    const cells = new Map<string, ExportCell[]>();
    const body: RowInput[] = g.rows.map((r, ri) => [
      { content: r.position && data.groupBy !== "position" ? `${r.name}\n${r.position}` : r.name },
      ...r.days.map((list, di) => {
        cells.set(`${ri}:${di}`, list);
        // Organizado por área: a área já é o título da secção (não se repete em cada dia).
        return { content: list.length ? list.map((c) => cellText(c, meta.presentation, data.groupBy !== "area")).join("\n\n") : "—" };
      }),
    ]);
    autoTable(doc, {
      head,
      body,
      startY: y,
      margin: { top: 31, left: 12, right: 12, bottom },
      theme: "grid",
      showHead: "everyPage",
      rowPageBreak: "avoid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, textColor: NAVY, lineColor: LINE, lineWidth: 0.2, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      columnStyles: { 0: { cellWidth: 46, fontStyle: "bold", halign: "left" }, ...Object.fromEntries(data.days.map((_, i) => [i + 1, { cellWidth: dayW, halign: "center" }])) },
      alternateRowStyles: { fillColor: [252, 252, 251] },
      didParseCell: (h: CellHookData) => {
        if (h.section !== "body" || h.column.index === 0) return;
        const list = cells.get(`${h.row.index}:${h.column.index - 1}`) ?? [];
        if (!list.length) {
          h.cell.styles.textColor = [170, 174, 182];
        } else if (list.every((c) => c.kind === "day_off")) {
          h.cell.styles.textColor = INK2;
          h.cell.styles.fontStyle = "italic";
        } else {
          // Desenhada à mão em didDrawCell (etiqueta + horário + área); aqui só a altura certa.
          h.cell.styles.minCellHeight = cellHeight(list.filter((c) => c.kind === "shift"), meta.presentation, data.groupBy !== "area") + (list.some((c) => c.kind === "day_off") ? 5 : 0);
          h.cell.text = [];
        }
      },
      didDrawCell: (h: CellHookData) => {
        if (h.section !== "body" || h.column.index === 0) return;
        const list = cells.get(`${h.row.index}:${h.column.index - 1}`) ?? [];
        const shifts = list.filter((c) => c.kind === "shift");
        if (!shifts.length) return;
        const off = list.some((c) => c.kind === "day_off");
        drawAssignments(doc, shifts, meta.presentation, data.groupBy !== "area", h.cell.x, h.cell.y, h.cell.width, h.cell.height - (off ? 5 : 0));
        if (off) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.5);
          doc.setTextColor(...INK2);
          doc.text("Folga", h.cell.x + h.cell.width / 2, h.cell.y + h.cell.height - 2.2, { align: "center" });
        }
      },
      didDrawPage: (h) => {
        if (h.pageNumber > 1 || doc.getNumberOfPages() > 1) drawHeader();
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
  footer(doc, meta, data.hasDraft, legend, legendH);
  return doc;
}

/** Um colaborador: A4 vertical, um dia por linha (vários turnos no mesmo dia em linhas separadas). */
function individual(data: ScheduleExport, meta: SchedulePdfMeta): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const row = data.groups.flatMap((g) => g.rows)[0]!;
  // Junta o que o agrupamento repartiu (a mesma pessoa pode estar em vários grupos).
  const perDay = data.days.map((_, i) => data.groups.flatMap((g) => g.rows).flatMap((r) => r.days[i] ?? []));
  const legend = meta.presentation === "codes" ? data.legend : [];
  const legendH = legendHeight(doc, legend, W - 24);
  header(doc, meta, "Escala semanal", `${meta.unit} · ${meta.weekLabel}`, [], data.hasDraft);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(row.name, 12, 35);
  if (row.position) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK2);
    doc.text(row.position, 12, 40.5);
  }
  const body: RowInput[] = [];
  const kinds: (ExportCell | null)[] = [];
  data.days.forEach((d, i) => {
    const list = perDay[i]!;
    const day = { content: `${WEEKDAY[weekday(d)]}\n${dm(d)}`, rowSpan: Math.max(1, list.length), styles: { fontStyle: "bold" as const, valign: "middle" as const } };
    if (!list.length) {
      body.push([day, { content: "Sem turno atribuído" }, { content: "—" }, { content: "—" }]);
      kinds.push(null);
      return;
    }
    list.forEach((c, k) => {
      const turno = c.kind === "day_off" ? "Folga" : meta.presentation === "codes" ? `${c.code} — ${c.name}${c.draft ? " *" : ""}` : `${c.name}${c.draft ? " *" : ""}`;
      const cols = [{ content: turno }, { content: c.kind === "day_off" ? "—" : c.time }, { content: c.area ?? "—" }];
      body.push(k === 0 ? [day, ...cols] : cols);
      kinds.push(c);
    });
  });
  autoTable(doc, {
    head: [["Dia", "Turno", "Entrada – Saída", "Área"]],
    body,
    startY: row.position ? 46 : 41,
    margin: { left: 12, right: 12, bottom: 16 + legendH },
    theme: "grid",
    rowPageBreak: "avoid",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 3, textColor: NAVY, lineColor: LINE, lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 32 }, 2: { cellWidth: 52 }, 3: { cellWidth: 38 } },
    didParseCell: (h: CellHookData) => {
      if (h.section !== "body") return;
      const c = kinds[h.row.index];
      if (h.column.index === 0 && h.cell.raw && typeof h.cell.raw === "object" && "rowSpan" in h.cell.raw) return;
      if (c === null || c === undefined) h.cell.styles.textColor = [150, 154, 162];
      else if (c.kind === "day_off") h.cell.styles.fontStyle = "italic";
      else if (meta.presentation === "codes" && c.color && h.cell.text.join("").startsWith(c.code)) h.cell.styles.fillColor = pastel(c.color);
    },
  });
  if (perDay.some((l) => l.some((c) => c.nextDay))) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK2);
    doc.text("(+1 dia) = o turno termina no dia seguinte.", 12, y);
  }
  footer(doc, meta, data.hasDraft, legend, legendH);
  return doc;
}

export function renderSchedulePdf(data: ScheduleExport, meta: SchedulePdfMeta): jsPDF {
  return data.individual ? individual(data, meta) : collective(data, meta);
}

/** Logótipo original da marca (assets do projeto) como data URL; null se não existir. */
export async function loadBrandLogo(): Promise<string | null> {
  try {
    const res = await fetch("/angry-box-wordmark.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
