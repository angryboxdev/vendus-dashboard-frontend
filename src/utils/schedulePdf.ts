import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  LEAVE_TYPE_LABELS,
  type HrEmployee,
  type HrLeaveRequest,
  type HrWorkShift,
} from "../pages/hr/hr.types";

// ── Brand palette ────────────────────────────────────────────────────────────

const RED: [number, number, number] = [193, 49, 26];
const CREAM: [number, number, number] = [240, 232, 213];
const ROW_ALT: [number, number, number] = [252, 251, 249];
const GRAY: [number, number, number] = [150, 150, 150];

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// A4 layout: two side-by-side tables
// Page: 210mm. Left margin: 7, right margin: 7, gap: 6
// Each table width: (210 - 7 - 7 - 6) / 2 = 95mm
const TABLE_W = 95;
const LEFT_X = 7;
const RIGHT_X = LEFT_X + TABLE_W + 6; // = 108
const START_Y = 40;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchLogoBase64(): Promise<string> {
  const res = await fetch("/image.png");
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function drawHeader(doc: jsPDF, logo: string, title: string, subtitle: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...RED);
  doc.rect(0, 0, W, 36, "F");
  doc.addImage(logo, "PNG", 8, 5, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...CREAM);
  doc.text("Angry Box", 42, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(title, 42, 23);
  doc.setFontSize(8);
  doc.setTextColor(200, 185, 165);
  doc.text(subtitle, 42, 30);
}

function addFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(220, 215, 210);
  doc.setLineWidth(0.2);
  doc.line(14, H - 11, W - 14, H - 11);
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-PT")} · Angry Box`,
    W / 2,
    H - 6,
    { align: "center" },
  );
}

