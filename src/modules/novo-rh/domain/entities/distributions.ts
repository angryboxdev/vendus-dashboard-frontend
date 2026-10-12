/** Envio de documentos a vários colaboradores (FE-065). */
export type DistributionAudience = { type: "all" } | { type: "locations" | "departments" | "employees"; ids: string[] };

export interface DistributionStats {
  recipients: number;
  read: number;
  confirmed: number;
}

export interface Distribution {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  audience: DistributionAudience;
  requiresConfirmation: boolean;
  status: "sent" | "archived";
  createdBy: string;
  createdAt: string;
  stats: DistributionStats;
}

export interface DistributionReport {
  distribution: Omit<Distribution, "stats">;
  totals: DistributionStats;
  rows: { employeeId: string; name: string; deliveredAt: string; readAt: string | null; confirmedAt: string | null; status: "delivered" | "read" | "confirmed"; hasAccount: boolean }[];
}

/** Envio recebido por uma pessoa (ficha, FE-022). */
export type ReceivedDistribution = Omit<Distribution, "stats"> & { readAt: string | null; confirmedAt: string | null };

/** Os mesmos tipos e limite do backend. */
export const DISTRIBUTION_MIME = ["application/pdf", "image/jpeg", "image/png"];
export const DISTRIBUTION_MAX_BYTES = 20 * 1024 * 1024;
