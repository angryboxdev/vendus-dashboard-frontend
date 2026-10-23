import type { LeaveType, MyLeave, MyRequest, MyShift, PortalHome, PunchKind, PunchResult } from "../entities/portal.ts";

/**
 * Portal ligado ao Novo RH (Fase 2): converte as respostas de `/api/me/clock`,
 * `/api/me/roster`, `/api/me/absences` e `/api/me/profile` no contrato que os
 * ecrãs do Portal já usam. Funções puras — o adapter HTTP só lê e chama.
 */

export interface NovoRhSegment {
  start: string;
  end: string;
}

export interface NovoRhShift {
  id: string;
  workDate: string;
  kind: "shift" | "day_off";
  segments: NovoRhSegment[];
  /** Campos aditivos do servidor (podem faltar numa versão antiga). */
  locationId?: string | null;
  locationName?: string | null;
  areaName?: string | null;
  template?: { name: string; abbreviation: string; color: string | null } | null;
}

export interface NovoRhClockStatus {
  employeeId: string;
  timeZone: string;
  /** Último tipo de marcação: "work", pausas ou "off". */
  state: string;
  since: string | null;
}

export interface NovoRhProfile {
  employeeId: string;
  firstName: string | null;
  fullName: string;
  locationName: string | null;
}

export interface NovoRhAbsence {
  id: string;
  typeId: string;
  typeName: string;
  typeCategory: string | null;
  startDate: string;
  endDate: string;
  amount: number;
  unit: "days" | "hours";
  status: "pending" | "approved" | "rejected" | "cancelled";
  comment: string | null;
  attachment: { name: string; mime: string } | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface PortalTypeIds {
  dayOffTypeId: string | null;
  justifiedTypeId: string | null;
}

/** Data local (AAAA-MM-DD) de um instante no fuso indicado. */
export function localDateIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Hora local (HH:mm) de um instante no fuso indicado. */
export function localTimeIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-PT", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** Passa da meia-noite: um período acaba antes de começar, ou o seguinte começa antes do anterior. */
export function crossesMidnight(segments: NovoRhSegment[]): boolean {
  let prev = "";
  for (const s of segments) {
    if (s.start < prev || s.end <= s.start) return true;
    prev = s.end;
  }
  return false;
}

/**
 * Escala publicada no formato do Portal: turnos (todos os períodos) e folgas;
 * ordenada por dia e hora. O centro vem do turno (área ou escala); sem ele, o da ficha.
 */
export function shiftsFromRoster(shifts: NovoRhShift[], profileLocationName: string | null): MyShift[] {
  return shifts
    .filter((s) => s.kind === "day_off" || s.segments.length > 0)
    .map((s): MyShift => {
      const [first, second] = s.segments;
      return {
        id: s.id,
        workDate: s.workDate,
        kind: s.kind,
        startTime: first?.start ?? "",
        endTime: first?.end ?? "",
        endsNextDay: crossesMidnight(s.segments),
        secondStartTime: second?.start ?? null,
        secondEndTime: second?.end ?? null,
        segments: s.segments,
        locationId: s.locationId ?? "",
        locationName: s.locationName ?? profileLocationName ?? "",
        areaName: s.areaName ?? null,
        template: s.template ?? null,
      };
    })
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.startTime.localeCompare(b.startTime));
}

/**
 * Início do Portal. O Novo RH permite várias entradas e saídas no mesmo dia e
 * é o servidor que recusa (regras de picagem): fora de trabalho a ação é
 * sempre «Registar entrada»; a trabalhar ou em pausa, «Registar saída».
 */
