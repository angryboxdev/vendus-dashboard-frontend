/** Caixa de pedidos (contrato de `/api/novo-rh/inbox`, módulo inbox do backend). */
export type InboxType = "leave" | "clock" | "overtime" | "swap" | "custom";
export type InboxSegment = "mine" | "others" | "all";
export type BlockedReason = "own" | "not_current_level" | "no_permission";

export interface InboxRow {
  key: string;
  type: InboxType;
  id: string;
  employeeId: string;
  employeeName: string;
  locationName: string | null;
  requestedAt: string;
  ageDays: number;
  title: string;
  detail: string;
  meta: { label: string; value: string }[];
  canDecide: boolean;
  blockedReason: BlockedReason | null;
  level: { current: number; total: number } | null;
}

export interface InboxList {
  types: InboxType[];
  counters: Partial<Record<InboxType, { mine: number; others: number }>>;
  items: InboxRow[];
}

export interface DecisionResult {
  key: string;
  ok: boolean;
  code?: string;
  message?: string;
}

/** Recusa: motivo mínimo (igual ao backend). */
export const MIN_REJECT_REASON = 5;
/** Antiguidade a partir da qual o pedido fica destacado (RE-24). */
export const OLD_REQUEST_DAYS = 7;
