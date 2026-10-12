import type { Distribution, DistributionAudience, DistributionReport, ReceivedDistribution } from "../../entities/distributions.ts";

/** Envio de documentos (`/api/novo-rh/document-distributions`). */
export interface DistributionsApiPort {
  list(): Promise<Distribution[]>;
  previewAudience(audience: DistributionAudience): Promise<{ recipients: number; withoutAccount: number }>;
  send(input: { title: string; audience: DistributionAudience; requiresConfirmation: boolean; file: File }): Promise<Distribution & { withoutAccount: number }>;
  report(id: string): Promise<DistributionReport>;
  remind(id: string): Promise<{ pending: number; notified: number; withoutAccount: number }>;
  archive(id: string): Promise<void>;
  downloadUrl(id: string): Promise<{ url: string }>;
  proofCsv(id: string): Promise<Blob>;
  /** Envios recebidos por uma pessoa (ficha). */
  forEmployee(employeeId: string): Promise<ReceivedDistribution[]>;
}
