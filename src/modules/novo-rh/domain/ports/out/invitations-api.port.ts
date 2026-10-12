import type { Invitation, JoinPrefill, JoinRequest } from "../../entities/invitations.ts";

/** Convites (`/api/novo-rh/invitations`) e pedido público (`/api/public/join`). */
export interface InvitationsApiPort {
  list(): Promise<Invitation[]>;
  create(input: { locationId: string | null; departmentId: string | null; expiresInDays: number; maxUses: number | null }): Promise<{ invitation: Invitation; code: string }>;
  revoke(id: string): Promise<void>;
  requests(): Promise<JoinRequest[]>;
  accept(requestId: string): Promise<JoinPrefill>;
  complete(requestId: string, employeeId: string): Promise<void>;
  reject(requestId: string, reason: string): Promise<void>;
}

/** Página pública de adesão (sem sessão). */
export interface JoinApiPort {
  check(code: string): Promise<{ valid: boolean; expiresAt: string }>;
  submit(code: string, input: { firstName: string; lastName: string; email: string }): Promise<void>;
}
