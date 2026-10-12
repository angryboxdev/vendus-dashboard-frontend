import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type { Invitation, JoinPrefill, JoinRequest } from "../../domain/entities/invitations.ts";
import type { InvitationsApiPort, JoinApiPort } from "../../domain/ports/out/invitations-api.port.ts";

export class HttpInvitationsApiAdapter implements InvitationsApiPort {
  private readonly I = "/api/novo-rh/invitations";
  list() {
    return apiGet<Invitation[]>(this.I);
  }
  async create(input: { locationId: string | null; departmentId: string | null; expiresInDays: number; maxUses: number | null }) {
    return (await apiWrite<{ invitation: Invitation; code: string }>(this.I, { body: input })).data;
  }
  async revoke(id: string) {
    await apiWrite(`${this.I}/${id}/revoke`, {});
  }
  requests() {
    return apiGet<JoinRequest[]>(`${this.I}/requests`);
  }
  async accept(requestId: string) {
    return (await apiWrite<JoinPrefill>(`${this.I}/requests/${requestId}/accept`, {})).data;
  }
  async complete(requestId: string, employeeId: string) {
    await apiWrite(`${this.I}/requests/${requestId}/complete`, { body: { employeeId } });
  }
  async reject(requestId: string, reason: string) {
    await apiWrite(`${this.I}/requests/${requestId}/reject`, { body: { reason } });
  }
}

export class HttpJoinApiAdapter implements JoinApiPort {
  check(code: string) {
    return apiGet<{ valid: boolean; expiresAt: string }>(`/api/public/join/${encodeURIComponent(code)}`);
  }
  async submit(code: string, input: { firstName: string; lastName: string; email: string }) {
    await apiWrite(`/api/public/join/${encodeURIComponent(code)}`, { body: input });
  }
}
