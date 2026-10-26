import type { BankMovementDTO, MovementKind } from "../entities/bank-statement.ts";

/** Nome de cada tipo de movimento (V2 F4 — calculado no servidor a partir do descritivo do banco). */
export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  sales: "Vendas e recebimentos",
  deposit: "Depósito",
  transfer_in: "Transferência recebida",
  transfer_out: "Transferência enviada",
  supplier: "Fornecedores e serviços",
  payroll: "Salários",
  tax_state: "Impostos e Estado",
  bank_fee: "Comissões e serviços bancários",
  insurance: "Seguros",
  utilities: "Energia, água e comunicações",
  card_purchase: "Compra com cartão",
  internal_transfer: "Transferência interna",
  reversal: "Devolução / estorno",
  to_review: "Por rever",
};

export type MovementFilter = "all" | "inflows" | "outflows" | "transfers" | "to_review";

const TRANSFER_KINDS: ReadonlySet<MovementKind> = new Set(["transfer_in", "transfer_out", "internal_transfer"]);

/** Filtros do mês (task V2 §6.3): entradas, saídas, transferências (enviadas, recebidas, internas), por rever. */
export function matchesMovementFilter(m: Pick<BankMovementDTO, "movementType" | "movementKind">, filter: MovementFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "inflows":
      return m.movementType === "credit";
    case "outflows":
      return m.movementType === "debit";
    case "transfers":
      return !!m.movementKind && TRANSFER_KINDS.has(m.movementKind);
    case "to_review":
      return m.movementKind === "to_review";
  }
}
