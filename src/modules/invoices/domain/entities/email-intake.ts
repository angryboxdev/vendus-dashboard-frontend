/** Faturas por email (backend: módulo invoice-email-intake). */
export type EmailIntakeStatus = "received" | "processing" | "imported" | "duplicate" | "read_error" | "rejected";
export type EmailIntakeDestination = "finance" | "stock";

export interface EmailIntakeAttachmentDTO {
  id: string;
  filename: string;
  sender: string | null;
  receivedAt: string;
  status: EmailIntakeStatus;
  /** Ainda vai ser tentado de novo (falha passageira). */
  retrying: boolean;
  invoiceId: string | null;
  message: string | null;
}

export interface EmailIntakeDTO {
  /** A integração está configurada no servidor. */
  configured: boolean;
  /** Esta empresa pode ter endereço (piloto). */
  allowed: boolean;
  address: { email: string; createdAt: string } | null;
  previousAddresses: { email: string; createdAt: string; deactivatedAt: string | null }[];
  destination: EmailIntakeDestination;
  /** Últimos 30 dias. */
  counts: { imported: number; duplicate: number; rejected: number; failed: number; pending: number; emailsWithoutPdf: number };
  recent: EmailIntakeAttachmentDTO[];
}
