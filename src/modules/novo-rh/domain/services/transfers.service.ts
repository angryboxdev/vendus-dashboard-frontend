import type { ExportJob } from "../entities/periods.ts";

/** Estado mostrado no centro de transferências (FE-005). Só "ready" se descarrega. */
export type TransferState = "queued" | "running" | "ready" | "failed" | "expired";

export function transferState(job: Pick<ExportJob, "status" | "expiresAt">, now: Date): TransferState {
  if (job.status === "done") return job.expiresAt && Date.parse(job.expiresAt) <= now.getTime() ? "expired" : "ready";
  return job.status;
}

/** Acompanhamento: 5 s enquanto há pedidos em curso, a subir até 30 s; parado quando não há nenhum. */
export function pollInterval(jobs: Pick<ExportJob, "status">[] | undefined, attempt: number): number | false {
  if (!jobs?.some((j) => j.status === "queued" || j.status === "running")) return false;
  return Math.min(30_000, 5_000 * 2 ** Math.max(0, attempt));
}
