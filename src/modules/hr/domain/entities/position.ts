/** Cargo (Colaboradores → Cargos) — espelho de `PositionDTO` do backend. Cargo ≠ permissão no Hub. */
export interface Position {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  /** Colaboradores ativos com este cargo. */
  employeeCount: number;
  updatedAt: string;
}

export interface PositionPayload {
  name?: string;
  description?: string | null;
}