function daysInMonth(year: number, month: number): string[] {
  const count = new Date(year, month, 0).getDate();
  return Array.from(
    { length: count },
    (_, i) =>
      `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
  );
}

function fmtDayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const wd = DAYS_PT[d.getDay()];
  const [, m, day] = iso.split("-");
  return `${wd} ${day}/${m}`;
}

function expandLeavesByDate(
  leaves: HrLeaveRequest[],
  from: string,
  to: string,
): Map<string, HrLeaveRequest[]> {
  const map = new Map<string, HrLeaveRequest[]>();
  for (const l of leaves) {
    let cur = l.startDate;
    while (cur <= l.endDate && cur <= to) {
      if (cur >= from) {
        const arr = map.get(cur) ?? [];
        arr.push(l);
        map.set(cur, arr);
      }
      const d = new Date(cur + "T12:00:00");
      d.setDate(d.getDate() + 1);
      cur = d.toISOString().slice(0, 10);
    }
  }
  return map;
}

type CellStyles = {
  textColor?: [number, number, number];
  fontStyle?: "normal" | "bold" | "italic" | "bolditalic";
};

function cell(content: string, styles: CellStyles = {}): { content: string; styles: CellStyles } {
  return { content, styles };
}

const TABLE_STYLES = {
  theme: "plain" as const,
  headStyles: {
    fillColor: RED,
    textColor: CREAM,
    fontStyle: "bold" as const,
    fontSize: 9,
    cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
  },
  bodyStyles: { fontSize: 8, cellPadding: 2 },
  alternateRowStyles: { fillColor: ROW_ALT },
  styles: { lineColor: [230, 225, 218] as [number, number, number], lineWidth: 0.1 },
};

// ── General schedule PDF ─────────────────────────────────────────────────────
// Layout: 1 row per day, 1 column per employee — fits the full month on 1 page.

export async function exportGeneralSchedulePdf(params: {
  year: number;
  month: number;
  shifts: HrWorkShift[];
  leaves: HrLeaveRequest[];
  employees: HrEmployee[];
}) {
  const { year, month, shifts, leaves, employees } = params;
  const logo = await fetchLogoBase64();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  drawHeader(doc, logo, "Escala Geral", `${MONTHS_PT[month - 1]} ${year}`);

  const days = daysInMonth(year, month);
  const sorted = [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Index shifts by "date:employeeId"
  const shiftsByKey = new Map<string, HrWorkShift[]>();
  for (const s of shifts) {
    if (s.attendance?.status === "cancelled") continue;
    const key = `${s.workDate}:${s.employeeId}`;
    const arr = shiftsByKey.get(key) ?? [];
    arr.push(s);
    shiftsByKey.set(key, arr);
  }
  for (const arr of shiftsByKey.values()) {
    arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  // Index leaves by "date:employeeId"
  const leavesByKey = new Map<string, HrLeaveRequest[]>();
  for (const l of leaves) {
    let cur = l.startDate;
    while (cur <= l.endDate && cur <= days[days.length - 1]) {
      if (cur >= days[0]) {
        const key = `${cur}:${l.employeeId}`;
        const arr = leavesByKey.get(key) ?? [];
        arr.push(l);
        leavesByKey.set(key, arr);
      }
      const d = new Date(cur + "T12:00:00");
      d.setDate(d.getDate() + 1);
      cur = d.toISOString().slice(0, 10);
    }
  }

  // Header: Dia + first name of each employee
  const head = [["Dia", ...sorted.map((e) => e.fullName.split(" ")[0])]];

  // Body: 1 row per day
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any[][] = days.map((iso) => {
    const dayStr = fmtDayLabel(iso);
    const cols = sorted.map((emp) => {
      const empShifts = shiftsByKey.get(`${iso}:${emp.id}`) ?? [];
      const empLeaves = leavesByKey.get(`${iso}:${emp.id}`) ?? [];

      if (empShifts.length === 0 && empLeaves.length === 0) {
        return cell("Folga", { textColor: GRAY });
      }

      const lines = [
        ...empShifts.map((s) => `${s.startTime}–${s.endTime}`),
        ...empLeaves.map((l) => LEAVE_TYPE_LABELS[l.type]),
      ].join("\n");

      return cell(lines);
    });

    return [cell(dayStr, { fontStyle: "bold" }), ...cols];
  });

  // Column widths: Dia=28mm, remaining split equally among employees
  // Usable width = 210 - 7 - 7 = 196mm
  const empColW = Math.floor((196 - 28) / sorted.length);
  const columnStyles: Record<number, { cellWidth: number }> = { 0: { cellWidth: 28 } };
  for (let i = 1; i <= sorted.length; i++) {
    columnStyles[i] = { cellWidth: empColW };
  }

  autoTable(doc, {
    ...TABLE_STYLES,
    startY: START_Y,
    margin: { left: 7, right: 7 },
    head,
    body,
    columnStyles,
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
  });

  addFooter(doc);
  doc.save(`escala-geral-${year}-${String(month).padStart(2, "0")}.pdf`);
}

// ── Individual schedule PDF ───────────────────────────────────────────────────

export async function exportEmployeeSchedulePdf(params: {
  year: number;
  month: number;
  employee: HrEmployee;
  shifts: HrWorkShift[];
  leaves: HrLeaveRequest[];
}) {
  const { year, month, employee, shifts, leaves } = params;
  const logo = await fetchLogoBase64();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  drawHeader(doc, logo, `Escala — ${employee.fullName}`, `${MONTHS_PT[month - 1]} ${year}`);

  const days = daysInMonth(year, month);
  const mid = Math.ceil(days.length / 2);

  const shiftsByDate = new Map<string, HrWorkShift[]>();
  for (const s of shifts) {
    if (s.attendance?.status === "cancelled") continue;
    if (s.employeeId !== employee.id) continue;
    const arr = shiftsByDate.get(s.workDate) ?? [];
    arr.push(s);
    shiftsByDate.set(s.workDate, arr);
  }
  for (const arr of shiftsByDate.values()) {
    arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const leavesByDate = expandLeavesByDate(
    leaves.filter((l) => l.employeeId === employee.id),
    days[0],
    days[days.length - 1],
  );

  // Individual: col widths sum to TABLE_W (95mm): 36 + 59 = 95
  const colStyles = { 0: { cellWidth: 36 }, 1: { cellWidth: 59 } };

  function buildIndividualBody(slice: string[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any[][] = [];
    for (const iso of slice) {
      const dayStr = fmtDayLabel(iso);
      const dayShifts = shiftsByDate.get(iso) ?? [];
      const dayLeaves = leavesByDate.get(iso) ?? [];

      if (dayShifts.length === 0 && dayLeaves.length === 0) {
        body.push([
          cell(dayStr, { fontStyle: "bold", textColor: GRAY }),
          cell("Folga", { textColor: GRAY }),
        ]);
        continue;
      }
      let first = true;
      for (const s of dayShifts) {
        body.push([
          cell(first ? dayStr : "", first ? { fontStyle: "bold" } : { textColor: [210, 210, 210] }),
          cell(`${s.startTime} – ${s.endTime}`),
        ]);
        first = false;
      }
      for (const l of dayLeaves) {
        body.push([
          cell(first ? dayStr : "", first ? { fontStyle: "bold" } : { textColor: [210, 210, 210] }),
          cell(LEAVE_TYPE_LABELS[l.type], { textColor: [100, 100, 160] }),
        ]);
        first = false;
      }
    }
    return body;
  }

  // Left table
  autoTable(doc, {
    ...TABLE_STYLES,
    startY: START_Y,
    margin: { left: LEFT_X, right: 210 - LEFT_X - TABLE_W },
    head: [["Dia", "Turno"]],
    body: buildIndividualBody(days.slice(0, mid)),
    columnStyles: colStyles,
  });

  // Right table
  autoTable(doc, {
    ...TABLE_STYLES,
    startY: START_Y,
    margin: { left: RIGHT_X, right: 210 - RIGHT_X - TABLE_W },
    head: [["Dia", "Turno"]],
    body: buildIndividualBody(days.slice(mid)),
    columnStyles: colStyles,
  });

  addFooter(doc);

  const safeName = employee.fullName.toLowerCase().replace(/\s+/g, "-");
  doc.save(`escala-${safeName}-${year}-${String(month).padStart(2, "0")}.pdf`);
}
