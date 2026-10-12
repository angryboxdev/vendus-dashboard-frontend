/** Convites e pedidos de adesão (FE-054). */
export type InvitationState = "active" | "expired" | "exhausted" | "revoked";

export interface Invitation {
  id: string;
  maskedCode: string;
  state: InvitationState;
  locationId: string | null;
  departmentId: string | null;
  maxUses: number | null;
  uses: number;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
}

export interface JoinRequest {
  id: string;
  invitationId: string;
  invitationState: InvitationState;
  firstName: string;
  lastName: string;
  email: string;
  status: "pending" | "accepted" | "rejected";
  possibleDuplicate: boolean;
  rejectReason: string | null;
  employeeId: string | null;
  createdAt: string;
}

export interface JoinPrefill {
  requestId: string;
  firstName: string;
  lastName: string;
  email: string;
  locationId: string | null;
  departmentId: string | null;
  existingEmployeeId: string | null;
}

/** Link público de adesão (o código vai no caminho, nunca para logs). */
export const joinLink = (origin: string, code: string) => `${origin}/aderir/${code}`;
