import { ApiError, apiGet, apiPostFormData, apiWrite } from "../../../../lib/api.ts";
import {
  PortalNotFoundError,
  PortalNotLinkedError,
  PortalOfflineError,
  PortalRequestError,
  PunchRefusedError,
  REQUEST_REASONS,
  type ClientLocation,
  type Coworker,
  type DocumentChecklist,
  type NewDocumentSubmission,
  type MyDocument,
  type MyLeave,
  type MyRequest,
  type MyShift,
  type NewRequest,
  type PortalHome,
  type PunchKind,
  type PunchResult,
} from "../../domain/entities/portal.ts";
import type { PortalApiPort } from "../../domain/ports/out/portal-api.port.ts";
import {
  homeFromNovoRh,
  leaveFromAbsences,
  localDateIn,
  punchResultFromNovoRh,
  punchSegment,
  reasonComment,
  requestFromAbsence,
  requestsFromAbsences,
  shiftsFromRoster,
  type NovoRhAbsence,
  type NovoRhClockStatus,
  type NovoRhProfile,
  type NovoRhShift,
  type PortalTypeIds,
} from "../../domain/services/novo-rh-portal.service.ts";

const DEFAULT_TZ = "Europe/Lisbon";
const HOME_DAYS = 14;
const LOOKUP_DAYS = 31;

const problemCode = (data: unknown): string | null => {
  const type = (data as { type?: unknown } | null)?.type;
  return typeof type === "string" && type.startsWith("/problems/") ? type.slice("/problems/".length) : null;
};

function translate(e: unknown, opts: { punch?: boolean } = {}): unknown {
  if (e instanceof ApiError) {
    const code = problemCode(e.data);
    if (e.status === 404) return new PortalNotFoundError();
    if (opts.punch && (e.status === 409 || e.status === 422) && code && code !== "validation_error") return new PunchRefusedError(code, e.message);
    if (e.status === 400 || e.status === 409 || e.status === 422) return new PortalRequestError(e.message);
    return e;
  }
  if (e instanceof TypeError) return new PortalOfflineError();
  return e;
}

async function call<T>(fn: () => Promise<T>, opts: { punch?: boolean } = {}): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw translate(e, opts);
  }
}

const plusDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/**
 * Portal do Colaborador sobre o Novo RH (Fase 2): ponto em `/api/me/clock`,
 * escala publicada em `/api/me/roster`, pedidos em `/api/me/absences` (tipos
 * «Folga» e «Falta justificada»). Documentos e recibos já são o motor
 * partilhado (`/api/me/documents`) — delegados no adapter de sempre.
 */
export class HttpNovoRhPortalApiAdapter implements PortalApiPort {
  private timeZone = DEFAULT_TZ;
  private profile: Promise<NovoRhProfile> | null = null;
  private types: Promise<PortalTypeIds> | null = null;
  /** Turnos já vistos (para saber o dia a justificar). */
  private readonly shiftDates = new Map<string, string>();

  private readonly documents: Pick<PortalApiPort, "listMyDocuments" | "getDocumentUrl" | "replaceDocument" | "getDocumentChecklist" | "submitDocument">;

  constructor(documents: Pick<PortalApiPort, "listMyDocuments" | "getDocumentUrl" | "replaceDocument" | "getDocumentChecklist" | "submitDocument">) {
    this.documents = documents;
  }

  private myProfile(): Promise<NovoRhProfile> {
    this.profile ??= call(() => apiGet<NovoRhProfile>("/api/me/profile")).catch((e: unknown) => {
      this.profile = null;
      throw e;
    });
    return this.profile;
  }

  private portalTypes(): Promise<PortalTypeIds> {
    this.types ??= call(() => apiGet<PortalTypeIds>("/api/me/absences/portal-types")).catch((e: unknown) => {
      this.types = null;
      throw e;
    });
    return this.types;
  }

  private async shifts(from: string, to: string): Promise<MyShift[]> {
    const [roster, profile] = await Promise.all([call(() => apiGet<{ shifts: NovoRhShift[] }>(`/api/me/roster?from=${from}&to=${to}`)), this.myProfile()]);
    const shifts = shiftsFromRoster(roster.shifts, profile.locationName);
    for (const s of shifts) this.shiftDates.set(s.id, s.workDate);
    return shifts;
  }

  async getHome(): Promise<PortalHome> {
    const [profile, status] = await Promise.all([this.myProfile(), call(() => apiGet<NovoRhClockStatus>("/api/me/clock"))]).catch((e: unknown) => {
      // Sem ficha ligada à conta, o Novo RH responde 404.
      throw e instanceof PortalNotFoundError ? new PortalNotLinkedError() : e;
    });
    this.timeZone = status.timeZone || DEFAULT_TZ;
    const today = localDateIn(new Date().toISOString(), this.timeZone);
    return homeFromNovoRh(profile, status, await this.shifts(today, plusDays(today, HOME_DAYS)), today);
  }

