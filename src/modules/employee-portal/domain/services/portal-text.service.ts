import type { PortalHome, PortalShift, PunchRefusal, PunchResult } from "../entities/portal.ts";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Hoje", "Amanhã" ou "Qui 09/10". */
export function dayLabel(workDate: string, today: string): string {
  if (workDate === today) return "Hoje";
  if (workDate === addDays(today, 1)) return "Amanhã";
  const [y, m, d] = workDate.split("-").map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "09:00–17:00" ou "11:00–15:00 · 19:00–23:00". */
export function shiftHours(shift: Pick<PortalShift, "startTime" | "endTime" | "secondStartTime" | "secondEndTime">): string {
  const first = `${shift.startTime}–${shift.endTime}`;
  return shift.secondStartTime && shift.secondEndTime ? `${first} · ${shift.secondStartTime}–${shift.secondEndTime}` : first;
}

export function punchStateLabel(punch: PortalHome["punch"]): string {
  if (punch.state === "in") return `Entrada registada às ${punch.since}`;
  if (punch.state === "done") return punch.since ? `Saída registada às ${punch.since}` : "Turno de hoje concluído";
  if (punch.state === "no_shift") return "Sem turno hoje";
  return "Ainda não entrou";
}

export function refusalMessage(refusal: PunchRefusal): string {
  switch (refusal.code) {
    case "TOO_EARLY":
      return `O turno começa às ${refusal.shiftStart}. Pode registar a entrada a partir das ${refusal.opensAt}.`;
    case "SHIFT_ENDED":
      return "O turno de hoje já terminou.";
    case "DAY_COMPLETE":
      return "Entrada e saída de hoje já estão registadas.";
    case "ALREADY_IN":
      return `A entrada já está registada (${refusal.since}).`;
    case "NOT_IN":
      return "Ainda não registou a entrada.";
    case "TOO_SOON":
      return "Aguarde um minuto antes de registar a saída.";
    case "NO_SHIFT":
      return "Não tem turno publicado para hoje.";
  }
}

/** Mensagem de confirmação depois de uma picagem aceite. */
export function punchSuccessMessage(result: PunchResult): string {
  const base = `${result.kind === "in" ? "Entrada" : "Saída"} registada às ${result.time}`;
  if (!result.flagged) return base;
  if (result.geofence.status === "outside") return `${base}. Ficou assinalada: estava fora da zona do local.`;
  return `${base}. Ficou assinalada: não foi possível confirmar a localização.`;
}

/** Explicação curta, antes de pedir o GPS pela primeira vez (minimização / transparência). */
export const LOCATION_NOTICE =
  "Para registar a entrada ou saída, o Portal lê a localização do telemóvel uma única vez, no momento do toque. Não há acompanhamento contínuo nem fora da picagem.";
