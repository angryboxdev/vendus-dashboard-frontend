import type { DataMode } from "../../entities/roadmap.ts";

/** Organização de demonstração ligada à organização real (ADR-0034 do backend). */
export interface DemoStatus {
  exists: boolean;
  name: string | null;
}

export interface DemoApiPort {
  status(): Promise<DemoStatus>;
  /** Cria a organização de demonstração com dados fictícios (só Admin). */
  create(): Promise<DemoStatus>;
}

/** Onde fica guardado o modo escolhido (por browser). */
export interface DataModeStorePort {
  load(): DataMode;
  save(mode: DataMode): void;
}
