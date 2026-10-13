import type { DataMode } from "../../entities/roadmap.ts";

/** Organização de demonstração ligada à organização real (ADR-0034 do backend). */
export interface DemoRefreshResult {
  punches?: number;
  enriched?: { periodClosed: boolean; rules: number; pending: number; alerts: number; errors?: string[] };
}

export interface DemoStatus {
  exists: boolean;
  name: string | null;
  /** Última atualização dos dados fictícios (neste servidor). */
  refresh?: { running: boolean; lastAt: string | null; last: DemoRefreshResult | null; error: string | null };
}

export interface DemoApiPort {
  status(): Promise<DemoStatus>;
  /** Cria a organização de demonstração com dados fictícios (só Admin). */
  create(): Promise<DemoStatus>;
  /** Acrescentar já as marcações fictícias até agora (e o cenário, se faltar). */
  /** `running`: a atualização continua em segundo plano (demora mais de 15 s). */
  refresh(): Promise<{ punches: number; scenario: boolean; running?: boolean }>;
}

/** Onde fica guardado o modo escolhido (por browser). */
export interface DataModeStorePort {
  load(): DataMode;
  save(mode: DataMode): void;
}