  async registerPunch(kind: PunchKind, idempotencyKey: string, location: ClientLocation | null): Promise<PunchResult> {
    const coords = location && "latitude" in location ? { latitude: location.latitude, longitude: location.longitude } : {};
    const out = await call(
      () =>
        apiWrite<{ event: { occurredAt: string }; duplicate: boolean }>("/api/me/clock", {
          body: { segmentType: punchSegment(kind), source: "web", clientEventId: idempotencyKey, ...coords },
          idempotencyKey,
        }),
      { punch: true },
    );
    return punchResultFromNovoRh(kind, out.data.event, out.data.duplicate, this.timeZone);
  }

  listMyShifts(from: string, to: string): Promise<MyShift[]> {
    return this.shifts(from, to);
  }

  async listCoworkers(shiftId: string): Promise<Coworker[]> {
    try {
      return (await apiGet<{ coworkers: Coworker[] }>(`/api/me/roster/shifts/${encodeURIComponent(shiftId)}/coworkers`)).coworkers;
    } catch (e) {
      // Regra «Mostrar os turnos dos colegas» desligada: simplesmente não há colegas a mostrar.
      if (e instanceof ApiError && e.status === 403) return [];
      throw translate(e);
    }
  }

  listMyDocuments(): Promise<MyDocument[]> {
    return this.documents.listMyDocuments();
  }

  getDocumentUrl(documentId: string): Promise<string> {
    return this.documents.getDocumentUrl(documentId);
  }

  replaceDocument(documentId: string, file: File, expiresAt: string | null): Promise<MyDocument> {
    return this.documents.replaceDocument(documentId, file, expiresAt);
  }

  getDocumentChecklist(): Promise<DocumentChecklist> {
    return this.documents.getDocumentChecklist();
  }

  submitDocument(submission: NewDocumentSubmission): Promise<MyDocument> {
    return this.documents.submitDocument(submission);
  }

  async getMyLeave(year: number): Promise<MyLeave> {
    const [mine, types] = await Promise.all([call(() => apiGet<{ requests: NovoRhAbsence[] }>("/api/me/absences")), this.portalTypes()]);
    return leaveFromAbsences(mine.requests, year, types);
  }

  async listMyRequests(): Promise<MyRequest[]> {
    const [mine, types] = await Promise.all([call(() => apiGet<{ requests: NovoRhAbsence[] }>("/api/me/absences")), this.portalTypes()]);
    return requestsFromAbsences(mine.requests, types);
  }

  async createRequest(request: NewRequest): Promise<MyRequest> {
    const types = await this.portalTypes();
    const typeId = request.kind === "justify_absence" ? types.justifiedTypeId : types.dayOffTypeId;
    if (!typeId) throw new PortalRequestError("Os pedidos ainda não estão configurados. Fale com o RH.");
    const label = REQUEST_REASONS[request.kind].find((r) => r.code === request.reasonCode)?.label;
    if (!label) throw new PortalRequestError("Escolha o motivo.");
    let startDate: string;
    let endDate: string;
    let attachment: unknown = null;
    if (request.kind === "justify_absence") {
      const date = this.shiftDates.get(request.workShiftId) ?? (await this.findShiftDate(request.workShiftId));
      if (!date) throw new PortalRequestError("Escolha o turno.");
      startDate = endDate = date;
      if (request.attachment) {
        const form = new FormData();
        form.append("file", request.attachment);
        attachment = await call(() => apiPostFormData<unknown>("/api/me/absence-attachments", form));
      }
    } else {
      startDate = request.startDate;
      endDate = request.endDate;
    }
    const created = await call(() =>
      apiWrite<NovoRhAbsence>("/api/me/absences", {
        body: { typeId, startDate, endDate, halfDay: false, comment: reasonComment(label, request.reasonText), ...(attachment ? { attachment } : {}) },
      }),
    );
    return requestFromAbsence(created.data, types);
  }

  async cancelRequest(requestId: string): Promise<MyRequest> {
    const [out, types] = await Promise.all([call(() => apiWrite<NovoRhAbsence>(`/api/me/absences/${encodeURIComponent(requestId)}/cancel`, { body: {} })), this.portalTypes()]);
    return requestFromAbsence(out.data, types);
  }

  private async findShiftDate(shiftId: string): Promise<string | null> {
    const today = localDateIn(new Date().toISOString(), this.timeZone);
    await this.shifts(plusDays(today, -LOOKUP_DAYS), today);
    return this.shiftDates.get(shiftId) ?? null;
  }
}
