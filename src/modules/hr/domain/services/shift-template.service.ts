import type { ShiftTemplate, ShiftTemplatePayload } from "../entities/shift-template.ts";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 480 → "8h"; 450 → "7h 30min"; 30 → "30min". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}min`;
}

/** "08:00 – 16:00" ou "12:00 – 16:00 · 18:00 – 23:00". */
export function templateTimeLabel(t: Pick<ShiftTemplate, "startTime" | "endTime" | "secondStartTime" | "secondEndTime">): string {
  const first = `${t.startTime} – ${t.endTime}`;
  return t.secondStartTime && t.secondEndTime ? `${first} · ${t.secondStartTime} – ${t.secondEndTime}` : first;
}

/** "8h" no direto; "11h (9h trabalho)" no repartido, como no mockup. */
export function templateDurationLabel(t: Pick<ShiftTemplate, "kind" | "workMinutes" | "spanMinutes">): string {
  return t.kind === "split" ? `${formatMinutes(t.spanMinutes)} (${formatMinutes(t.workMinutes)} trabalho)` : formatMinutes(t.workMinutes);
}

/** Num turno direto, um fim igual ou anterior ao início significa que termina no dia seguinte (ex.: 16:00–00:00). */
export function endsNextDayFor(startTime: string, endTime: string): boolean {
  return toMinutes(endTime) <= toMinutes(startTime);
}

export interface ShiftTemplateForm {
  name: string;
  description: string;
  color: string;
  kind: "direct" | "split";
  startTime: string;
  endTime: string;
  secondStartTime: string;
  secondEndTime: string;
  breakMinutes: number;
  locationId: string;
}

/**
 * Valida o formulário com a mesma regra do backend (\`assertShiftShape\`) e
 * devolve o payload, ou a primeira mensagem de erro.
 */
export function toShiftTemplatePayload(form: ShiftTemplateForm): { payload: ShiftTemplatePayload } | { error: string } {
  if (form.name.trim().length === 0) return { error: "Indique o nome do modelo." };
  if (!form.startTime || !form.endTime) return { error: "Indique a hora de início e de fim." };
  const split = form.kind === "split";
  if (split) {
    if (!form.secondStartTime || !form.secondEndTime) return { error: "Indique o 2.º período do turno repartido." };
    if (toMinutes(form.startTime) >= toMinutes(form.endTime)) return { error: "No 1.º período, o início tem de ser antes do fim." };
    if (toMinutes(form.secondStartTime) < toMinutes(form.endTime)) return { error: "O 2.º período não pode sobrepor o 1.º." };
    if (toMinutes(form.secondStartTime) >= toMinutes(form.secondEndTime)) return { error: "No 2.º período, o início tem de ser antes do fim." };
  }
  return {
    payload: {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color || null,
      startTime: form.startTime,
      endTime: form.endTime,
      endsNextDay: split ? false : endsNextDayFor(form.startTime, form.endTime),
      secondStartTime: split ? form.secondStartTime : null,
      secondEndTime: split ? form.secondEndTime : null,
      breakMinutes: form.breakMinutes,
      locationId: form.locationId || null,
    },
  };
}

/** Minutos de trabalho do formulário (para a "Duração total" ao vivo); null se ainda inválido. */
export function formWorkMinutes(form: ShiftTemplateForm): number | null {
  const result = toShiftTemplatePayload({ ...form, name: form.name || "x" });
  if ("error" in result) return null;
  const p = result.payload;
  const first = p.endsNextDay ? 24 * 60 - toMinutes(p.startTime) + toMinutes(p.endTime) : toMinutes(p.endTime) - toMinutes(p.startTime);
  const second = p.secondStartTime && p.secondEndTime ? toMinutes(p.secondEndTime) - toMinutes(p.secondStartTime) : 0;
  return Math.max(0, first + second - p.breakMinutes);
}

export function emptyShiftTemplateForm(): ShiftTemplateForm {
  return {
    name: "",
    description: "",
    color: "#3B82F6",
    kind: "direct",
    startTime: "08:00",
    endTime: "16:00",
    secondStartTime: "18:00",
    secondEndTime: "23:00",
    breakMinutes: 0,
    locationId: "",
  };
}

/** Formulário a partir de um modelo — para Editar, ou Duplicar (com `copy`: "Nome (cópia)"). */
export function formFromTemplate(t: ShiftTemplate, copy = false): ShiftTemplateForm {
  return {
    name: copy ? `${t.name} (cópia)` : t.name,
    description: t.description ?? "",
    color: t.color ?? "",
    kind: t.kind,
    startTime: t.startTime,
    endTime: t.endTime,
    secondStartTime: t.secondStartTime ?? "18:00",
    secondEndTime: t.secondEndTime ?? "23:00",
    breakMinutes: t.breakMinutes,
    locationId: t.locationId ?? "",
  };
}
