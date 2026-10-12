import type { QueuedPunch, SegmentType } from "../entities/attendance.ts";
import type { PunchQueueStoragePort } from "../ports/out/attendance-api.port.ts";

/** Tipos de marcação, pela ordem dos menus. */
export const SEGMENTS: SegmentType[] = ["work", "remote", "break_unpaid", "break_paid", "off"];

/** "8h 59min" — truncado ao minuto, nunca arredondado (igual ao backend). */
export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const m = Math.floor(Math.abs(seconds) / 60);
  return `${sign}${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`;
}

/** Hora local "HH:MM" de um instante, no fuso indicado. */
export function timeIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(iso));
}

/** Data local "AAAA-MM-DD" de um instante, no fuso indicado. */
export function dateIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
}

function offsetMinutes(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return Math.round((Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - ms) / 60_000);
}

/** "AAAA-MM-DDTHH:MM" no fuso do centro → instante UTC (ISO). */
export function zonedToUtc(local: string, timeZone: string): string {
  const guess = Date.parse(`${local}:00Z`);
  let utc = guess - offsetMinutes(guess, timeZone) * 60_000;
  const second = guess - offsetMinutes(utc, timeZone) * 60_000;
  if (second !== utc) utc = second;
  return new Date(utc).toISOString();
}

/** Instante → "AAAA-MM-DDTHH:MM" no fuso do centro (para `<input type="datetime-local">`). */
export function utcToZoned(iso: string, timeZone: string): string {
  return `${dateIn(iso, timeZone)}T${timeIn(iso, timeZone)}`;
}

/** Datas (AAAA-MM-DD) de uma semana ISO que contém `date`. */
export function weekOf(date: string): { from: string; to: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d.getTime() - offset * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

/** Botões disponíveis em cada estado: fora → entrar; a trabalhar → pausa/remoto/sair; em pausa → voltar/sair. */
export function nextActions(state: SegmentType): SegmentType[] {
  if (state === "off") return ["work", "remote"];
  if (state === "break_paid" || state === "break_unpaid") return ["work", "off"];
  if (state === "remote") return ["break_unpaid", "work", "off"];
  return ["break_unpaid", "remote", "off"];
}

/**
 * Fila offline (RE-9): cada marcação recebe um `clientEventId` ao ser criada e
 * mantém-no em todas as tentativas — o servidor grava uma só vez. Uma falha de
 * rede deixa-a na fila; uma recusa do servidor (4xx) tira-a e devolve o erro.
 */
export class PunchQueue {
  private readonly storage: PunchQueueStoragePort;
  private readonly newId: () => string;

  constructor(storage: PunchQueueStoragePort, newId: () => string) {
    this.storage = storage;
    this.newId = newId;
  }

  pending(): QueuedPunch[] {
    return this.storage.load();
  }

  add(segmentType: SegmentType, now: string, breakTypeId: string | null = null, clockTypeId: string | null = null): QueuedPunch {
    const item = { clientEventId: this.newId(), segmentType, createdAt: now, ...(breakTypeId ? { breakTypeId } : {}), ...(clockTypeId ? { clockTypeId } : {}) };
    this.storage.save([...this.storage.load(), item]);
    return item;
  }

  /** Envia por ordem; para na primeira falha de rede. Devolve as recusas do servidor. */
  async flush(send: (p: QueuedPunch) => Promise<void>, isNetworkError: (e: unknown) => boolean): Promise<{ sent: number; refused: { item: QueuedPunch; error: unknown }[] }> {
    let sent = 0;
    const refused: { item: QueuedPunch; error: unknown }[] = [];
    for (const item of this.storage.load()) {
      try {
        await send(item);
        sent++;
      } catch (e) {
        if (isNetworkError(e)) break;
        refused.push({ item, error: e });
      }
      this.storage.save(this.storage.load().filter((x) => x.clientEventId !== item.clientEventId));
    }
    return { sent, refused };
  }
}
