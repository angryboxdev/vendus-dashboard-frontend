import { formatEUR } from "../../../../lib/format.ts";
import { MOVEMENT_KIND_LABELS } from "../../../bank-statements/domain/services/movement-kind.ts";
import type { MovementKind } from "../../../bank-statements/domain/entities/bank-statement.ts";

/** Cores do gráfico (recharts não aceita classes): verde = entradas, vermelho = saídas — só estados, como no kit. */
export const CHART_COLORS = { inflow: "#059669", outflow: "#E11D48", grid: "#E6E8EC", axis: "#19213A" } as const;

export const euros = (cents: number) => formatEUR(cents / 100);

/** Nome do tipo genérico do banco (as mesmas etiquetas da conciliação bancária). */
export const kindLabel = (kind: string | null) => (kind && MOVEMENT_KIND_LABELS[kind as MovementKind]) || "Por rever";
