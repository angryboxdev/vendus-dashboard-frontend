import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type {
  Adjustment,
  AttendanceDays,
  BreakType,
  BreakTypeInput,
  ClockType,
  ClockTypeInput,
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
import type { ConferenceApplyInput, ConferenceResult, ReviewDay, ReviewWeek, TimeRange } from "../../domain/entities/attendance-review.ts";

const M = "/api/me/clock";
const A = "/api/novo-rh/attendance";
const qs = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => !!e[1])).toString();

/** Formato de `GET /conference` (segundos; o domínio do ecrã trabalha em minutos). */
interface ConferenceDto {
  from: string;
  to: string;
  people: { id: string; name: string; locationName: string | null }[];
  days: {
    employeeId: string;
    workDate: string;
    phase: ReviewDay["phase"];
    state: NonNullable<ReviewDay["state"]>;
    closed: boolean;
    plannedRanges: TimeRange[] | null;
    theoreticalSeconds: number;
    workedSeconds: number;
    validatedSeconds: number;
    restDay: boolean;
    holiday: boolean;
    excused: boolean;
    incomplete: boolean;
    lateMinutes: number;
    punches: ReviewDay["punches"];
    version: number | null;
    review: { id: string; decision: NonNullable<ReviewDay["review"]>["decision"]; validatedSeconds: number | null; reason: string; absenceType: string | null; scope: NonNullable<ReviewDay["review"]>["scope"]; createdBy: string; createdAt: string } | null;
  }[];
}

const min = (s: number) => Math.round(s / 60);

export function toReviewWeek(dto: ConferenceDto): ReviewWeek {
  return {
    from: dto.from,
    to: dto.to,
    people: dto.people.map((p) => ({ id: p.id, name: p.name, location: p.locationName ?? "Sem centro" })),
    days: dto.days.map((d) => ({
      employeeId: d.employeeId,
      date: d.workDate,
      planned: d.theoreticalSeconds > 0 || d.plannedRanges?.length ? d.plannedRanges : null,
      dayOff: d.restDay,
      holiday: d.holiday,
      absence: d.excused ? "Ausência" : null,
      punches: d.punches.map((p) => ({ at: p.at, kind: p.kind, ...(p.nextDay && { nextDay: true }) })),
      workedMinutes: min(d.workedSeconds),
      plannedMinutes: min(d.theoreticalSeconds),
      phase: d.phase,
      closed: d.closed,
      state: d.state,
      incomplete: d.incomplete,
      lateMinutes: d.lateMinutes,
      version: d.version,
      review: d.review
        ? {
            id: d.review.id,
            createdAt: d.review.createdAt,
            decision: d.review.decision,
            validatedMinutes: min(d.review.validatedSeconds ?? d.validatedSeconds),
            reason: d.review.reason,
            by: d.review.createdBy,
            scope: d.review.scope,
            ...(d.review.absenceType && { absenceType: d.review.absenceType }),
          }
        : null,
    })),
  };
}

export class HttpMyClockApiAdapter implements MyClockApiPort {
  status() {
    return apiGet<MyClockStatus>(M);
  }
  breakTypes() {
    return apiGet<BreakType[]>(`${M}/break-types`);
  }
  clockTypes() {
    return apiGet<ClockType[]>(`${M}/clock-types`);
  }
  async punch(input: { segmentType: SegmentType; clientEventId: string; occurredAt?: string; breakTypeId?: string | null; clockTypeId?: string | null }) {
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
  listBreakTypes() {
    return apiGet<BreakType[]>(`${A}/break-types`);
  }
  async createBreakType(input: BreakTypeInput) {
    return (await apiWrite<BreakType>(`${A}/break-types`, { body: input })).data;
  }
  async updateBreakType(id: string, input: BreakTypeInput, version: number, reason: string) {
    return (await apiWrite<BreakType>(`${A}/break-types/${id}`, { method: "PUT", body: { ...input, version, reason } })).data;
  }
  async archiveBreakType(id: string) {
    await apiWrite(`${A}/break-types/${id}/archive`, {});
  }
  listClockTypes() {
    return apiGet<ClockType[]>(`${A}/clock-types`);
  }
  async createClockType(input: ClockTypeInput) {
    return (await apiWrite<ClockType>(`${A}/clock-types`, { body: input })).data;
  }
  async updateClockType(id: string, input: ClockTypeInput, version: number, reason: string) {
    return (await apiWrite<ClockType>(`${A}/clock-types/${id}`, { method: "PUT", body: { ...input, version, reason } })).data;
  }
  async archiveClockType(id: string) {
    await apiWrite(`${A}/clock-types/${id}/archive`, {});
  }
  async conference(from: string, to: string) {
    return toReviewWeek(await apiGet<ConferenceDto>(`${A}/conference?${qs({ from, to })}`));
  }
  async applyConference(input: ConferenceApplyInput) {
    return (await apiWrite<ConferenceResult>(`${A}/conference/apply`, { body: input })).data;
  }
  async voidConferenceReview(id: string, reason: string) {
    await apiWrite(`${A}/conference/reviews/${id}/void`, { body: { reason } });
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
