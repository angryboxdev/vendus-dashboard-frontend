import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type {
  Adjustment,
  AttendanceDays,
  ChangeInput,
  ClockEvent,
  ClockRevision,
  CorrectionRequest,
  Incident,
  IncidentStatus,
  MyClockStatus,
  QueuedPunch,
  SegmentType,
} from "../../domain/entities/attendance.ts";
import type { AttendanceApiPort, MyClockApiPort, PunchQueueStoragePort } from "../../domain/ports/out/attendance-api.port.ts";

const M = "/api/me/clock";
const A = "/api/novo-rh/attendance";
const qs = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => !!e[1])).toString();

export class HttpMyClockApiAdapter implements MyClockApiPort {
  status() {
    return apiGet<MyClockStatus>(M);
  }
  async punch(input: { segmentType: SegmentType; clientEventId: string; occurredAt?: string }) {
    // A mesma chave em todas as tentativas: o servidor grava uma só vez (RE-9).
    return (await apiWrite<{ event: ClockEvent; duplicate: boolean }>(M, { body: { ...input, source: "pwa" }, idempotencyKey: input.clientEventId })).data;
  }
  days(from: string, to: string) {
    return apiGet<AttendanceDays>(`${M}/days?${qs({ from, to })}`);
  }
  async refuse(revisionId: string, comment: string | null) {
    return (await apiWrite<ClockRevision>(`${M}/revisions/${revisionId}/refuse`, { body: { comment } })).data;
  }
  corrections() {
    return apiGet<CorrectionRequest[]>(`${M}/corrections`);
  }
  async requestCorrection(input: ChangeInput) {
    return (await apiWrite<CorrectionRequest>(`${M}/corrections`, { body: input })).data;
  }
}

export class HttpAttendanceApiAdapter implements AttendanceApiPort {
  days(employeeId: string, from: string, to: string) {
    return apiGet<AttendanceDays>(`${A}/days?${qs({ employeeId, from, to })}`);
  }
  async revise(employeeId: string, input: ChangeInput) {
    return (await apiWrite<ClockRevision>(`${A}/revisions`, { body: { employeeId, ...input } })).data;
  }
  corrections(status?: CorrectionRequest["status"]) {
    return apiGet<CorrectionRequest[]>(`${A}/corrections?${qs({ status })}`);
  }
  async decide(id: string, decision: "approve" | "reject", comment: string | null) {
    return (await apiWrite<CorrectionRequest>(`${A}/corrections/${id}/${decision}`, { body: { comment } })).data;
  }
  incidents(f: { from: string; to: string; status?: IncidentStatus; employeeId?: string }) {
    return apiGet<Incident[]>(`${A}/incidents?${qs(f)}`);
  }
  async resolveIncident(id: string, resolution: "correct" | "validate" | "dismiss", comment: string | null) {
    return (await apiWrite<Incident>(`${A}/incidents/${id}/resolve`, { body: { resolution, comment } })).data;
  }
  adjustments(employeeId: string, from: string, to: string) {
    return apiGet<Adjustment[]>(`${A}/adjustments?${qs({ employeeId, from, to })}`);
  }
  async recalculate(employeeId: string, from: string, to: string) {
    return (await apiWrite<{ queued: number }>(`${A}/recalculate`, { body: { employeeId, from, to } })).data;
  }
}

const KEY = "novo-rh.punch-queue";

/** Fila offline no `localStorage` (só ids e tipo — nenhum dado pessoal). */
export class LocalStoragePunchQueue implements PunchQueueStoragePort {
  /** Cópia em memória: vale quando o navegador não deixa guardar (modo privado). */
  private memory: QueuedPunch[] | null = null;

  load(): QueuedPunch[] {
    if (this.memory) return [...this.memory];
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as QueuedPunch[]) : [];
    } catch {
      return [];
    }
  }
  save(items: QueuedPunch[]): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
      this.memory = null;
    } catch {
      this.memory = [...items];
    }
  }
}
