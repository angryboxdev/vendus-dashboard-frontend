import type { ClientLocation, MyDocument, NewRequest, PunchKind } from "../../domain/entities/portal.ts";
import type { PortalApiPort } from "../../domain/ports/out/portal-api.port.ts";

export type PortalSource = "novo_rh" | "legacy";

/**
 * Portal ligado ao Novo RH (Fase 2): a fonte (ponto, escala, pedidos) vem do
 * interruptor `time_tracking.portal.uses_novo_rh` (`GET /api/me/portal-mode`),
 * lido uma vez por sessão do Portal. Se a leitura falhar, fica o sistema de
 * sempre — o servidor recusa o ponto antigo depois do corte, nunca há dois registos.
 */
export class ModeAwarePortalApiAdapter implements PortalApiPort {
  private readonly legacy: PortalApiPort;
  private readonly novoRh: PortalApiPort;
  private readonly resolveSource: () => Promise<PortalSource>;
  private source: Promise<PortalSource> | null = null;

  constructor(legacy: PortalApiPort, novoRh: PortalApiPort, resolveSource: () => Promise<PortalSource>) {
    this.legacy = legacy;
    this.novoRh = novoRh;
    this.resolveSource = resolveSource;
  }

  private async api(): Promise<PortalApiPort> {
    this.source ??= this.resolveSource().catch(() => "legacy" as const);
    return (await this.source) === "novo_rh" ? this.novoRh : this.legacy;
  }

  async getHome() {
    return (await this.api()).getHome();
  }
  async registerPunch(kind: PunchKind, idempotencyKey: string, location: ClientLocation | null) {
    return (await this.api()).registerPunch(kind, idempotencyKey, location);
  }
  async listMyShifts(from: string, to: string) {
    return (await this.api()).listMyShifts(from, to);
  }
  async listCoworkers(shiftId: string) {
    return (await this.api()).listCoworkers(shiftId);
  }
  async listMyDocuments() {
    return (await this.api()).listMyDocuments();
  }
  async getDocumentUrl(documentId: string) {
    return (await this.api()).getDocumentUrl(documentId);
  }
  async getMyLeave(year: number) {
    return (await this.api()).getMyLeave(year);
  }
  async replaceDocument(documentId: string, file: File, expiresAt: string | null): Promise<MyDocument> {
    return (await this.api()).replaceDocument(documentId, file, expiresAt);
  }
  async listMyRequests() {
    return (await this.api()).listMyRequests();
  }
  async createRequest(request: NewRequest) {
    return (await this.api()).createRequest(request);
  }
  async cancelRequest(requestId: string) {
    return (await this.api()).cancelRequest(requestId);
  }
}
