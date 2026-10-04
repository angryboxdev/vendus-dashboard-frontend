import type { JobRole } from "./employee.ts";

/** Cargo (Colaboradores → Cargos) — espelho de `PositionDTO` do backend. Cargo ≠ permissão no Hub. */
export interface Position {
  id: string;
  name: string;
  description: string | null;
  /** Categoria operacional transitória usada pelas Escalas e categorias de documentos (D4). */
  operationalCategory: JobRole;
  active: boolean;
  /** Colaboradores ativos com este cargo. */
  employeeCount: number;
  updatedAt: string;
}

export interface PositionPayload {
  name?: string;
  description?: string | null;
  operationalCategory?: JobRole;
}
