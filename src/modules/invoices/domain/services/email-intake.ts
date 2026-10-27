import type { EmailIntakeAttachmentDTO } from "../entities/email-intake.ts";
import type { InvoiceDTO } from "../entities/invoice.ts";

export type EmailIntakeTone = "success" | "warning" | "danger" | "neutral";

/** Etiqueta e cor de cada PDF recebido (estados da task: Recebido, Em processamento, Por rever, Duplicado, Erro de leitura, Rejeitado). */
export function emailIntakeStatus(a: Pick<EmailIntakeAttachmentDTO, "status" | "retrying">): { label: string; tone: EmailIntakeTone } {
  switch (a.status) {
    case "received":
      return { label: "Recebido", tone: "neutral" };
    case "processing":
      return { label: "Em processamento", tone: "neutral" };
    case "imported":
      return { label: "Por rever", tone: "success" };
    case "duplicate":
      return { label: "Duplicado", tone: "warning" };
    case "rejected":
      return { label: "Rejeitado", tone: "danger" };
    case "read_error":
      return a.retrying ? { label: "Erro — vai tentar de novo", tone: "warning" } : { label: "Erro de leitura", tone: "danger" };
  }
}

/** Fatura à espera de revisão: rascunho lido (import manual ou por email) ou marcada para rever. */
export function isPendingReview(inv: Pick<InvoiceDTO, "status" | "requiresReview">): boolean {
  return inv.status === "draft_ai" || inv.status === "pending_review" || (inv.requiresReview && inv.status !== "cancelled" && inv.status !== "paid");
}