export function homeFromNovoRh(profile: NovoRhProfile, status: NovoRhClockStatus, shifts: MyShift[], today: string): PortalHome {
  const working = status.state !== "off";
  const shortName = profile.firstName?.trim() || profile.fullName.split(/\s+/)[0] || profile.fullName;
  return {
    employee: { id: profile.employeeId, shortName },
    nextShift: shifts.find((s) => s.workDate >= today && s.kind !== "day_off") ?? null,
    punch: {
      state: working ? "in" : "not_in",
      // Hora local ("20:12"; de outro dia, "20/10 20:12") — nunca o ISO do servidor.
      since: working && status.since ? sinceLabel(status.since, status.timeZone, today) : null,
      action: working ? "out" : "in",
      blockedReason: null,
      // A localização pede-se sempre: é o servidor (regras «Exigir localização» / «Bloquear fora da zona») que decide.
      geofencePolicy: "warn",
    },
  };
}

/** Hora de uma marcação no fuso da organização; com o dia se não for hoje. */
export function sinceLabel(iso: string, timeZone: string, today: string): string {
  const date = localDateIn(iso, timeZone);
  const time = localTimeIn(iso, timeZone);
  return date === today ? time : `${date.slice(8, 10)}/${date.slice(5, 7)} ${time}`;
}

export function punchSegment(kind: PunchKind): "work" | "off" {
  return kind === "in" ? "work" : "off";
}

export function punchResultFromNovoRh(kind: PunchKind, event: { occurredAt: string }, duplicate: boolean, timeZone: string): PunchResult {
  return {
    kind,
    time: localTimeIn(event.occurredAt, timeZone),
    serverAt: event.occurredAt,
    geofence: { status: "not_required", reason: null, distanceM: null },
    flagged: false,
    replay: duplicate,
  };
}

const CATEGORY_TO_LEAVE: Record<string, LeaveType> = { vacation: "vacation", medical: "sick_leave", compensation: "compensatory" };

/** Ausências aprovadas que tocam o ano (o tipo «Falta justificada» conta como justificada). */
export function leaveFromAbsences(requests: NovoRhAbsence[], year: number, types: PortalTypeIds): MyLeave {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const entries = requests
    .filter((r) => r.status === "approved" && r.startDate <= to && r.endDate >= from)
    .map((r) => ({
      id: r.id,
      type:
        r.typeId === types.justifiedTypeId
          ? ("justified" as const)
          : r.typeCategory === null
            ? ("other" as const)
            : (CATEGORY_TO_LEAVE[r.typeCategory] ?? ("authorized_absence" as const)),
      startDate: r.startDate,
      endDate: r.endDate,
      workingDays: r.unit === "days" ? r.amount : 0,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { year, entries };
}

/** Pedidos do Portal = pedidos dos tipos «Folga» e «Falta justificada»; o motivo vai no comentário. */
export function requestsFromAbsences(requests: NovoRhAbsence[], types: PortalTypeIds): MyRequest[] {
  return requests
    .filter((r) => r.typeId === types.dayOffTypeId || r.typeId === types.justifiedTypeId)
    .map((r) => requestFromAbsence(r, types))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function requestFromAbsence(r: NovoRhAbsence, types: PortalTypeIds): MyRequest {
  const { label, text } = splitReason(r.comment);
  return {
    id: r.id,
    kind: r.typeId === types.justifiedTypeId ? "justify_absence" : "day_off",
    status: r.status,
    workShiftId: null,
    startDate: r.startDate,
    endDate: r.endDate,
    reasonLabel: label ?? r.typeName,
    reasonText: text,
    attachmentName: r.attachment?.name ?? null,
    decisionNote: null,
    decidedAt: r.decidedAt ?? null,
    createdAt: r.createdAt,
  };
}

const REASON_SEP = " — ";

/** Comentário do pedido: «<motivo> — <texto livre>» (o Novo RH guarda um só comentário). */
export function reasonComment(label: string, text: string | null): string {
  const t = text?.trim();
  return t ? `${label}${REASON_SEP}${t}` : label;
}

export function splitReason(comment: string | null): { label: string | null; text: string | null } {
  if (!comment) return { label: null, text: null };
  const i = comment.indexOf(REASON_SEP);
  if (i < 0) return { label: comment, text: null };
  return { label: comment.slice(0, i), text: comment.slice(i + REASON_SEP.length) || null };
}
