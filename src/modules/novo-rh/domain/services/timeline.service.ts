import type { Segment } from "../entities/attendance.ts";
import { dateIn } from "./attendance.service.ts";

/**
 * Linha do dia (0–24 h) — só posiciona as faixas que o motor de ponto já
 * apurou (`segments`); não recalcula horas nem pausas. Serve o «Dia da equipa»
 * e o Ponto da ficha.
 */

const DAY = 1440;

/** Minutos desde a meia-noite local do dia (pode sair de 0–1440 em jornadas que cruzam a meia-noite). */
export function minuteOfDay(iso: string, date: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const local = dateIn(iso, timeZone);
  const dayShift = local > date ? DAY : local < date ? -DAY : 0;
  return get("hour") * 60 + get("minute") + dayShift;
}

export const hhmmToMinutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** Posição em % na faixa de 24 h (limitada às bordas). */
export const pct = (m: number) => `${(Math.min(Math.max(m, 0), DAY) / DAY) * 100}%`;

/** Faixa apurada: os sinais «em curso»/«fechada automaticamente» só existem no detalhe por pessoa. */
export type TimelineSegment = Pick<Segment, "start" | "end" | "type"> & Partial<Pick<Segment, "open" | "autoClosed">>;

export interface PlacedSegment {
  type: Segment["type"];
  start: number;
  end: number;
  /** Parte visível na faixa 0–24 h, em minutos (mínimo 4 para nunca desaparecer). */
  left: number;
  width: number;
  /** Começou no dia anterior / continua no dia seguinte (cortada à meia-noite na faixa). */
  fromPreviousDay: boolean;
  toNextDay: boolean;
  /** Em curso (sem fim marcado) ou fechada automaticamente — mostrada de forma distinta. */
  open: boolean;
  autoClosed: boolean;
}

/** Faixas do dia, em minutos locais; nenhuma desaparece por ser curta (mínimo visível tratado na UI). */
export function placeSegments(segments: TimelineSegment[], date: string, timeZone: string): PlacedSegment[] {
  return segments.map((s) => {
    const start = minuteOfDay(s.start, date, timeZone);
    const end = Math.max(start, minuteOfDay(s.end, date, timeZone));
    const left = Math.min(Math.max(start, 0), DAY - 4);
    const width = Math.max(Math.min(end, DAY) - left, 4);
    return { type: s.type, start, end, left, width, fromPreviousDay: start < 0, toNextDay: end > DAY, open: !!s.open, autoClosed: !!s.autoClosed };
  });
}

/**
 * Previsto desenhado na linha 0–24 h: um turno que passa a meia-noite fica
 * em dois troços — do início até às 24 h e das 00 h até ao fim —, cada um
 * marcado do lado do corte (`cutLeft`/`cutRight`).
 */
export function plannedBands(start: string, end: string | null): { start: number; end: number; cutLeft: boolean; cutRight: boolean }[] {
  const band = plannedBand(start, end);
  if (band.end <= DAY) return [{ ...band, cutLeft: false, cutRight: false }];
  return [
    { start: band.start, end: DAY, cutLeft: false, cutRight: true },
    { start: 0, end: band.end - DAY, cutLeft: true, cutRight: false },
  ];
}

/** Faixa do previsto «HH:MM–HH:MM» (fim ≤ início = termina no dia seguinte). */
export function plannedBand(start: string, end: string | null): { start: number; end: number } {
  const a = hhmmToMinutes(start);
  if (!end) return { start: a, end: DAY };
  const b = hhmmToMinutes(end);
  return { start: a, end: b <= a ? b + DAY : b };
}
