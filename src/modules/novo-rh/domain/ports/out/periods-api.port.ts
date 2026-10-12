import type { Closure, ExportJob, PayPeriod, PendingItem, Reopening } from "../../entities/periods.ts";

/** Fecho de período (`/api/novo-rh/periods`). */
export interface PeriodsApiPort {
  list(): Promise<PayPeriod[]>;
  create(input: Pick<PayPeriod, "scopeType" | "scopeId" | "startDate" | "endDate">): Promise<PayPeriod>;
  precheck(id: string): Promise<{ employees: number; pending: PendingItem[] }>;
  close(id: string, exceptionReason: string | null): Promise<Closure>;
  closures(id: string): Promise<Closure[]>;
  requestReopen(id: string, reason: string): Promise<Reopening>;
  reopenings(): Promise<Reopening[]>;
  approveReopen(id: string): Promise<Reopening>;
  rejectReopen(id: string, reason: string | null): Promise<Reopening>;
  requestExport(id: string, kind: ExportJob["kind"], includeSensitive: boolean): Promise<ExportJob>;
  exports(): Promise<ExportJob[]>;
  /** Pede o link (token) e devolve o ficheiro. */
  download(job: ExportJob): Promise<{ blob: Blob; fileName: string }>;
}
