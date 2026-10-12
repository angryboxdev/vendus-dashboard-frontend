import { apiGet } from "../../../../lib/api.ts";
import type { Overview, TeamPlan } from "../../domain/entities/overview.ts";
import type { OverviewApiPort } from "../../domain/ports/out/overview-api.port.ts";

export class HttpOverviewApiAdapter implements OverviewApiPort {
  get(date?: string) {
    return apiGet<Overview>(`/api/novo-rh/overview${date ? `?date=${encodeURIComponent(date)}` : ""}`);
  }
  plan(from: string, to: string) {
    return apiGet<TeamPlan>(`/api/novo-rh/overview/plan?from=${from}&to=${to}`);
  }
}
